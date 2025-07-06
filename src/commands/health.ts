import { Command } from "../types/command";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  Message,
  MessageFlags,
} from "discord.js";
import { commandErrorHandler } from "../middleware/errorHandler";
import { BotValidator } from "../utils/validate";
import { logger } from "../utils/logger";

export const command: Command = {
  meta: {
    name: "health",
    description: "Check bot health and system status",
    category: "Utility",
    permissions: ["Administrator"],
    cooldown: 10,
    guildOnly: false,
  },
  data: new SlashCommandBuilder()
    .setName("health")
    .setDescription("Check bot health and system status")
    .addBooleanOption((option) =>
      option
        .setName("detailed")
        .setDescription("Show detailed health information")
        .setRequired(false),
    ) as SlashCommandBuilder,

  execute: commandErrorHandler(
    async (
      interactionOrMessage: ChatInputCommandInteraction | Message,
      context?: { args?: string[] },
    ) => {
      const isSlashCommand = "options" in interactionOrMessage;
      const detailed = isSlashCommand
        ? (interactionOrMessage.options.getBoolean("detailed") ?? false)
        : (context?.args?.includes("--detailed") ?? false);

      // Defer reply for slash commands to prevent timeout
      if (isSlashCommand && !interactionOrMessage.replied) {
        await interactionOrMessage.deferReply({
          flags: MessageFlags.Ephemeral,
        });
      }

      logger.info("Health check requested", {
        user: isSlashCommand
          ? interactionOrMessage.user.id
          : interactionOrMessage.author.id,
        detailed,
      });

      const startTime = Date.now();

      try {
        // Run health checks
        const healthResult = await BotValidator.quickHealthCheck();
        const responseTime = Date.now() - startTime;

        // Create status embed
        const embed = new EmbedBuilder()
          .setTitle("🏥 Bot Health Status")
          .setColor(healthResult.overall ? 0x00ff00 : 0xff0000)
          .setTimestamp()
          .addFields(
            {
              name: "⚙️ Overall Status",
              value: healthResult.overall ? "✅ Healthy" : "❌ Unhealthy",
              inline: true,
            },
            {
              name: "📊 Response Time",
              value: `${responseTime}ms`,
              inline: true,
            },
            {
              name: "🔧 Configuration",
              value: healthResult.config ? "✅ Valid" : "❌ Invalid",
              inline: true,
            },
            {
              name: "🗄️ Database",
              value: healthResult.database ? "✅ Connected" : "❌ Error",
              inline: true,
            },
            {
              name: "🌐 WebSocket",
              value: `${
                isSlashCommand
                  ? interactionOrMessage.client.ws.ping
                  : interactionOrMessage.client.ws.ping
              }ms`,
              inline: true,
            },
            {
              name: "💾 Memory Usage",
              value: `${Math.round(
                process.memoryUsage().heapUsed / 1024 / 1024,
              )}MB`,
              inline: true,
            },
          );

        if (detailed) {
          const memUsage = process.memoryUsage();
          const uptime = process.uptime();

          embed.addFields(
            {
              name: "📈 Detailed Memory",
              value: [
                `Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                `Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
                `External: ${Math.round(memUsage.external / 1024 / 1024)}MB`,
                `RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`,
              ].join("\n"),
              inline: false,
            },
            {
              name: "⏱️ Uptime",
              value: formatUptime(uptime),
              inline: true,
            },
            {
              name: "🔢 Node.js Version",
              value: process.version,
              inline: true,
            },
            {
              name: "🎯 Platform",
              value: `${process.platform} ${process.arch}`,
              inline: true,
            },
          );
        }

        // Add footer with additional info
        embed.setFooter({
          text: `Checked at ${new Date().toLocaleTimeString()} | Bot ID: ${
            isSlashCommand
              ? interactionOrMessage.client.user?.id
              : interactionOrMessage.client.user?.id
          }`,
        });

        // Send response
        if (isSlashCommand) {
          await interactionOrMessage.editReply({ embeds: [embed] });
        } else {
          await interactionOrMessage.reply({ embeds: [embed] });
        }

        logger.info("Health check completed", {
          overall: healthResult.overall,
          responseTime,
        });
      } catch (error) {
        logger.error("Health check failed:", error);

        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Health Check Failed")
          .setDescription(
            `An error occurred while checking bot health: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
          .setColor(0xff0000)
          .setTimestamp();

        if (isSlashCommand) {
          await interactionOrMessage.editReply({ embeds: [errorEmbed] });
        } else {
          await interactionOrMessage.reply({ embeds: [errorEmbed] });
        }
      }
    },
    "health",
  ),
};

/**
 * Format uptime in a human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

export default command;
