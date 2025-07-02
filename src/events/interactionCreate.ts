// src/events/interactionCreate.ts
import { Event } from "../types/event";
import { Command } from "../types/command";
import { Client, Interaction } from "discord.js";
import { logger } from "../utils/logger";

// Global execution lock to prevent multiple simultaneous executions
const executionLocks = new Map<string, Promise<any>>();

const event: Event<"interactionCreate"> = {
  name: "interactionCreate",
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Create a unique lock key for this interaction
    const lockKey = `int_${interaction.id}`;
          const startTime = Date.now();


    // If there's already an execution for this interaction, wait for it
    if (executionLocks.has(lockKey)) {
      logger.warn(`Duplicate interaction execution detected for ${lockKey}, waiting for existing execution`);
      await executionLocks.get(lockKey);
      return;
    }

    // Create a new execution promise
    const executionPromise = (async () => {
      try {
        const startTime = Date.now();
        
        logger.info(`Interaction received: ${interaction.commandName} from user ${interaction.user.tag} (${interaction.user.id})`);

        // @ts-ignore
        const commands: Map<string, Command> = interaction.client.commands;
        const command = commands.get(interaction.commandName);

        if (!command) {
          logger.error(`No command matching ${interaction.commandName} was found.`);
          
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: `❌ No command matching ${interaction.commandName} was found.`, 
              ephemeral: true 
            });
          }
          return;
        }

        logger.debug(`Executing command: ${interaction.commandName} for user ${interaction.user.tag}`);

        // Execute command with timeout protection
        const commandPromise = command.run(interaction.client as Client, interaction);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Command execution timeout')), 30000)
        );

        await Promise.race([commandPromise, timeoutPromise]);

        const executionTime = Date.now() - startTime;
        logger.info(`Command ${interaction.commandName} completed successfully in ${executionTime}ms`);

      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(`Error executing command ${interaction.commandName} for user ${interaction.user.tag}:`, error);
        logger.error(`Command execution time: ${executionTime}ms`);

        // Send error response
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: '❌ There was an error while executing this command! Please try again later.', 
              ephemeral: true 
            });
          } else {
            await interaction.followUp({ 
              content: '❌ There was an error while executing this command! Please try again later.', 
              ephemeral: true 
            });
          }
        } catch (replyError) {
          logger.error(`Failed to send error response for interaction ${interaction.id}:`, replyError);
        }
      }
    })();

    // Store the execution promise
    executionLocks.set(lockKey, executionPromise);

    try {
      await executionPromise;
    } finally {
      // Clean up the lock after execution
      executionLocks.delete(lockKey);
      
      // Clean up old locks periodically
      if (executionLocks.size > 100) {
        logger.debug(`Cleaning up execution locks, current size: ${executionLocks.size}`);
        for (const [key, promise] of executionLocks.entries()) {
          // Remove settled promises
          promise.catch(() => {}); // Handle any unhandled rejections
          executionLocks.delete(key);
        }
      }
    }
  },
};

export default event;