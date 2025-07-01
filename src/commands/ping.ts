import { Command } from "../types/command";
import { ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";

// Use Bun's performance.now() if available, otherwise fallback to Date.now()
const now = () => (typeof Bun !== "undefined" && Bun?.nanoseconds ? Bun.nanoseconds() / 1e6 : Date.now());

const command: Command = {
  meta: {
    name: "ping",
    description: "Replies with Pong and latency info!",
  },
  async run(client: Client, interactionOrContext: any) {
    // Get WebSocket ping - show "N/A" if -1
    const wsPing = client.ws.ping;
    const wsPingDisplay = wsPing === -1 ? "N/A" : `${Math.round(wsPing)}ms`;

    // Helper to build the embed
    const buildEmbed = (apiLatency?: number, messageLatency?: number) =>
      new EmbedBuilder()
        .setTitle("🏓 Pong!")
        .setColor(0x00ff99)
        .addFields(
          { name: "WebSocket Ping", value: wsPingDisplay, inline: true },
          ...(apiLatency !== undefined
            ? [{ name: "API Latency", value: `${apiLatency}ms`, inline: true }]
            : []),
          ...(messageLatency !== undefined
            ? [{ name: "Message Latency", value: `${messageLatency}ms`, inline: true }]
            : [])
        )
        .setTimestamp();

    if ("isChatInputCommand" in interactionOrContext) {
      // Slash command
      const apiStart = now();
      const sent = await interactionOrContext.reply({
        embeds: [buildEmbed()],
        fetchReply: true,
      });
      const apiLatency = Math.round(now() - apiStart);
      const messageLatency = sent.createdTimestamp - interactionOrContext.createdTimestamp;
      await interactionOrContext.editReply({ embeds: [buildEmbed(apiLatency, messageLatency)] });
    } else {
      // Prefix command
      const apiStart = now();
      const sent = await interactionOrContext.message.reply({ embeds: [buildEmbed()] });
      const apiLatency = Math.round(now() - apiStart);
      const messageLatency = sent.createdTimestamp - interactionOrContext.message.createdTimestamp;
      await sent.edit({ embeds: [buildEmbed(apiLatency, messageLatency)] });
    }
  },
};

export default command;