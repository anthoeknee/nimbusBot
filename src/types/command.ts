import { Client, ChatInputCommandInteraction, Message } from "discord.js";

// Command metadata interface
export interface CommandMeta {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  cooldown?: number;
  // Add more metadata fields as needed (e.g., options, permissions)
}

// Command execution signature
export interface Command {
  meta: CommandMeta;
  run: (
    client: Client,
    interactionOrContext: ChatInputCommandInteraction | { message: Message; args: string[] }
  ) => Promise<void>;
}

// Command context (customize as needed)
export interface CommandContext {
  message: any; // Replace 'any' with your Discord message type
  args: string[];
  client: any; // Replace 'any' with your Discord client type
}