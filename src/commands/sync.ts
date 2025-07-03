// src/commands/sync.ts
import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  Message, 
  Guild 
} from "discord.js";
import { Command } from "../types/command";
import { commandErrorHandler } from "../middleware/errorHandler";
import type { MyCustomClient } from "../types/client"; // adjust path if needed

const command: Command = {
  meta: {
    name: "sync",
    description: "Sync slash commands to this server or globally.",
    category: "Utility",
    permissions: ["Administrator"],
    usage: "/sync [global]",
    examples: ["/sync", "/sync global", "gov!sync", "gov!sync global"],
    cooldown: 10
  },
  data: new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Sync slash commands to this server or globally.")
    .addStringOption(option =>
      option
        .setName("scope")
        .setDescription("Where to sync commands: 'guild' (default) or 'global'")
        .setRequired(false)
        .addChoices(
          { name: "Guild Only", value: "guild" },
          { name: "Global", value: "global" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  execute: commandErrorHandler(async (interactionOrMessage: ChatInputCommandInteraction | Message, context?: { args?: string[] }) => {
    // Permission check
    const member = "member" in interactionOrMessage ? interactionOrMessage.member : null;
    if (
      !member ||
      !("permissions" in member) ||
      typeof member.permissions !== "object" ||
      member.permissions === null ||
      typeof (member.permissions as any).has !== "function" ||
      !(member.permissions as any).has(PermissionFlagsBits.Administrator)
    ) {
      throw new Error("You do not have permission to use this command.");
    }

    // Determine scope
    let scope: "guild" | "global" = "guild";
    let guild: Guild | null = null;

    if ("guild" in interactionOrMessage && interactionOrMessage.guild) {
      guild = interactionOrMessage.guild;
    } else if ("guild" in interactionOrMessage && interactionOrMessage.guildId) {
      // For prefix commands
      guild = interactionOrMessage.client.guilds.cache.get(interactionOrMessage.guildId) || null;
    }

    // Parse option/argument
    if ("options" in interactionOrMessage && interactionOrMessage.options.getString) {
      const opt = interactionOrMessage.options.getString("scope");
      if (opt === "global") scope = "global";
    } else if (context?.args && context.args[0]) {
      if (context.args[0].toLowerCase() === "global") scope = "global";
    }

    let syncedCount = 0;
    if (scope === "guild" && guild) {
      // Sync to current guild
      const commands = (interactionOrMessage.client as MyCustomClient).commands;
      const data = Array.from(commands.values()).map(cmd => (cmd as Command).data.toJSON());
      await guild.commands.set(data);
      syncedCount = data.length;
      await interactionOrMessage.reply({
        content: `✅ Synced ${syncedCount} commands to this server (${guild.name}).`,
        ephemeral: true
      });
    } else if (scope === "global") {
      // Sync globally
      const commands = (interactionOrMessage.client as MyCustomClient).commands;
      const data = Array.from(commands.values()).map(cmd => (cmd as Command).data.toJSON());
      await interactionOrMessage.client.application?.commands.set(data);
      syncedCount = data.length;
      await interactionOrMessage.reply({
        content: `🌐 Synced ${syncedCount} commands globally. It may take up to 1 hour to update for all servers.`,
        ephemeral: true
      });
    } else {
      throw new Error("Could not determine where to sync commands.");
    }
  }, "sync"),
};

export default command;