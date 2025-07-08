import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

// Command metadata interface
export interface CommandMeta {
  name: string;
  description: string;
  category?: string;
  usage?: string;
  examples?: string | string[];
  permissions?:
    | (keyof typeof PermissionFlagsBits)[]
    | keyof typeof PermissionFlagsBits;
  cooldown?: number;
  guildOnly?: boolean;
}

export type ModuleType = "single" | "multi" | "auto";

export interface Command {
  meta: {
    name: string;
    description: string;
    category?: string;
    permissions?: string[];
    usage?: string;
    examples?: string[];
    cooldown?: number;
    guildOnly?: boolean;
    [key: string]: any;
  };
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<any> | any;
}
