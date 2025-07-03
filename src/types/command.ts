import { Client, ChatInputCommandInteraction, Message, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

// Command metadata interface
export interface CommandMeta {
  name: string;
  description: string;
  category?: string;
  usage?: string;
  examples?: string | string[];
  permissions?: (keyof typeof PermissionFlagsBits)[] | keyof typeof PermissionFlagsBits;
  cooldown?: number;
  aliases?: string[];
  // Add more metadata fields as needed (e.g., options, permissions)
}

export type ModuleType = "single" | "multi" | "auto";

export interface Command {
  meta: CommandMeta;
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction | Message, context?: { args?: string[] }) => Promise<void>;
}

// Command context (customize as needed)
export interface CommandContext {
  message: any; // Replace 'any' with your Discord message type
  args: string[];
  client: any; // Replace 'any' with your Discord client type
}