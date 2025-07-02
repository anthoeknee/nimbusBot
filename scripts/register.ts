// scripts/registerCommands.ts
import { REST, Routes } from "discord.js";
import { config } from "../src/config";
import { loadCommands } from "../src/utils/loader";

async function main() {
  const commands = await loadCommands();
  const commandsData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  // Register globally (may take up to 1 hour to update)
  await rest.put(
    Routes.applicationCommands("1345225702131372062"),
    { body: commandsData }
  );

  // For development, register to a guild for instant update:
  // await rest.put(
  //   Routes.applicationGuildCommands("YOUR_CLIENT_ID", "YOUR_GUILD_ID"),
  //   { body: commandsData }
  // );

  console.log("Slash commands registered!");
}

main().catch(console.error);