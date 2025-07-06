// src/commands/sync.ts
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Message,
  Guild,
  MessageFlags,
} from "discord.js";
import { Command } from "../types/command";
import { commandErrorHandler } from "../middleware/errorHandler";
import type { MyCustomClient } from "../types/client"; // adjust path if needed
import { permissions } from "../middleware/permissions";

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
          { name: "Global", value: "global" },
        ),
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator,
    ) as SlashCommandBuilder,

  execute: commandErrorHandler(
    async (
      interactionOrMessage: ChatInputCommandInteraction | Message,
      context?: { args?: string[] },
    ) => {
      // Use permissions middleware for permission check (supports owner bypass)
      permissions(["Administrator"])(interactionOrMessage);

      // Defer reply if this is an interaction (to prevent timeout)
      const isInteraction =
        typeof interactionOrMessage.isRepliable === "function" &&
        interactionOrMessage.isRepliable();
      if (
        isInteraction &&
        !interactionOrMessage.deferred &&
        !interactionOrMessage.replied
      ) {
        await interactionOrMessage.deferReply({
          flags: MessageFlags.Ephemeral,
        });
      }

      // Determine scope
      let scope: "guild" | "global" = "guild";
      let guild: Guild | null = null;

      // --- DM Owner Global Sync Support ---
      const isDM =
        ("guildId" in interactionOrMessage && !interactionOrMessage.guildId) ||
        ("guild" in interactionOrMessage && !interactionOrMessage.guild);
      const userId =
        "user" in interactionOrMessage && interactionOrMessage.user
          ? interactionOrMessage.user.id
          : "author" in interactionOrMessage && interactionOrMessage.author
            ? interactionOrMessage.author.id
            : undefined;
      if (isDM && userId && userId === process.env.BOT_OWNER_ID) {
        scope = "global";
      } else {
        if ("guild" in interactionOrMessage && interactionOrMessage.guild) {
          guild = interactionOrMessage.guild;
        } else if (
          "guild" in interactionOrMessage &&
          interactionOrMessage.guildId
        ) {
          // For prefix commands
          guild =
            interactionOrMessage.client.guilds.cache.get(
              interactionOrMessage.guildId,
            ) || null;
        }
      }

      // Parse option/argument
      if (
        "options" in interactionOrMessage &&
        interactionOrMessage.options.getString
      ) {
        const opt = interactionOrMessage.options.getString("scope");
        if (opt === "global") scope = "global";
      } else if (context?.args && context.args[0]) {
        if (context.args[0].toLowerCase() === "global") scope = "global";
      }

      let syncedCount = 0;
      const commands = (interactionOrMessage.client as MyCustomClient).commands;
      const globalCommands = Array.from(commands.values()).filter(
        (cmd) => !cmd.meta.guildOnly,
      );
      const guildCommands = Array.from(commands.values()).filter(
        (cmd) => cmd.meta.guildOnly,
      );

      console.log(
        "Global commands to register:",
        globalCommands.map((cmd) => cmd.meta.name),
      );

      if (scope === "guild" && guild) {
        // Register only guild-only commands for this guild
        const data = guildCommands.map((cmd) => cmd.data.toJSON());
        await guild.commands.set(data);
        syncedCount = data.length;
        if (isInteraction) {
          await interactionOrMessage.editReply({
            content: `✅ Synced ${syncedCount} commands to this server (${guild.name}).`,
          });
        } else {
          await interactionOrMessage.reply({
            content: `✅ Synced ${syncedCount} commands to this server (${guild.name}).`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (scope === "global") {
        // Register only global commands
        const data = globalCommands.map((cmd) => cmd.data.toJSON());
        await interactionOrMessage.client.application?.commands.set(data);
        syncedCount = data.length;
        if (isInteraction) {
          await interactionOrMessage.editReply({
            content: `🌐 Synced ${syncedCount} commands globally. It may take up to 1 hour to update for all servers.`,
          });
        } else {
          await interactionOrMessage.reply({
            content: `🌐 Synced ${syncedCount} commands globally. It may take up to 1 hour to update for all servers.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else {
        throw new Error("Could not determine where to sync commands.");
      }
    },
    "sync",
  ),
};

export default command;
