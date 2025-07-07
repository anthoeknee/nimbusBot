import { Command } from "../types/command";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  Message,
} from "discord.js";
import { logger } from "../utils/logger";
import { commandErrorHandler } from "../middleware/errorHandler";

// Use Bun's performance.now() if available, otherwise fallback to Date.now()
const now = () =>
  typeof Bun !== "undefined" && Bun?.nanoseconds
    ? Bun.nanoseconds() / 1e6
    : Date.now();

export const command: Command = {
  meta: {
    name: "ping",
    description: "Replies with Pong and latency info!",
    category: "Utility",
    guildOnly: false,
  },
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription(
      "Replies with Pong and latency info!"
    ) as SlashCommandBuilder,
  execute: async (
    interactionOrMessage: ChatInputCommandInteraction | Message
  ) => {
    // If it's a slash command
    if (
      "isChatInputCommand" in interactionOrMessage &&
      interactionOrMessage.isChatInputCommand()
    ) {
      const interaction = interactionOrMessage;
      const startTime = Date.now();

      const userId = interaction.user?.id ?? "unknown";

      logger.info(`Ping command initiated by user ${userId}`);

      // Get WebSocket ping - show "N/A" if -1
      const wsPing = interaction.client.ws.ping;
      const wsPingDisplay = wsPing === -1 ? "N/A" : `${Math.round(wsPing)}ms`;

      logger.debug(`WebSocket ping: ${wsPingDisplay}`);

      // Helper to build the embed
      const buildEmbed = (apiLatency?: number, messageLatency?: number) =>
        new EmbedBuilder()
          .setTitle("\ud83c\udfcb\ufe0f\u200d♂️ Pong!")
          .setColor(0x00ff99)
          .addFields(
            { name: "WebSocket Ping", value: wsPingDisplay, inline: true },
            ...(apiLatency !== undefined
              ? [
                  {
                    name: "API Latency",
                    value: `${apiLatency}ms`,
                    inline: true,
                  },
                ]
              : []),
            ...(messageLatency !== undefined
              ? [
                  {
                    name: "Message Latency",
                    value: `${messageLatency}ms`,
                    inline: true,
                  },
                ]
              : [])
          )
          .setTimestamp();

      logger.debug(`Processing slash command ping for user ${userId}`);

      const apiStart = now();

      // Defer reply to prevent timeout
      await interaction.deferReply();

      const sent = await interaction.editReply({
        embeds: [buildEmbed()],
      });

      const apiLatency = Math.round(now() - apiStart);
      // @ts-ignore
      const messageLatency =
        sent.createdTimestamp - interaction.createdTimestamp;

      await interaction.editReply({
        embeds: [buildEmbed(apiLatency, messageLatency)],
      });

      logger.info(
        `Ping command completed for user ${userId} - API: ${apiLatency}ms, Message: ${messageLatency}ms`
      );

      const totalTime = Date.now() - startTime;
      logger.debug(`Total ping command execution time: ${totalTime}ms`);
    } else if ("reply" in interactionOrMessage) {
      // Fallback for prefix/message command
      await interactionOrMessage.reply("\ud83c\udfcb\ufe0f\u200d♂️ Pong!");
    }
  },
};

export default command;
