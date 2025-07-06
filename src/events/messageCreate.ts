import { Message } from "discord.js";
import { Event } from "../types/event";
import { Command } from "../types/command";
import { logger } from "../utils/logger";
import {
  eventErrorHandler,
  commandErrorHandler,
} from "../middleware/errorHandler";
import { permissions } from "../middleware/permissions";
import { ConversationManager } from "../services/ai/conversation";
import { AIClient } from "../services/ai/client";
import { withExecutionLock } from "./helpers/executionLock";
import { config } from "../config";
import {
  resolveDiscordMentionsAndUrls,
  cleanAIResponse,
} from "../services/ai/utils";

const PREFIX = "g!";

const conversationManager = new ConversationManager();
const aiClient = new AIClient();

// Helper: Extract multimodal content from a Discord message
function extractMultimodalContent(message) {
  const content = [];
  if (message.content && message.content.trim()) {
    content.push({ type: "text", text: message.content });
  }
  for (const [, attachment] of message.attachments) {
    if (attachment.contentType && attachment.contentType.startsWith("image/")) {
      content.push({ type: "image_url", image_url: { url: attachment.url } });
    }
  }
  for (const embed of message.embeds) {
    if (embed.image && embed.image.url) {
      content.push({ type: "image_url", image_url: { url: embed.image.url } });
    }
  }
  return content.length > 0
    ? content
    : [{ type: "text", text: message.content }];
}

