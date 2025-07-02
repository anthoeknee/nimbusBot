import { Command } from "../types/command";
import { ChatInputCommandInteraction, Client, EmbedBuilder } from "discord.js";
import { logger } from "../utils/logger";

// Use Bun's performance.now() if available, otherwise fallback to Date.now()
const now = () => (typeof Bun !== "undefined" && Bun?.nanoseconds ? Bun.nanoseconds() / 1e6 : Date.now());

const command: Command = {
  meta: {
    name: "ping",
    description: "Replies with Pong and latency info!",
  },
  async run(client: Client, interactionOrContext: any) {
    const startTime = Date.now();
    
    // Get user ID correctly for both slash and prefix commands
    let userId: string;
    
    if ("isChatInputCommand" in interactionOrContext) {
      userId = interactionOrContext.user.id;
    } else {
      userId = interactionOrContext.message.author.id;
    }
    
    try {
      logger.info(`Ping command initiated by user ${userId}`);

      // Get WebSocket ping - show "N/A" if -1
      const wsPing = client.ws.ping;
      const wsPingDisplay = wsPing === -1 ? "N/A" : `${Math.round(wsPing)}ms`;

      logger.debug(`WebSocket ping: ${wsPingDisplay}`);

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
        const interaction = interactionOrContext as ChatInputCommandInteraction;
        
        logger.debug(`Processing slash command ping for user ${userId}`);
        
        const apiStart = now();
        
        // Defer reply to prevent timeout
        await interaction.deferReply();
        
        const sent = await interaction.editReply({
          embeds: [buildEmbed()]
        });
        
        const apiLatency = Math.round(now() - apiStart);
        const messageLatency = sent.createdTimestamp - interaction.createdTimestamp;
        
        await interaction.editReply({ 
          embeds: [buildEmbed(apiLatency, messageLatency)] 
        });
        
        logger.info(`Ping command completed for user ${userId} - API: ${apiLatency}ms, Message: ${messageLatency}ms`);
        
      } else {
        // Prefix command
        const message = interactionOrContext.message;
        
        logger.debug(`Processing prefix command ping for user ${userId}`);
        
        const apiStart = now();
        const sent = await message.reply({ embeds: [buildEmbed()] });
        const apiLatency = Math.round(now() - apiStart);
        const messageLatency = sent.createdTimestamp - message.createdTimestamp;
        
        await sent.edit({ embeds: [buildEmbed(apiLatency, messageLatency)] });
        
        logger.info(`Ping command completed for user ${userId} - API: ${apiLatency}ms, Message: ${messageLatency}ms`);
      }

      const totalTime = Date.now() - startTime;
      logger.debug(`Total ping command execution time: ${totalTime}ms`);

    } catch (error) {
      logger.error(`Error in ping command for user ${userId}:`, error);
      
      // Send error response
      try {
        if ("isChatInputCommand" in interactionOrContext) {
          const interaction = interactionOrContext as ChatInputCommandInteraction;
          
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: "❌ An error occurred while processing the ping command. Please try again later.",
              ephemeral: true
            });
          } else {
            await interaction.followUp({
              content: "❌ An error occurred while processing the ping command. Please try again later.",
              ephemeral: true
            });
          }
        } else {
          await interactionOrContext.message.reply({
            content: "❌ An error occurred while processing the ping command. Please try again later."
          });
        }
      } catch (replyError) {
        logger.error(`Failed to send error response to user ${userId}:`, replyError);
      }
    }
  },
};

export default command;