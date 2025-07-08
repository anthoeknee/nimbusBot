// src/events/guildCreate.ts
import { Event } from "../types/event";
import { Guild, ChannelType, TextChannel, EmbedBuilder } from "discord.js";

const event: Event<"guildCreate"> = {
  name: "guildCreate",
  once: false,
  execute: async (guild: Guild) => {
    console.log(`Joined new guild: ${guild.name} (${guild.id})`);

    // Try to find a suitable channel to send the hello message
    let targetChannel: TextChannel | null = null;

    // First, try to get the system channel (Discord's designated welcome channel)
    if (
      guild.systemChannel &&
      guild.systemChannel.permissionsFor(guild.members.me!)?.has("SendMessages")
    ) {
      targetChannel = guild.systemChannel;
    }

    // If no system channel, find the first text channel the bot can send messages in
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

    // Send the hello message if we found a suitable channel
    if (targetChannel) {
      try {
        const welcomeEmbed = new EmbedBuilder()
          .setTitle("☁️ Hii! So happy to be here! ✨")
          .setDescription(
            `Hello **${guild.name}**! My name is nimbus, and I can't wait to help out.`,
          )
          // --- Cutesy Pastel Color ---
          // You can use any hex code here!
          // Some cute pastel options:
          // #F4C2C2 (Baby Pink)
          // #A7C7E7 (Pastel Blue)
          // #C3B1E1 (Pastel Purple/Lavender)
          // #FDFD96 (Pastel Yellow)
          // #BDECB6 (Mint Green)
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

        await targetChannel.send({ embeds: [welcomeEmbed] });
      } catch (error) {
        console.error(
          `Failed to send welcome message in ${guild.name}:`,
          error,
        );
      }
    } else {
      console.log(
        `Could not find a suitable channel to send welcome message in ${guild.name}`,
      );
    }
  },
};

export default event;
