import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Guild,
  TextChannel,
  Message,
  GuildMember,
  Role,
} from "discord.js";
import { Command } from "../types/command";
import { commandErrorHandler } from "../middleware/errorHandler";
import { settings } from "../services/db";
import { VerificationConfig } from "../services/db/types";
import { database } from "../services/db";

const VERIFY_SETTING_KEY = "verification_config";

export const command: Command = {
  meta: {
    name: "verify",
    description: "Set up and manage server verification for new members.",
    category: "Admin",
    permissions: ["Administrator"],
    guildOnly: true,
    usage: "/verify <setup|disable|status>",
    examples: [
      "/verify setup channel:#verify role:@Member accept:✅ reject:❌",
      "/verify setup channel:#verify role:@Member accept:✅ reject:❌ message:123456789",
      "/verify disable",
      "/verify status",
    ],
  },
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Set up and manage server verification for new members.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Set up verification for this server.")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Verification channel")
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role to assign on verification")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("accept_emoji")
            .setDescription("Emoji for accept")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("reject_emoji")
            .setDescription("Emoji for reject")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription(
              "Message ID to use for verification (optional - bot creates new message if not provided)"
            )
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("kick_on_reject")
            .setDescription("Kick users who reject? (default: false)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Disable verification for this server.")
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Show current verification status.")
    ) as SlashCommandBuilder,

  execute: commandErrorHandler(
    async (interaction: ChatInputCommandInteraction) => {
      const sub = interaction.options.getSubcommand();
      const guild = interaction.guild;
      if (!guild)
        return interaction.reply({
          content: "❌ This command can only be used in a server.",
          ephemeral: true,
        });
      const guildId = guild.id;

      if (sub === "setup") {
        const channel = interaction.options.getChannel(
          "channel",
          true
        ) as TextChannel;
        const role = interaction.options.getRole("role", true) as Role;
        const acceptEmojiStr = interaction.options.getString("accept_emoji", true);
        const rejectEmojiStr = interaction.options.getString("reject_emoji", true);
        const kickOnReject =
          interaction.options.getBoolean("kick_on_reject") ?? false;
        const messageId = interaction.options.getString("message");

        let verifyMsg: Message;

        // If message ID is provided, try to fetch and use that message
        if (messageId) {
          try {
            verifyMsg = await channel.messages.fetch(messageId);
            // Clear existing reactions if any
            await verifyMsg.reactions.removeAll();
          } catch (error) {
            return interaction.reply({
              content: `❌ Could not find message with ID \`${messageId}\` in <#${channel.id}>. Make sure the message exists in the specified channel.`,
              ephemeral: true,
            });
          }
        } else {
          // Create a new verification message
          verifyMsg = await channel.send({
            content: `React with ${acceptEmojiStr} to verify and get access, or ${rejectEmojiStr} to reject.`,
          });
        }

        // Add reactions
        try {
          await verifyMsg.react(acceptEmojiStr);
          await verifyMsg.react(rejectEmojiStr);
        } catch (error) {
          console.error("Failed to react to verification message:", error);
          return interaction.reply({
            content: `❌ I couldn't use one of the emojis. Make sure I have permission to use external emojis if it's a custom one from another server.`,
            ephemeral: true,
          });
        }
        
        const parseEmoji = (emoji: string) => {
          if (emoji.startsWith("<") && emoji.endsWith(">")) {
            const id = emoji.match(/\d{15,}/)?.[0];
            return { id: id || null, name: emoji };
          }
          return { id: null, name: emoji };
        };

        const parsedAccept = parseEmoji(acceptEmojiStr);
        const parsedReject = parseEmoji(rejectEmojiStr);

        // Save config in settings
        const config: VerificationConfig = {
          enabled: true,
          channelId: channel.id,
          messageId: verifyMsg.id,
          acceptEmoji: parsedAccept.name,
          acceptEmojiId: parsedAccept.id,
          rejectEmoji: parsedReject.name,
          rejectEmojiId: parsedReject.id,
          roleId: role.id,
          kickOnReject,
          lastUpdated: new Date().toISOString(),
        };
        const guildRow = await database.guilds.findOrCreateByDiscordId(
          guildId,
          { name: guild.name, iconUrl: guild.iconURL() || undefined }
        );
        await settings.setSetting(
          VERIFY_SETTING_KEY,
          config,
          undefined,
          guildRow.id
        );
        await interaction.reply({
          content: `✅ Verification enabled in <#${channel.id}> ${
            messageId ? `using existing message` : `with new message`
          }.`,
          ephemeral: true,
        });
      } else if (sub === "disable") {
        const guildRow = await database.guilds.findOrCreateByDiscordId(
          guildId,
          { name: guild.name, iconUrl: guild.iconURL() || undefined }
        );
        // Remove config
        const config = await settings.getSettingValue<VerificationConfig>(
          VERIFY_SETTING_KEY,
          undefined,
          guildRow.id
        );
        if (config && config.channelId && config.messageId) {
          try {
            const channel = (await guild.channels.fetch(
              config.channelId
            )) as TextChannel;
            const msg = await channel.messages.fetch(config.messageId);
            // Only delete if it's a message the bot sent (check if bot is author)
            if (msg.author.id === interaction.client.user?.id) {
              await msg.delete();
            } else {
              // If it's not the bot's message, just remove reactions
              await msg.reactions.removeAll();
            }
          } catch {}
        }
        await settings.deleteBySetting(VERIFY_SETTING_KEY, undefined, guildRow.id);
        await interaction.reply({
          content: `�� Verification disabled.`,
          ephemeral: true,
        });
      } else if (sub === "status") {
        const guildRow = await database.guilds.findOrCreateByDiscordId(
          guildId,
          { name: guild.name, iconUrl: guild.iconURL() || undefined }
        );
        const config = await settings.getSettingValue<VerificationConfig>(
          VERIFY_SETTING_KEY,
          undefined,
          guildRow.id
        );
        if (!config || !config.enabled) {
          await interaction.reply({
            content: `Verification is not enabled.`,
            ephemeral: true,
          });
          return;
        }
        await interaction.reply({
          content: `Verification is enabled in <#${
            config.channelId
          }>. Accept: ${config.acceptEmoji}, Reject: ${
            config.rejectEmoji
          }, Role: <@&${config.roleId}>${
            config.kickOnReject ? ", Kicks on reject" : ""
          }`,
          ephemeral: true,
        });
      }
    }
  ),
};

export default command;
