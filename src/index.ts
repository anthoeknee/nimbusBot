import { Client, Collection, GatewayIntentBits, ChatInputCommandInteraction, Message } from "discord.js";
import { config } from "./config";
import { loadCommands, loadEvents } from "./utils/loader";
import { database } from "./services/db";

export const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

async function main() {
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

  // Register events
  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  // Initialize and synchronize the database
  try {
    // Prisma does not require sync like Sequelize.
    // Optionally, you can do a test query to ensure connection:
    await database.users.count(); // Test connection
    console.log("Database connection successful.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }

  // Login
  await client.login(config.discordToken);
}

main();
