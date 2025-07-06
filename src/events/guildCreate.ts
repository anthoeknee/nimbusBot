// src/events/guildCreate.ts
import { Event } from "../types/event";
import { Guild, ChannelType, TextChannel, EmbedBuilder } from "discord.js";

const event: Event<"guildCreate"> = {
  name: "guildCreate",
  once: false,
  execute: async (guild: Guild) => {
    console.log(`Joined new guild: ${guild.name} (${guild.id})`);

    // --- Find a suitable channel to send the hello message ---
    let targetChannel: TextChannel | null = null;

    // Prefer the system channel if available and bot has permission
    if (
      guild.systemChannel &&
      guild.systemChannel.permissionsFor(guild.members.me!)?.has("SendMessages")
    ) {
      targetChannel = guild.systemChannel;
    }

    // Otherwise, find the first text channel the bot can send messages in
    if (!targetChannel) {
      const channels = guild.channels.cache
        .filter(
          (channel) =>
            channel.type === ChannelType.GuildText &&
            channel.permissionsFor(guild.members.me!)?.has("SendMessages"),
        )
        .filter(
          (channel): channel is TextChannel =>
            channel.type === ChannelType.GuildText,
        )
        .sort((a, b) => a.position - b.position);
      targetChannel = channels.first() || null;
    }

    // --- Send the hello message if a suitable channel was found ---
    if (!targetChannel) {
      console.log(
        `Could not find a suitable channel to send welcome message in ${guild.name}`,
      );
      return;
    }
    try {
      const welcomeEmbed = createWelcomeEmbed(guild);
      await targetChannel.send({ embeds: [welcomeEmbed] });
    } catch (error) {
      console.error(`Failed to send welcome message in ${guild.name}:`, error);
    }
  },
};

// Helper for creating the welcome embed (could be moved to helpers/embed.ts if reused)
function createWelcomeEmbed(guild: Guild) {
  return new EmbedBuilder()
    .setTitle("☁️ Hii! So happy to be here! ✨")
    .setDescription(
      `Hello **${guild.name}**! My name is nimbus, and I can't wait to help out.`,
    )
    .setColor("#F4C2C2")
    .addFields(
      {
        name: "🌸 Getting Started",
        value: "Use `/help` to see all of my commands!",
        inline: false,
      },
      {
        name: "💖 Helpful Links",
        value:
          "[Support Server](https://discord.gg/j7natpDbEj) • [Documentation](N/A)",
        inline: false,
      },
    )
    .setThumbnail(guild.members.me?.displayAvatarURL() || null)
    .setFooter({
      text: `Happily serving ${guild.memberCount} members!`,
      iconURL: guild.iconURL() || undefined,
    })
    .setTimestamp();
}

export default event;
