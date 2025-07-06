import { Client } from "discord.js";
import {
  Channel,
  TextBasedChannel,
  Message,
  User,
  PartialGroupDMChannel,
  DMChannel,
  NewsChannel,
  TextChannel,
  GuildTextBasedChannel,
  ThreadChannel,
  Collection,
} from "discord.js";
import { ConversationMessage } from "../../types/ai";

/**
 * Resolves Discord mentions and URLs in a message to human-readable names.
 * - User mentions: <@1234567890> → @username
 * - Channel mentions: <#0987654321> → #channelname
 * - Message URLs: https://discord.com/channels/guild/channel/message → [Message by @username: "content"]
 *
 * @param content The message content to process
 * @param client The Discord.js client instance
 * @returns The processed content with resolved mentions/URLs
 */
export async function resolveDiscordMentionsAndUrls(
  content: string,
  client: Client,
): Promise<string> {
  // Collect all matches first (since .replace with async is tricky)
  const userMentionRegex = /<@!?(\d+)>/g;
  const channelMentionRegex = /<#(\d+)>/g;
  const messageUrlRegex =
    /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g;
  // TODO: Add role mention and server/channel URL regexes

  // User mentions
  const userIds = Array.from(content.matchAll(userMentionRegex)).map(
    (m) => m[1],
  );
  const userMap: Record<string, string> = {};
  for (const userId of userIds) {
    if (!userMap[userId]) {
      try {
        const user = await client.users.fetch(userId);
        userMap[userId] = `@${user.username}`;
      } catch {
        userMap[userId] = `<@${userId}>`;
      }
    }
  }

  // Channel mentions
  const channelIds = Array.from(content.matchAll(channelMentionRegex)).map(
    (m) => m[1],
  );
  const channelMap: Record<string, string> = {};
  for (const channelId of channelIds) {
    if (!channelMap[channelId]) {
      try {
        const channel = await client.channels.fetch(channelId);
        // @ts-ignore
        channelMap[channelId] = `#${channel.name || channel.id}`;
      } catch {
        channelMap[channelId] = `<#${channelId}>`;
      }
    }
  }

  // Message URLs
  const messageUrlMatches = Array.from(content.matchAll(messageUrlRegex));
  const messageUrlMap: Record<string, string> = {};
  for (const match of messageUrlMatches) {
    const [full, guildId, channelId, messageId] = match;
    const key = full;
    try {
      const channel = await client.channels.fetch(channelId);
      // @ts-ignore
      const message = await channel.messages.fetch(messageId);
      messageUrlMap[key] =
        `[Message by @${message.author.username}: "${message.content}"]`;
    } catch {
      messageUrlMap[key] = full;
    }
  }

  // Replace in content
  let processed = content;
  processed = processed.replace(
    userMentionRegex,
    (_, userId) => userMap[userId] || `<@${userId}>`,
  );
  processed = processed.replace(
    channelMentionRegex,
    (_, channelId) => channelMap[channelId] || `<#${channelId}>`,
  );
  processed = processed.replace(
    messageUrlRegex,
    (full) => messageUrlMap[full] || full,
  );

  // TODO: Role mentions, server/channel URLs, etc.

  return processed;
}

/**
 * Fetches the last 35 relevant messages for short-term memory.
 * - In guilds: excludes bots and commands (g!), and application commands.
 * - In DMs/group DMs: includes only the user(s) and the bot, excludes commands.
 * - Excludes both the command message and the bot's response if present.
 * @param channel The Discord.js channel object
 * @param botUserId The bot's user ID
 * @param client The Discord.js client instance
 * @param commandPrefix The command prefix to exclude (e.g., 'g!')
 * @returns Promise<ConversationMessage[]>
 */
export async function fetchShortTermMemoryHistory(
  channel: TextBasedChannel,
  botUserId: string,
  client: Client,
  commandPrefix: string = "g!",
): Promise<ConversationMessage[]> {
  console.log(
    `[fetchShortTermMemoryHistory] Channel type: ${channel.type}, Channel ID: ${channel.id}`,
  );
  // Fetch more than 35 to allow for filtering
  const fetched = await channel.messages.fetch({ limit: 50 });
  const messages = Array.from(fetched.values()).sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp,
  ); // oldest to newest

  // Determine channel type
  const isDM = channel.type === 1 || channel.type === "DM";
  const isGroupDM = channel.type === 3 || channel.type === "GROUP_DM";
  const isGuild = !isDM && !isGroupDM;

  // For DMs/group DMs, get allowed user IDs
  let allowedUserIds: Set<string> | null = null;
  if (isDM) {
    // @ts-ignore
    const userId =
      channel.recipient?.id ||
      messages.find((m) => m.author.id !== botUserId)?.author.id;
    allowedUserIds = new Set([botUserId, userId]);
  } else if (isGroupDM) {
    // @ts-ignore
    const recipients = channel.recipients
      ? Array.from(channel.recipients.keys())
      : [];
    allowedUserIds = new Set([botUserId, ...recipients]);
  }

  // Helper: is application command
  function isApplicationCommand(msg: Message) {
    // Discord.js v14+ sets interaction property for application commands
    // Also check if msg.content is empty and msg.interaction exists
    // (slash commands, context menu, etc.)
    // @ts-ignore
    return (
      !!msg.interaction ||
      (msg.content === "" && !!msg.author && !msg.webhookId)
    );
  }

  // Filter messages
  let filtered = messages.filter((msg) => {
    // Exclude bots in guilds
    if (isGuild && msg.author.bot) return false;
    // In DMs/group DMs, only allow user(s) and bot
    if (allowedUserIds && !allowedUserIds.has(msg.author.id)) return false;
    // Exclude commands (g!)
    if (msg.content && msg.content.trim().startsWith(commandPrefix))
      return false;
    // Exclude application commands (slash, context menu, etc.)
    if (isApplicationCommand(msg)) return false;
    return true;
  });

  // Remove both the command that triggered the response and the bot's response itself if present (last two messages)
  // This is to avoid echoing the current interaction
  if (filtered.length >= 2) {
    const last = filtered[filtered.length - 1];
    const secondLast = filtered[filtered.length - 2];
    // If last is bot and secondLast is user, and they are close in time, remove both
    if (
      last.author.id === botUserId &&
      secondLast.author.id !== botUserId &&
      last.createdTimestamp - secondLast.createdTimestamp < 15000 // 15s window
    ) {
      filtered = filtered.slice(0, -2);
    }
  }

  // Take the last 35
  filtered = filtered.slice(-35);

  console.log(
    `[fetchShortTermMemoryHistory] Fetched ${messages.length} messages, filtered to ${filtered.length}`,
  );

  // Map to ConversationMessage
  return filtered.map((msg) => ({
    id: msg.id,
    authorId: msg.author.id,
    authorName: msg.author.username,
    channelId: msg.channel.id,
    content: msg.content,
    timestamp: msg.createdTimestamp,
    type: msg.author.id === botUserId ? "bot" : "user",
    metadata: {},
  }));
}

/**
 * Cleans AI model output by removing special header/footer tokens and excessive whitespace.
 * @param text The raw AI output
 * @returns The cleaned string
 */
export function cleanAIResponse(text: string): string {
  return text
    .replace(/<\|header_start\|>.*?<\|header_end\|>/gs, "") // Remove header blocks
    .replace(/<\|header_start\|>/g, "")
    .replace(/<\|header_end\|>/g, "")
    .replace(/<\|.*?\|>/g, "") // Remove any other <|...|> tokens
    .replace(/^\s*[\r\n]/gm, "") // Remove empty lines
    .trim();
}
