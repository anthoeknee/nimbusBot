import { Client, ChatInputCommandInteraction, Message, SlashCommandBuilder } from "discord.js";

// Command metadata interface
export interface CommandMeta {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  cooldown?: number;
  // Add more metadata fields as needed (e.g., options, permissions)
}


export interface Command {
  meta: {
    name: string;
    description: string;
    category?: string;
    examples?: string | string[];
    permissions?: string | string[];
    cooldown?: number;
  };
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// Command context (customize as needed)
export interface CommandContext {
  message: any; // Replace 'any' with your Discord message type
  args: string[];
  client: any; // Replace 'any' with your Discord client type
}