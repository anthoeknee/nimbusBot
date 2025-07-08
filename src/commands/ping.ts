import { Command } from "../types/command";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

const command: Command = {
  meta: {
    name: "ping",
    description: "Replies with Pong!",
    category: "Utility",
    guildOnly: false,
  },
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.reply("🏓 Pong!");
  },
};

export default command;
