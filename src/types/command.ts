import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Command metadata interface
 */
export interface CommandMeta {
  name: string;
  description: string;
  category?: string;
  usage?: string;
  examples?: string | string[];
  permissions?: string[];
  cooldown?: number;
  aliases?: string[];
  guildOnly?: boolean;
}

/**
 * Command execution context for prefix commands
 */
export interface CommandContext {
  args?: string[];
}

/**
 * Main command interface
 */
export interface Command {
  meta: CommandMeta;
  data: SlashCommandBuilder;
  execute: (
    interaction: ChatInputCommandInteraction | Message,
    context?: CommandContext,
  ) => Promise<void>;
}
