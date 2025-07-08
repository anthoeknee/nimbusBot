// src/commands/sync.ts
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Message,
  Guild,
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
    cooldown: 10,
    guildOnly: false,
  },
  data: new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Sync slash commands to this server or globally.")
    .addStringOption((option) =>
      option
        .setName("scope")
        .setDescription("Where to sync commands: 'guild' (default) or 'global'")
        .setRequired(false)
        .addChoices(
          { name: "Guild Only", value: "guild" },
          { name: "Global", value: "global" }
        )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ) as SlashCommandBuilder,

  execute: commandErrorHandler(
    async (interaction: ChatInputCommandInteraction) => {
      // Permission check
      const member = interaction.member;
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

      if (interaction.guild) {
        guild = interaction.guild;
      }

      // Parse option/argument
      const opt = interaction.options.getString("scope");
      if (opt === "global") scope = "global";

      let syncedCount = 0;
      const commands = (interaction.client as MyCustomClient).commands;
      const globalCommands = Array.from(commands.values()).filter(
        (cmd) => !cmd.meta.guildOnly
      );
      const guildCommands = Array.from(commands.values()).filter(
        (cmd) => cmd.meta.guildOnly
      );

      console.log(
        "Global commands to register:",
        globalCommands.map((cmd) => cmd.meta.name)
      );

      if (scope === "guild" && guild) {
        // Register only guild-only commands for this guild
        const data = guildCommands.map((cmd) => cmd.data.toJSON());
        await guild.commands.set(data);
        syncedCount = data.length;
        await interaction.reply({
          content: `✅ Synced ${syncedCount} commands to this server (${guild.name}).`,
          ephemeral: true,
        });
      } else if (scope === "global") {
        // Register only global commands
        const data = globalCommands.map((cmd) => cmd.data.toJSON());
        await interaction.client.application?.commands.set(data);
        syncedCount = data.length;
        await interaction.reply({
          content: `🌐 Synced ${syncedCount} commands globally. It may take up to 1 hour to update for all servers.`,
          ephemeral: true,
        });
      } else {
        throw new Error("Could not determine where to sync commands.");
      }
    },
    "sync"
  ),
};

export default command;
