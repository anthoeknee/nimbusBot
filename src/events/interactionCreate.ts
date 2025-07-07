// src/events/interactionCreate.ts
import { Event } from "../types/event";
import { Command } from "../types/command";
import { Client, Interaction, MessageFlags } from "discord.js";
import { logger } from "../utils/logger";
import { handleModalSubmit } from "../services/codeEditor";

const event: Event<"interactionCreate"> = {
  name: "interactionCreate",
  execute: async (interaction: Interaction) => {
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      try {
        await handleModalSubmit(interaction);
        return;
      } catch (error) {
        logger.error("Modal submit error:", error);
        await interaction.reply({
          content: "❌ An error occurred while processing your request.",
          ephemeral: true,
        });
        return;
      }
    }

    // Handle chat input commands
    if (!interaction.isChatInputCommand()) return;

    // Get the command from the client
    // @ts-ignore
    const commands: Map<string, Command> = interaction.client.commands;
    const command = commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({
        content: `❌ No command matching ${interaction.commandName} was found.`,
        ephemeral: true,
      });
      return;
    }
    // Execute the command (pipeline is already applied)
    await command.execute(interaction);
  },
};

export default event;
