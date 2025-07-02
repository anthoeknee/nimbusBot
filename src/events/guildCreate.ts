// src/events/guildCreate.ts
import { Event } from "../types/event";
import { Guild, ChannelType, TextChannel } from "discord.js";

const event: Event<"guildCreate"> = {
  name: "guildCreate",
  once: false,
  execute: async (guild: Guild) => {
    console.log(`Joined new guild: ${guild.name} (${guild.id})`);
    
    // Try to find a suitable channel to send the hello message
    let targetChannel: TextChannel | null = null;
    
    // First, try to get the system channel (Discord's designated welcome channel)
    if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.members.me!)?.has("SendMessages")) {
      targetChannel = guild.systemChannel;
    }
    
    // If no system channel, find the first text channel the bot can send messages in
    if (!targetChannel) {
      const channels = guild.channels.cache
        .filter(channel => 
          channel.type === ChannelType.GuildText &&
          channel.permissionsFor(guild.members.me!)?.has("SendMessages") &&
          channel.type === ChannelType.GuildText
        )
        // Only TextChannel has 'position', so filter and cast before sorting
        .filter((channel): channel is TextChannel => channel.type === ChannelType.GuildText)
        .sort((a, b) => a.position - b.position);

      targetChannel = channels.first() || null;
    }
    // Send the hello message if we found a suitable channel
    if (targetChannel) {
      try {
        await targetChannel.send({
          content: `👋 Hello **${guild.name}**! Thanks for inviting me to your server. I'm excited to be here!`
        });
      } catch (error) {
        console.error(`Failed to send welcome message in ${guild.name}:`, error);
      }
    } else {
      console.log(`Could not find a suitable channel to send welcome message in ${guild.name}`);
    }
  }
};

export default event;