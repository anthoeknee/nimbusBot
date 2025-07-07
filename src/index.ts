import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config";
import { loadCommands, loadEvents } from "./utils/loader";
import { database } from "./services/db";
import { initializeMemorySystem } from "./services/ai/memory";
import { Command } from "./types/command";
import { serviceErrorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";
import { logMemorySystemStatus } from "./utils/validateMemorySystem";
import {
  decideMemoryAction,
  analyzeConversationContext,
  analyzeTemporalPatterns,
} from "./memory/decision";

export interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
}

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
  ],
}) as ExtendedClient;

client.commands = new Collection();

async function syncCommandsOnStartup() {
  const commands = client.commands;
  if (!commands || commands.size === 0) {
    console.warn("No commands loaded to sync.");
    return;
  }

  // Split commands into global and guild-only
  const globalCommands = Array.from(commands.values()).filter(
    (cmd) => !cmd.meta.guildOnly
  );
  const guildCommands = Array.from(commands.values()).filter(
    (cmd) => cmd.meta.guildOnly
  );

  // Register global commands
  if (globalCommands.length > 0) {
    await client.application?.commands.set(
      globalCommands.map((cmd) => cmd.data.toJSON())
    );
    console.log(`Synced ${globalCommands.length} global commands.`);
  }

  // Register guild-only commands for each guild
  if (guildCommands.length > 0) {
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set(guildCommands.map((cmd) => cmd.data.toJSON()));
      console.log(
        `Synced ${guildCommands.length} guild-only commands for guild ${guild.name} (${guild.id})`
      );
    }
  }
}

async function main() {
  try {
    logger.info("Starting bot initialization...");

    // Load commands and events
    const commands = await loadCommands();
    const events = await loadEvents();

    // Attach commands to client
    client.commands = commands;

    // Register events with error handling
    for (const event of events) {
      if (event.once) {
        client.once(
          event.name,
          serviceErrorHandler((...args) => event.execute(...args), event.name)
        );
      } else {
        client.on(
          event.name,
          serviceErrorHandler((...args) => event.execute(...args), event.name)
        );
      }
    }

    // Initialize database
    await serviceErrorHandler(async () => {
      database.initialize();
      await database.healthCheck();
      logger.info("Database initialized successfully");
    }, "database")();

    // Initialize enhanced memory system
    await serviceErrorHandler(async () => {
      const { db } = await import("./services/db/client");
      await initializeMemorySystem(db);
      logger.info("Enhanced memory system initialized successfully");
    }, "memory-system")();

    // Validate memory system
    await serviceErrorHandler(async () => {
      await logMemorySystemStatus();
    }, "memory-validation")();

    // Login to Discord
    await client.login(config.discordToken);

    // Auto-sync commands after ready
    client.once("ready", async () => {
      try {
        await syncCommandsOnStartup();
        logger.info("Bot startup complete!");
      } catch (err) {
        logger.error("Failed to sync commands on startup:", err);
      }
    });
  } catch (error) {
    logger.error("Fatal error during bot startup:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions and unhandled rejections
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

main();
