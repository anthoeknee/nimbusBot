import { Client, Collection, GatewayIntentBits, ChatInputCommandInteraction, Message } from "discord.js";
import { config } from "./config";
import { loadCommands, loadEvents } from "./utils/loader";
import { database } from "./services/db";
import { Command } from "./types/command";
import { serviceErrorHandler } from "./middleware/errorHandler";

export interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
}
// testing 
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    // ...add any other intents you need
  ]
}) as ExtendedClient;

client.commands = new Collection();

async function main() {
  try {
    // Load commands and events
    const commands = await loadCommands();
    const events = await loadEvents();

    // List loaded commands
    console.log("Loaded commands:");
    for (const [name] of commands) {
      console.log(`- ${name}`);
    }

    // List loaded events
    console.log("Loaded events:");
    for (const event of events) {
      console.log(`- ${event.name}`);
    }

    // Attach commands to client for easy access
    (client as any).commands = commands;

    // Register events with enhanced error handling
    for (const event of events) {
      if (event.once) {
        client.once(event.name, serviceErrorHandler((...args) => event.execute(...args), event.name));
      } else {
        client.on(event.name, serviceErrorHandler((...args) => event.execute(...args), event.name));
      }
    }

    // Initialize and synchronize the database with enhanced error handling
    await serviceErrorHandler(async () => {
      // Prisma does not require sync like Sequelize.
      // Optionally, you can do a test query to ensure connection:
      await database.users.count(); // Test connection
      console.log("Database connection successful.");
    }, "database")();

    // Initialize database
    database.initialize();

    // Login
    await client.login(config.discordToken);
  } catch (error) {
    console.error("Fatal error during bot startup:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();