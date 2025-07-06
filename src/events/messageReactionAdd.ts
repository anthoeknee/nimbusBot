import { Event } from "../types/event";
import { database, settings } from "../services/db";
import { VerificationConfig } from "../services/db/types";
import {
  MessageReaction,
  User,
  GuildMember,
  TextChannel,
  PermissionsBitField,
} from "discord.js";
import { logger } from "../utils/logger";
import { sendDM } from "./helpers/dm";

const VERIFY_SETTING_KEY = "verification_config";

const event: Event<"messageReactionAdd"> = {
  name: "messageReactionAdd",
  once: false,
  execute: async (reaction: MessageReaction, user: User) => {
    logger.info(
      "messageReactionAdd fired",
      reaction.emoji.name,
      reaction.emoji.id,
      reaction.message.id,
      user.id,
    );

    try {
      // --- Fetch partials if needed ---
      if (reaction.partial)
        await reaction
          .fetch()
          .catch((e) => logger.warn("Failed to fetch reaction partial:", e));
      if (reaction.message.partial)
        await reaction.message
          .fetch()
          .catch((e) => logger.warn("Failed to fetch message partial:", e));
      if (user.partial)
        await user
          .fetch()
          .catch((e) => logger.warn("Failed to fetch user partial:", e));

      if (user.bot) return;
      const guild = reaction.message.guild;
      if (!guild) return;
      const discordGuildId = guild.id;

      const guildRow = await database.guilds.findByDiscordId(discordGuildId);
      if (!guildRow) return;

      const config = await settings.getSettingValue<VerificationConfig>(
        VERIFY_SETTING_KEY,
        undefined,
        guildRow.id,
      );
      if (!config || !config.enabled) return;
      if (reaction.message.id !== config.messageId) return;

      // --- Robust emoji matching (custom and Unicode) ---
      const emoji = reaction.emoji;
      const matchEmoji = (
        emojiObj: typeof emoji,
        configName: string,
        configId?: string,
      ) => {
        if (configId) {
          return emojiObj.id === configId;
        } else {
          return emojiObj.name === configName;
        }
      };
      const isAccept = matchEmoji(
        emoji,
        config.acceptEmoji,
        (config as any).acceptEmojiId,
      );
      const isReject = matchEmoji(
        emoji,
        config.rejectEmoji,
        (config as any).rejectEmojiId,
      );
      logger.info("Emoji match results:", { isAccept, isReject });
      if (!isAccept && !isReject) return;

      // --- Fetch the GuildMember ---
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        logger.warn(`Could not fetch GuildMember for user ${user.id}`);
        return;
      }

      // --- Get bot's member and permissions ---
      const botMember = guild.members.me;
      if (!botMember) {
        logger.error("Bot member not found in guild");
        return;
      }

      const targetRole = guild.roles.cache.get(config.roleId);
      if (!targetRole) {
        logger.error(`Target role ${config.roleId} not found in guild`);
        return;
      }

      // --- Accept: Add role ---
      if (isAccept) {
        // Check bot permissions
        const canManageRoles = botMember.permissions.has(
          PermissionsBitField.Flags.ManageRoles,
        );
        const botHighest = botMember.roles.highest.position;
        const targetRolePos = targetRole.position;
        if (!canManageRoles) {
          logger.error("Bot lacks ManageRoles permission");
        }
        if (targetRolePos >= botHighest) {
          logger.error("Target role is higher or equal to bot's highest role");
        }
        if (!canManageRoles || targetRolePos >= botHighest) {
          // Inform channel
          const channel = reaction.message.channel as TextChannel;
          if (channel?.isTextBased()) {
            try {
              await channel.send(
                `❌ I don't have permission to assign the verification role. Please check my permissions and role position.`,
              );
            } catch {}
          }
          // Optionally DM user
          await sendDM(
            user,
            `❌ Sorry, I couldn't assign you the verification role in **${guild.name}** due to missing permissions. Please contact a server admin.`,
          );
          return;
        }
        // Try to add role
        try {
          await member.roles.add(targetRole, "Verification accepted");
          logger.info(`Role ${targetRole.id} added to user ${user.id}`);
          // Optionally DM user
          await sendDM(
            user,
            `✅ You have been verified and given access in **${guild.name}**! Welcome!`,
          );
        } catch (err) {
          logger.error(`Failed to add role:`, err);
          // Inform channel
          const channel = reaction.message.channel as TextChannel;
          if (channel?.isTextBased()) {
            try {
              await channel.send(
                `❌ Failed to assign role to <@${user.id}>. Please check bot permissions.`,
              );
            } catch {}
          }
          // Optionally DM user
          await sendDM(
            user,
            `❌ Sorry, I couldn't assign you the verification role in **${guild.name}**. Please contact a server admin.`,
          );
        }
      }
      // --- Reject: Kick if enabled ---
      else if (isReject) {
        if (config.kickOnReject) {
          // Check bot permissions
          const canKick = botMember.permissions.has(
            PermissionsBitField.Flags.KickMembers,
          );
          const botHighest = botMember.roles.highest.position;
          const memberHighest = member.roles.highest.position;
          if (!canKick) {
            logger.error("Bot lacks KickMembers permission");
          }
          if (botHighest <= memberHighest) {
            logger.error("Bot's highest role is not higher than the member's");
          }
          if (!canKick || botHighest <= memberHighest) {
            // Inform channel
            const channel = reaction.message.channel as TextChannel;
            if (channel?.isTextBased()) {
              try {
                await channel.send(
                  `❌ I don't have permission to kick <@${user.id}>. Please check my permissions and role position.`,
                );
              } catch {}
            }
            // Optionally DM user
            await sendDM(
              user,
              `❌ You were not verified in **${guild.name}**, but I couldn't remove you due to missing permissions. Please contact a server admin.`,
            );
            return;
          }
          // Try to kick
          try {
            await member.kick("Rejected verification");
            logger.info(`User ${user.id} kicked for rejecting verification`);
            // Optionally DM user (may not deliver if kicked)
            await sendDM(
              user,
              `❌ You have been removed from **${guild.name}** for rejecting verification. If this was a mistake, you may rejoin and try again.`,
            );
          } catch (err) {
            logger.error(`Failed to kick user:`, err);
            // Inform channel
            const channel = reaction.message.channel as TextChannel;
            if (channel?.isTextBased()) {
              try {
                await channel.send(
                  `❌ Failed to kick <@${user.id}>. Please check bot permissions.`,
                );
              } catch {}
            }
            // Optionally DM user
            await sendDM(
              user,
              `❌ I tried to remove you from **${guild.name}** for rejecting verification, but something went wrong. Please contact a server admin.`,
            );
          }
        } else {
          logger.info(
            `User ${user.id} rejected verification but kick is disabled`,
          );
          // Optionally DM user
          await sendDM(
            user,
            `❌ You rejected verification in **${guild.name}**. If this was a mistake, you may try again or contact a server admin.`,
          );
        }
      }
      // --- Always remove the user's reaction ---
      try {
        await reaction.users.remove(user.id);
        logger.info(`Removed reaction from user ${user.id}`);
      } catch (err) {
        logger.error(`Failed to remove reaction:`, err);
      }
    } catch (error) {
      logger.error("Error in messageReactionAdd event:", error);
    }
  },
};

export default event;
