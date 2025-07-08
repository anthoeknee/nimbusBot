import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config";
import { loadCommands, loadEvents } from "./utils/loader";
import { Command } from "./types/command";
import { serviceErrorHandler } from "./middleware/errorHandler";

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
    // Load commands and events
    const commands = await loadCommands();
    const events = await loadEvents();

    // Attach commands to client
    (client as any).commands = commands;

    // Register events
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

    // Login
    await client.login(config.discordToken);

    // Sync commands after login
    client.once("ready", async () => {
      try {
        await syncCommandsOnStartup();
        console.log("Command sync complete.");
      } catch (err) {
        console.error("Failed to sync commands on startup:", err);
      }
    });
  } catch (error) {
    console.error("Fatal error during bot startup:", error);
    process.exit(1);
  }
}

main();