const event: Event<"messageCreate"> = {
  name: "messageCreate",
  execute: eventErrorHandler(async (message: Message) => {
    const isDM = message.guildId === null;
    console.log(
      `[messageCreate] Received message: ${message.content} in ${
        isDM ? "DM" : "channel"
      } from ${message.author.tag}`
    );
    if (message.author.bot) return;

    // Access the commands map attached to the client
    // @ts-ignore
    const commands: Map<string, Command> = message.client.commands;

    const contextType = isDM ? "user" : "channel";
    const contextId = isDM ? message.author.id : message.channel.id;

    // --- DM Handling ---
    if (isDM) {
      if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();
        const command = commands?.get(commandName);
        if (command) {
          // Run as command (reuse server logic) with execution lock
          const lockKey = `msg_${message.id}`;
          await withExecutionLock(lockKey, async () => {
            const startTime = Date.now();
            try {
              logger.debug(
                `Processing DM command: ${message.content} from user ${message.author.tag}`
              );
              // Add permission check here if needed
              if (command.meta.permissions) {
                const requiredPerms = Array.isArray(command.meta.permissions)
                  ? command.meta.permissions
                  : [command.meta.permissions];
                const hasPermission = permissions(requiredPerms)(
                  message,
                  (reason) => {
                    throw new Error(reason);
                  }
                );
                if (!hasPermission) {
                  return; // Error already thrown above
                }
              }
              logger.info(
                `Executing DM command: ${commandName} from user: ${message.author.tag} (${message.author.id})`
              );
              await commandErrorHandler(async (message) => {
                const commandPromise = command.execute(message, { args });
                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("Command execution timeout")),
                    30000
                  )
                );
                await Promise.race([commandPromise, timeoutPromise]);
              }, commandName)(message);
              const executionTime = Date.now() - startTime;
              logger.info(
                `DM command ${commandName} completed successfully in ${executionTime}ms`
              );
            } catch (err) {
              const executionTime = Date.now() - startTime;
              logger.error(
                `Error executing DM command for user ${message.author.tag}:`,
                err
              );
              logger.error(`Command execution time: ${executionTime}ms`);
              throw err;
            }
          });
          return;
        }
      }
      // Otherwise, treat as conversation (AI)
      const botUsername = message.client.user.username;
      const botNickname = message.guild
        ? message.guild.members.me?.nickname || botUsername
        : botUsername;

      const systemPrompt = `You are a helpful and friendly Discord bot in this server. Your username is "${botUsername}" and your nickname here is "${botNickname}". When users mention you (e.g., @Gridgeist), they are addressing you directly. Always respond helpfully, conversationally, and do not simply repeat your name or confirm your identity unless specifically asked. If a user greets or mentions you, treat it as a prompt to assist them with their question or request.`;

      const history = conversationManager.getHistory(contextType, contextId);

      // Preprocess all messages in history and the current message
      const client = message.client;
      const processedHistory = await Promise.all(
        history.map(async (m) => {
          // If content is multimodal array, resolve text parts, keep images as-is
          if (Array.isArray(m.content)) {
            const parts = await Promise.all(
              m.content.map(async (part) => {
                if (part.type === "text") {
                  return {
                    ...part,
                    text: await resolveDiscordMentionsAndUrls(
                      part.text,
                      client
                    ),
                  };
                }
                return part;
              })
            );
            return {
              role: m.type === "bot" ? "assistant" : "user",
              content: parts,
            };
          } else {
            return {
              role: m.type === "bot" ? "assistant" : "user",
              content: await resolveDiscordMentionsAndUrls(m.content, client),
            };
          }
        })
      );
      const userContent = extractMultimodalContent(message);
      // Deduplicate: Remove the last message if it matches the current message
      let historyMessages = processedHistory;
      if (
        historyMessages.length > 0 &&
        historyMessages[historyMessages.length - 1].role === "user" &&
        JSON.stringify(historyMessages[historyMessages.length - 1].content) ===
          JSON.stringify(userContent)
      ) {
        historyMessages = historyMessages.slice(0, -1);
      }

      const aiRequest = {
        provider: config.defaultProvider,
        model: config.defaultModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        stream: false,
      };
      try {
        console.log(
          `[messageCreate] Calling AIClient.chat with request:`,
          aiRequest
        );
        const aiResponse = await AIClient.chat(aiRequest);
        console.log(`[messageCreate] AIClient.chat response:`, aiResponse);
        const aiReply = aiResponse.choices[0]?.message?.content?.trim();
        const cleanedReply = aiReply ? cleanAIResponse(aiReply) : null;
        if (cleanedReply) {
          console.log(`[messageCreate] Sending reply:`, cleanedReply);
          await message.reply(cleanedReply);
          // Add bot reply to memory
          const botMsg = {
            id: `${message.id}-bot`,
            authorId: message.client.user.id,
            authorName: message.client.user.username,
            channelId: message.channel.id,
            content: cleanedReply,
            timestamp: Date.now(),
            type: "bot",
          };
          await conversationManager.addMessage(
            "user",
            message.author.id,
            botMsg,
            message.channel,
            message.client.user.id,
            message.client
          );
        }
      } catch (err) {
        console.error("AI call failed:", err);
        await message.reply(
          "❌ AI call failed: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
      return;
    }

    // --- Server Handling ---
    // 1. Mention: treat as conversation
    if (message.mentions.has(message.client.user)) {
      // Build ConversationMessage for user
      const convoMsg = {
        id: message.id,
        authorId: message.author.id,
        authorName: message.author.username,
        channelId: message.channel.id,
        content: extractMultimodalContent(message),
        timestamp: Date.now(),
        type: "user",
      };
      await conversationManager.addMessage(
        contextType,
        contextId,
        convoMsg,
        message.channel,
        message.client.user.id,
        message.client
      );
      const botUsername = message.client.user.username;
      const botNickname = message.guild
        ? message.guild.members.me?.nickname || botUsername
        : botUsername;

      const systemPrompt = `You are a helpful and friendly Discord bot in this server. Your username is "${botUsername}" and your nickname here is "${botNickname}". When users mention you (e.g., @Gridgeist), they are addressing you directly. Always respond helpfully, conversationally, and do not simply repeat your name or confirm your identity unless specifically asked. If a user greets or mentions you, treat it as a prompt to assist them with their question or request.`;

      const history = conversationManager.getHistory(contextType, contextId);

      // Preprocess all messages in history and the current message
      const client = message.client;
      const processedHistory = await Promise.all(
        history.map(async (m) => {
          if (Array.isArray(m.content)) {
            const parts = await Promise.all(
              m.content.map(async (part) => {
                if (part.type === "text") {
                  return {
                    ...part,
                    text: await resolveDiscordMentionsAndUrls(
                      part.text,
                      client
                    ),
                  };
                }
                return part;
              })
            );
            return {
              role: m.type === "bot" ? "assistant" : "user",
              content: parts,
            };
          } else {
            return {
              role: m.type === "bot" ? "assistant" : "user",
              content: await resolveDiscordMentionsAndUrls(m.content, client),
            };
          }
        })
      );
      const userContent = extractMultimodalContent(message);
      // Deduplicate: Remove the last message if it matches the current message
      let historyMessages = processedHistory;
      if (
        historyMessages.length > 0 &&
        historyMessages[historyMessages.length - 1].role === "user" &&
        JSON.stringify(historyMessages[historyMessages.length - 1].content) ===
          JSON.stringify(userContent)
      ) {
        historyMessages = historyMessages.slice(0, -1);
      }

      const aiRequest = {
        provider: config.defaultProvider,
        model: config.defaultModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        stream: false,
      };
      try {
        const aiResponse = await AIClient.chat(aiRequest);
        const aiReply = aiResponse.choices[0]?.message?.content?.trim();
        const cleanedReply = aiReply ? cleanAIResponse(aiReply) : null;
        if (cleanedReply) {
          await message.reply(cleanedReply);
          // Add bot reply to memory
          const botMsg = {
            id: `${message.id}-bot`,
            authorId: message.client.user.id,
            authorName: message.client.user.username,
            channelId: message.channel.id,
            content: cleanedReply,
            timestamp: Date.now(),
            type: "bot",
          };
          await conversationManager.addMessage(
            "channel",
            message.channel.id,
            botMsg,
            message.channel,
            message.client.user.id,
            message.client
          );
        }
      } catch (err) {
        console.error("AI call failed:", err);
        await message.reply(
          "❌ AI call failed: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
      return;
    }

    // 2. Prefix: only if real command
    if (message.content.startsWith(PREFIX)) {
      const args = message.content.slice(PREFIX.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();
      const command = commands?.get(commandName);
      if (!command) return; // Only reply if real command

      // Build ConversationMessage for user
      const convoMsg = {
        id: message.id,
        authorId: message.author.id,
        authorName: message.author.username,
        channelId: message.channel.id,
        content: extractMultimodalContent(message),
        timestamp: Date.now(),
        type: "user",
      };
      await conversationManager.addMessage(
        contextType,
        contextId,
        convoMsg,
        message.channel,
        message.client.user.id,
        message.client
      );
      // Create a unique lock key for this message
      const lockKey = `msg_${message.id}`;
      await withExecutionLock(lockKey, async () => {
        const startTime = Date.now();
        try {
          logger.debug(
            `Processing prefix command: ${message.content} from user ${message.author.tag}`
          );
          // Add permission check here
          if (command.meta.permissions) {
            const requiredPerms = Array.isArray(command.meta.permissions)
              ? command.meta.permissions
              : [command.meta.permissions];
            const hasPermission = permissions(requiredPerms)(
              message,
              (reason) => {
                throw new Error(reason);
              }
            );
            if (!hasPermission) {
              return; // Error already thrown above
            }
          }
          logger.info(
            `Executing prefix command: ${commandName} from user: ${message.author.tag} (${message.author.id})`
          );
          await commandErrorHandler(async (message) => {
            const commandPromise = command.execute(message, { args });
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Command execution timeout")),
                30000
              )
            );
            await Promise.race([commandPromise, timeoutPromise]);
          }, commandName)(message);
          const executionTime = Date.now() - startTime;
          logger.info(
            `Prefix command ${commandName} completed successfully in ${executionTime}ms`
          );
        } catch (err) {
          const executionTime = Date.now() - startTime;
          logger.error(
            `Error executing prefix command for user ${message.author.tag}:`,
            err
          );
          logger.error(`Command execution time: ${executionTime}ms`);
          throw err;
        }
      });
      return;
    }
    // Otherwise, ignore
  }, "messageCreate"),
};

export default event;
