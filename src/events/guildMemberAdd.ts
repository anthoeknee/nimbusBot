import { Event } from "../types/event";
import { database, settings } from "../services/db";
import { VerificationConfig } from "../services/db/types";
import { GuildMember, PermissionsBitField } from "discord.js";
import { sendDM } from "./helpers/dm";

const VERIFY_SETTING_KEY = "verification_config";

const event: Event<"guildMemberAdd"> = {
  name: "guildMemberAdd",
  once: false,
  execute: async (member: GuildMember) => {
    if (member.user.bot) return;
    const discordGuildId = member.guild.id;

    const guildRow = await database.guilds.findByDiscordId(discordGuildId);
    if (!guildRow) return;

    const config = await settings.getSettingValue<VerificationConfig>(
      VERIFY_SETTING_KEY,
      undefined,
      guildRow.id,
    );
    if (!config || !config.enabled) return;

    // Remove all roles except @everyone
    const rolesToRemove = member.roles.cache.filter(
      (r) => r.id !== member.guild.id,
    );
    if (rolesToRemove.size > 0) {
      try {
        await member.roles.remove(rolesToRemove);
      } catch (e) {
        // Ignore errors (e.g., missing permissions)
      }
    }
    // Optionally DM the user
    await sendDM(
      member.user,
      `Welcome to ${member.guild.name}! Please verify yourself in <#${config.channelId}> by reacting to the verification message.`,
    );
  },
};

export default event;
