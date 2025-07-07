import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
} from "discord.js";

export interface Command {
  meta: {
    name: string;
    description: string;
    category?: string;
    usage?: string;
    examples?: string | string[];
    permissions?: string[];
    cooldown?: number;
    aliases?: string[];
    guildOnly?: boolean;
  };
  data: SlashCommandBuilder;
  execute: (
    interaction: ChatInputCommandInteraction | Message,
    context?: { args?: string[] }
  ) => Promise<void>;
}
