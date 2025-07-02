import { Message, Client, ClientEvents } from "discord.js";
import { Event } from "../types/event";
import { Command } from "../types/command";
import { logger } from "../utils/logger";

const PREFIX = "gov!";

// Global execution lock to prevent multiple simultaneous executions
const executionLocks = new Map<string, Promise<any>>();

const event: Event<"messageCreate"> = {
  name: "messageCreate",
  async execute(message: Message) {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check for prefix
    if (!message.content.startsWith(PREFIX)) return;

    // Create a unique lock key for this message
    const lockKey = `msg_${message.id}`;
    
    // If there's already an execution for this message, wait for it
    if (executionLocks.has(lockKey)) {
      logger.warn(`Duplicate message execution detected for ${lockKey}, waiting for existing execution`);
      await executionLocks.get(lockKey);
      return;
    }

    // Create a new execution promise
    const executionPromise = (async () => {
      const startTime = Date.now();
      
      try {
        logger.debug(`Processing prefix command: ${message.content} from user ${message.author.tag}`);

        // Extract command name and arguments
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();
        if (!commandName) {
          logger.debug(`No command name found in message: ${message.content}`);
          return;
        }

        // Access the commands map attached to the client
        // @ts-ignore
        const commands: Map<string, Command> = message.client.commands;
        const command = commands?.get(commandName);
        
        if (!command) {
          logger.debug(`Unknown command: ${commandName} from user ${message.author.tag}`);
          return;
        }

        logger.info(`Executing prefix command: ${commandName} from user: ${message.author.tag} (${message.author.id})`);

        // Execute command with timeout protection
        const commandPromise = command.run(message.client as Client, {
          message,
          args,
          client: message.client
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Command execution timeout')), 30000)
        );

        await Promise.race([commandPromise, timeoutPromise]);

        const executionTime = Date.now() - startTime;
        logger.info(`Prefix command ${commandName} completed successfully in ${executionTime}ms`);

      } catch (err) {
        const executionTime = Date.now() - startTime;
        logger.error(`Error executing prefix command for user ${message.author.tag}:`, err);
        logger.error(`Command execution time: ${executionTime}ms`);

        // Send error response
        try {
          await message.reply("❌ There was an error executing that command. Please try again later.");
        } catch (replyError) {
          logger.error(`Failed to send error response for message ${message.id}:`, replyError);
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
  }
};

export default event;