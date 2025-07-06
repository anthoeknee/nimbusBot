import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/command";
import {
  validateMemorySystem,
  quickValidateMemorySystem,
} from "../../utils/validateMemorySystem";
import { logger } from "../../utils/logger";

export const command: Command = {
  meta: {
    name: "validate-memory",
    description: "Validate the memory system integrity and functionality",
    category: "developer",
    cooldown: 30,
    guildOnly: false,
    ownerOnly: true, // Restrict to bot owner only
  },
  data: new SlashCommandBuilder()
    .setName("validate-memory")
    .setDescription("Validate the memory system integrity and functionality")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type of validation to perform")
        .setRequired(false)
        .addChoices(
          { name: "Quick Check", value: "quick" },
          { name: "Full Validation", value: "full" },
          { name: "Health Check Only", value: "health" },
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const validationType = interaction.options.getString("type") || "full";

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      logger.info(`Memory validation requested by ${interaction.user.tag}`, {
        userId: interaction.user.id,
        type: validationType,
      });

      const startTime = Date.now();

      if (validationType === "quick") {
        const isHealthy = await quickValidateMemorySystem();
        const duration = Date.now() - startTime;

        const embed = new EmbedBuilder()
          .setTitle("🔍 Quick Memory System Validation")
          .setColor(isHealthy ? 0x00ff00 : 0xff0000)
          .addFields(
            {
              name: "Status",
              value: isHealthy ? "✅ Healthy" : "❌ Issues Detected",
              inline: true,
            },
            { name: "Duration", value: `${duration}ms`, inline: true },
            { name: "Type", value: "Quick Check", inline: true },
          )
          .setTimestamp()
          .setFooter({ text: "Memory System Validation" });

        if (!isHealthy) {
          embed.setDescription(
            "⚠️ Quick validation detected issues. Run a full validation for details.",
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (validationType === "health") {
        const { validateMemorySystemHealth } = await import(
          "../../services/ai/memory"
        );
        const healthCheck = await validateMemorySystemHealth();
        const duration = Date.now() - startTime;

        const embed = new EmbedBuilder()
          .setTitle("🏥 Memory System Health Check")
          .setColor(healthCheck.isHealthy ? 0x00ff00 : 0xff0000)
          .addFields(
            {
              name: "Overall Health",
              value: healthCheck.isHealthy ? "✅ Healthy" : "❌ Issues Found",
              inline: true,
            },
            { name: "Duration", value: `${duration}ms`, inline: true },
            {
              name: "Total Issues",
              value: healthCheck.issues.length.toString(),
              inline: true,
            },
          )
          .setTimestamp()
          .setFooter({ text: "Memory System Health Check" });

        if (healthCheck.issues.length > 0) {
          embed.addFields({
            name: "Issues Detected",
            value:
              healthCheck.issues.slice(0, 5).join("\n") +
              (healthCheck.issues.length > 5
                ? `\n...and ${healthCheck.issues.length - 5} more`
                : ""),
            inline: false,
          });
        }

        if (healthCheck.stats) {
          embed.addFields({
            name: "Statistics",
            value: `Total Memories: ${healthCheck.stats.totalMemories || 0}\nAverage Importance: ${healthCheck.stats.averageImportance?.toFixed(2) || "N/A"}`,
            inline: false,
          });
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Full validation
      const report = await validateMemorySystem();
      const duration = Date.now() - startTime;

      const embed = new EmbedBuilder()
        .setTitle("🔬 Full Memory System Validation Report")
        .setColor(report.overall.success ? 0x00ff00 : 0xff0000)
        .setDescription(report.overall.summary)
        .addFields(
          {
            name: "Overall Status",
            value: report.overall.success
              ? "✅ All Tests Passed"
              : "❌ Issues Found",
            inline: true,
          },
          { name: "Duration", value: `${duration}ms`, inline: true },
          { name: "Test Categories", value: "5 test suites", inline: true },
        )
        .setTimestamp()
        .setFooter({ text: "Full Memory System Validation" });

      // Test results
      const testResults = [
        { name: "Basic Database", result: report.basicDatabase, emoji: "🗄️" },
        { name: "Enhanced Memory", result: report.enhancedMemory, emoji: "🧠" },
        { name: "Integration", result: report.integration, emoji: "🔗" },
        { name: "Embeddings", result: report.embedding, emoji: "🎯" },
        { name: "Operations", result: report.operations, emoji: "⚙️" },
      ];

      const testResultsText = testResults
        .map(
          (test) =>
            `${test.emoji} ${test.name}: ${test.result.success ? "✅" : "❌"}`,
        )
        .join("\n");

      embed.addFields({
        name: "Test Results",
        value: testResultsText,
        inline: false,
      });

      // Show failed tests details
      const failedTests = testResults.filter((test) => !test.result.success);
      if (failedTests.length > 0) {
        const failureDetails = failedTests
          .map(
            (test) =>
              `**${test.name}**: ${test.result.error || test.result.message}`,
          )
          .join("\n");

        embed.addFields({
          name: "Failure Details",
          value:
            failureDetails.length > 1000
              ? failureDetails.substring(0, 1000) + "..."
              : failureDetails,
          inline: false,
        });
      }

      // Show recommendations
      if (
        report.overall.recommendations.length > 0 &&
        !report.overall.success
      ) {
        const recommendations = report.overall.recommendations
          .slice(0, 3)
          .join("\n");
        embed.addFields({
          name: "Recommendations",
          value: recommendations,
          inline: false,
        });
      }

      // Success details for working systems
      if (report.overall.success) {
        const successDetails = [];

        if (report.enhancedMemory.details?.analytics) {
          successDetails.push(
            `Memories: ${report.enhancedMemory.details.analytics.totalMemories}`,
          );
          successDetails.push(
            `Avg Importance: ${report.enhancedMemory.details.analytics.averageImportance?.toFixed(2)}`,
          );
        }

        if (report.embedding.details?.embeddingDimension) {
          successDetails.push(
            `Embedding Dim: ${report.embedding.details.embeddingDimension}`,
          );
        }

        if (successDetails.length > 0) {
          embed.addFields({
            name: "System Status",
            value: successDetails.join(" • "),
            inline: false,
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });

      // Log the validation results
      logger.info("Memory validation completed", {
        userId: interaction.user.id,
        success: report.overall.success,
        duration,
        type: "full",
        failedTests: failedTests.map((t) => t.name),
      });
    } catch (error) {
      logger.error("Memory validation command failed:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Memory Validation Failed")
        .setColor(0xff0000)
        .setDescription("An error occurred while validating the memory system.")
        .addFields({
          name: "Error",
          value: error instanceof Error ? error.message : String(error),
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: "Memory System Validation Error" });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
