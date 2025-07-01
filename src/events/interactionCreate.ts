// src/events/interactionCreate.ts
import { Event } from "../types/event";
import { Command } from "../types/command";
import { Client, Interaction } from "discord.js";

const event: Event<"interactionCreate"> = {
  name: "interactionCreate",
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // @ts-ignore
    const commands: Map<string, Command> = interaction.client.commands;
    const command = commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      await interaction.reply({ content: `No command matching ${interaction.commandName} was found.`, ephemeral: true });
      return;
    }

    try {
      await command.run(interaction.client as Client, interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  },
};

export default event;