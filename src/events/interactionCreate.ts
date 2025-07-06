// src/events/interactionCreate.ts
import { Event } from "../types/event";
import { Command } from "../types/command";
import { Client, Interaction, MessageFlags } from "discord.js";
import { logger } from "../utils/logger";
import {
  eventErrorHandler,
  commandErrorHandler,
} from "../middleware/errorHandler";
import { handleModalSubmit } from "../services/codeEditor";
import { permissions } from "../middleware/permissions";
import { withExecutionLock } from "./helpers/executionLock";

const event: Event<"interactionCreate"> = {
  name: "interactionCreate",
  execute: eventErrorHandler(async (interaction: Interaction) => {
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

    // Create a unique lock key for this interaction
    const lockKey = `int_${interaction.id}`;
    const startTime = Date.now();

    // Use execution lock helper to ensure only one execution per interaction
    await withExecutionLock(lockKey, async () => {
      try {
        logger.info(
          `Interaction received: ${interaction.commandName} from user ${interaction.user.tag} (${interaction.user.id})`
        );

        // @ts-ignore
        const commands: Map<string, Command> = interaction.client.commands;
        const command = commands.get(interaction.commandName);

        if (!command) {
          throw new Error(
            `No command matching ${interaction.commandName} was found.`
          );
        }

        // Add permission check here
        if (command.meta.permissions) {
          const requiredPerms = Array.isArray(command.meta.permissions)
            ? command.meta.permissions
            : [command.meta.permissions];

          const hasPermission = permissions(requiredPerms)(
            interaction,
            (reason) => {
              throw new Error(reason);
            }
          );

          if (!hasPermission) {
            return; // Error already thrown above
          }
        }

        logger.debug(
          `Executing command: ${interaction.commandName} for user ${interaction.user.tag}`
        );

        // Execute command with enhanced error handling
        await commandErrorHandler(async (interaction) => {
          const commandPromise = command.execute(interaction);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Command execution timeout")),
              30000
            )
          );

          await Promise.race([commandPromise, timeoutPromise]);
        }, interaction.commandName)(interaction);

        const executionTime = Date.now() - startTime;
        logger.info(
          `Command ${interaction.commandName} completed successfully in ${executionTime}ms`
        );
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(
          `Error executing command ${interaction.commandName} for user ${interaction.user.tag}:`,
          error
        );
        logger.error(`Command execution time: ${executionTime}ms`);

        // The enhanced error handler will handle the user response
        throw error; // Re-throw to let the event error handler deal with it
      }
    });
  }, "interactionCreate"),
};

export default event;
