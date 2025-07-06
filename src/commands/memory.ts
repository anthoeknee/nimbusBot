import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  Message,
  Colors,
  MessageFlags,
} from "discord.js";
import { Command } from "../types/command";
import { commandErrorHandler } from "../middleware/errorHandler";
import { conversationManager } from "../services/ai/conversation";
import { database } from "../services/db";
import { AIClient } from "../services/ai/client";
import { config } from "../config";
import { logger } from "../utils/logger";

export const command: Command = {
  meta: {
    name: "memory",
    description: "Manage bot memory and conversation contexts.",
    category: "Admin",
    permissions: ["Administrator"],
    guildOnly: false,
    usage: "/memory <stats|search|save|clear|config>",
    examples: [
      "/memory stats",
      "/memory search query:artificial intelligence",
      "/memory save content:Important meeting notes",
      "/memory clear type:channel id:123456789",
      "/memory config auto_transfer:true",
    ],
  },
  data: new SlashCommandBuilder()
    .setName("memory")
    .setDescription("Manage bot memory and conversation contexts.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("View memory and conversation statistics."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("search")
        .setDescription("Search long-term memories.")
        .addStringOption((opt) =>
          opt.setName("query").setDescription("Search query").setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Number of results (1-20)")
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false),
        )
        .addNumberOption((opt) =>
          opt
            .setName("min_similarity")
            .setDescription("Minimum similarity threshold (0.0-1.0)")
            .setMinValue(0.0)
            .setMaxValue(1.0)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("save")
        .setDescription("Save content to long-term memory.")
        .addStringOption((opt) =>
          opt
            .setName("content")
            .setDescription("Content to save")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("importance")
            .setDescription("Importance level (1-10)")
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Clear conversation context.")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Context type")
            .setRequired(true)
            .addChoices(
              { name: "User/DM", value: "user" },
              { name: "Channel", value: "channel" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("User ID or Channel ID")
            .setRequired(true),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("transfer")
            .setDescription(
              "Transfer to long-term memory first (default: true)",
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("Configure memory settings.")
        .addBooleanOption((opt) =>
          opt
            .setName("auto_transfer")
            .setDescription("Enable automatic memory transfer")
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("memory_retrieval")
            .setDescription("Enable memory retrieval for context")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("short_term_limit")
            .setDescription("Short-term memory limit (10-100)")
            .setMinValue(10)
            .setMaxValue(100)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("transfer")
        .setDescription(
          "Manually transfer all conversations to long-term memory.",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Reset all memories (use when embedding models change)")
        .addBooleanOption((opt) =>
          opt
            .setName("confirm")
            .setDescription("Confirm you want to delete ALL memories")
            .setRequired(true),
        ),
    ) as SlashCommandBuilder,

  execute: commandErrorHandler(
    async (interaction: ChatInputCommandInteraction | Message) => {
      // Only support slash commands for this complex command
      if (!(interaction instanceof ChatInputCommandInteraction)) {
        await (interaction as Message).reply(
          "❌ Please use this command as a slash command: `/memory`",
        );
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      // Defer reply to prevent timeout
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        switch (subcommand) {
          case "stats":
            await handleStats(interaction);
            break;
          case "search":
            await handleSearch(interaction);
            break;
          case "save":
            await handleSave(interaction);
            break;
          case "clear":
            await handleClear(interaction);
            break;
          case "config":
            await handleConfig(interaction);
            break;
          case "transfer":
            await handleTransfer(interaction);
            break;
          case "reset":
            await handleReset(interaction);
            break;
          default:
            throw new Error(`Unknown subcommand: ${subcommand}`);
        }
      } catch (error) {
        logger.error("Memory command error:", error);

        // Provide more specific error messages for common issues
        let errorMessage =
          error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("Vectors must have the same length")) {
          errorMessage +=
            "\n\n💡 This usually means the embedding model has changed or embeddings were created with different dimensions. Try recreating your memories or clearing the database.";
        } else if (errorMessage.includes("Memory similarity search failed")) {
          errorMessage +=
            "\n\n💡 There was an issue with the similarity search. This could be due to embedding dimension mismatch or database connectivity issues.";
        }

        await interaction.editReply({
          content: `❌ Error: ${errorMessage}`,
        });
      }
    },
    "memory",
  ),
};

async function handleStats(interaction: ChatInputCommandInteraction) {
  const conversationStats = conversationManager.instance.getStats();
  const memoryCount = await database.memories.count();
  const userMemoryCount = await database.memories.count({
    userId: { not: null },
  });
  const guildMemoryCount = await database.memories.count({
    guildId: { not: null },
  });

  const embed = new EmbedBuilder()
    .setTitle("🧠 Memory Statistics")
    .setColor(Colors.Blue)
    .addFields(
      {
        name: "💬 Conversation Contexts",
        value: [
          `Active: ${conversationStats.activeContexts}`,
          `Total Messages: ${conversationStats.totalMessages}`,
          `Avg per Context: ${conversationStats.avgMessagesPerContext.toFixed(1)}`,
          `Transfers in Progress: ${conversationStats.memoryTransfersInProgress}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "🗄️ Long-term Memories",
        value: [
          `Total: ${memoryCount}`,
          `User Memories: ${userMemoryCount}`,
          `Guild Memories: ${guildMemoryCount}`,
          `Shared: ${memoryCount - userMemoryCount - guildMemoryCount}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "⚙️ Configuration",
        value: [
          `Provider: ${config.defaultProvider}`,
          `Model: ${config.defaultModel}`,
          `Embed Model: ${config.defaultEmbedModel}`,
        ].join("\n"),
        inline: false,
      },
    )
    .setTimestamp()
    .setFooter({ text: "Memory system operational" });

  // Add embedding model test to show dimensions
  try {
    const testEmbedding = await AIClient.embeddings({
      provider: "cohere",
      model: config.defaultEmbedModel,
      texts: ["test"],
      inputType: "search_query",
    });

    let dimensions = "Unknown";
    if (testEmbedding.embeddings) {
      if (Array.isArray(testEmbedding.embeddings)) {
        const embeddings = testEmbedding.embeddings as number[][];
        if (embeddings.length > 0 && Array.isArray(embeddings[0])) {
          dimensions = `${embeddings[0].length}D`;
        }
      } else if (
        typeof testEmbedding.embeddings === "object" &&
        (testEmbedding.embeddings as Record<string, any>).float
      ) {
        const floatEmbeddings = (
          testEmbedding.embeddings as Record<string, any>
        ).float;
        if (
          Array.isArray(floatEmbeddings) &&
          floatEmbeddings.length > 0 &&
          Array.isArray(floatEmbeddings[0])
        ) {
          dimensions = `${floatEmbeddings[0].length}D`;
        }
      }
    }

    embed.addFields({
      name: "🎯 Embedding Info",
      value: `Current Model Dimensions: ${dimensions}`,
      inline: false,
    });
  } catch (error) {
    embed.addFields({
      name: "🎯 Embedding Info",
      value: `Error testing embedding model: ${error instanceof Error ? error.message : String(error)}`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleSearch(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString("query", true);
  const limit = interaction.options.getInteger("limit") ?? 5;
  const minSimilarity = interaction.options.getNumber("min_similarity") ?? 0.5;

  // Generate embedding for search
  const embeddingResponse = await AIClient.embeddings({
    provider: "cohere",
    model: config.defaultEmbedModel,
    texts: [query],
    inputType: "search_query",
  });

  if (!embeddingResponse.embeddings) {
    throw new Error(
      "Failed to generate search embedding: No embeddings returned",
    );
  }

  let queryEmbedding: number[];

  // Handle both array and object response formats
  if (Array.isArray(embeddingResponse.embeddings)) {
    const embeddings = embeddingResponse.embeddings as number[][];
    if (embeddings.length === 0 || !Array.isArray(embeddings[0])) {
      throw new Error(
        "Failed to generate search embedding: Invalid array format",
      );
    }
    queryEmbedding = embeddings[0];
  } else if (
    typeof embeddingResponse.embeddings === "object" &&
    (embeddingResponse.embeddings as Record<string, any>).float
  ) {
    // Handle object format with float embeddings
    const floatEmbeddings = (
      embeddingResponse.embeddings as Record<string, any>
    ).float;
    if (
      !Array.isArray(floatEmbeddings) ||
      floatEmbeddings.length === 0 ||
      !Array.isArray(floatEmbeddings[0])
    ) {
      throw new Error(
        "Failed to generate search embedding: Invalid object format",
      );
    }
    queryEmbedding = floatEmbeddings[0];
  } else {
    throw new Error(
      "Failed to generate search embedding: Unsupported embedding format",
    );
  }

  logger.info(
    `Generated query embedding with dimensions: ${queryEmbedding.length}`,
  );

  // Search memories
  const results = await database.memories.findSimilar(queryEmbedding, {
    topK: limit,
  });

  const filteredResults = results.filter(
    (result) => result.similarity >= minSimilarity,
  );

  if (filteredResults.length === 0) {
    await interaction.editReply({
      content: `🔍 No memories found for query: "${query}" (min similarity: ${minSimilarity})`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Memory Search Results`)
    .setDescription(
      `Query: "${query}"\nFound ${filteredResults.length} results`,
    )
    .setColor(Colors.Green)
    .setTimestamp();

  // Add results as fields (Discord has a 25 field limit)
  for (const [index, result] of filteredResults.slice(0, 10).entries()) {
    const content = result.data.content
      .replace(/\[Memory Metadata:.*\]$/, "")
      .trim();

    const truncatedContent =
      content.length > 200 ? content.substring(0, 200) + "..." : content;

    embed.addFields({
      name: `${index + 1}. Similarity: ${(result.similarity * 100).toFixed(1)}%`,
      value: `${truncatedContent}\n\n*Created: ${new Date(result.data.createdAt).toLocaleDateString()}*`,
      inline: false,
    });
  }

  if (filteredResults.length > 10) {
    embed.setFooter({
      text: `Showing first 10 of ${filteredResults.length} results`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleSave(interaction: ChatInputCommandInteraction) {
  const content = interaction.options.getString("content", true);
  const importance = interaction.options.getInteger("importance") ?? 5;

  // Generate embedding
  const embeddingResponse = await AIClient.embeddings({
    provider: "cohere",
    model: config.defaultEmbedModel,
    texts: [content],
    inputType: "search_document",
  });

  if (!embeddingResponse.embeddings) {
    throw new Error(
      "Failed to generate content embedding: No embeddings returned",
    );
  }

  let embedding: number[];

  // Handle both array and object response formats
  if (Array.isArray(embeddingResponse.embeddings)) {
    const embeddings = embeddingResponse.embeddings as number[][];
    if (embeddings.length === 0 || !Array.isArray(embeddings[0])) {
      throw new Error(
        "Failed to generate content embedding: Invalid array format",
      );
    }
    embedding = embeddings[0];
  } else if (
    typeof embeddingResponse.embeddings === "object" &&
    (embeddingResponse.embeddings as Record<string, any>).float
  ) {
    // Handle object format with float embeddings
    const floatEmbeddings = (
      embeddingResponse.embeddings as Record<string, any>
    ).float;
    if (
      !Array.isArray(floatEmbeddings) ||
      floatEmbeddings.length === 0 ||
      !Array.isArray(floatEmbeddings[0])
    ) {
      throw new Error(
        "Failed to generate content embedding: Invalid object format",
      );
    }
    embedding = floatEmbeddings[0];
  } else {
    throw new Error(
      "Failed to generate content embedding: Unsupported embedding format",
    );
  }

  logger.info(
    `Generated content embedding with dimensions: ${embedding.length}`,
  );

  // Enhance content with metadata
  const enhancedContent = `${content}\n\n[Memory Metadata: Importance: ${importance}/10, Created: ${new Date().toISOString()}, Saved by: Admin]`;

  // Determine context (user or guild)
  const guildId = interaction.guildId
    ? parseInt(interaction.guildId)
    : undefined;
  const userId = !guildId ? parseInt(interaction.user.id) : undefined;

  const memory = await database.memories.createWithEmbedding(
    enhancedContent,
    embedding,
    userId,
    guildId,
  );

  const embed = new EmbedBuilder()
    .setTitle("💾 Memory Saved")
    .setDescription("Successfully saved content to long-term memory.")
    .setColor(Colors.Green)
    .addFields(
      {
        name: "Memory ID",
        value: memory.id.toString(),
        inline: true,
      },
      {
        name: "Importance",
        value: `${importance}/10`,
        inline: true,
      },
      {
        name: "Context",
        value: guildId
          ? `Guild: ${interaction.guildId}`
          : `User: ${interaction.user.id}`,
        inline: true,
      },
      {
        name: "Content Preview",
        value:
          content.length > 500 ? content.substring(0, 500) + "..." : content,
        inline: false,
      },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleClear(interaction: ChatInputCommandInteraction) {
  const type = interaction.options.getString("type", true) as
    | "user"
    | "channel";
  const id = interaction.options.getString("id", true);
  const transfer = interaction.options.getBoolean("transfer") ?? true;

  // Get current context info
  const currentHistory = conversationManager.instance.getHistory(type, id);

  if (currentHistory.length === 0) {
    await interaction.editReply({
      content: `ℹ️ No conversation context found for ${type}: ${id}`,
    });
    return;
  }

  let transferredCount = 0;
  if (transfer) {
    try {
      await conversationManager.instance.transferAllToLongTerm();
      transferredCount = currentHistory.filter(
        (msg) => msg.type === "user" || msg.type === "bot",
      ).length;
    } catch (error) {
      logger.error("Failed to transfer before clearing:", error);
    }
  }

  // Clear the context
  conversationManager.instance.clearContext(type, id);

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Context Cleared")
    .setDescription(
      `Successfully cleared conversation context for ${type}: ${id}`,
    )
    .setColor(Colors.Orange)
    .addFields(
      {
        name: "Messages Cleared",
        value: currentHistory.length.toString(),
        inline: true,
      },
      {
        name: "Transferred to Long-term",
        value: transfer ? transferredCount.toString() : "0 (skipped)",
        inline: true,
      },
      {
        name: "Context Type",
        value: type === "user" ? "User/DM" : "Channel",
        inline: true,
      },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleConfig(interaction: ChatInputCommandInteraction) {
  const autoTransfer = interaction.options.getBoolean("auto_transfer");
  const memoryRetrieval = interaction.options.getBoolean("memory_retrieval");
  const shortTermLimit = interaction.options.getInteger("short_term_limit");

  const updates: any = {};
  if (autoTransfer !== null) updates.enableAutoTransfer = autoTransfer;
  if (memoryRetrieval !== null) updates.enableMemoryRetrieval = memoryRetrieval;
  if (shortTermLimit !== null) updates.shortTermLimit = shortTermLimit;

  if (Object.keys(updates).length === 0) {
    await interaction.editReply({
      content:
        "❌ No configuration options provided. Please specify at least one option to update.",
    });
    return;
  }

  // Update configuration
  conversationManager.instance.updateConfig(updates);

  const embed = new EmbedBuilder()
    .setTitle("⚙️ Configuration Updated")
    .setDescription("Memory system configuration has been updated.")
    .setColor(Colors.Blue)
    .setTimestamp();

  Object.entries(updates).forEach(([key, value]) => {
    embed.addFields({
      name: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase()),
      value: String(value),
      inline: true,
    });
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleTransfer(interaction: ChatInputCommandInteraction) {
  const startTime = Date.now();
  const initialStats = conversationManager.instance.getStats();

  await conversationManager.instance.transferAllToLongTerm();

  const endTime = Date.now();
  const duration = endTime - startTime;

  const embed = new EmbedBuilder()
    .setTitle("📤 Memory Transfer Complete")
    .setDescription(
      "All active conversations have been transferred to long-term memory.",
    )
    .setColor(Colors.Green)
    .addFields(
      {
        name: "Contexts Processed",
        value: initialStats.activeContexts.toString(),
        inline: true,
      },
      {
        name: "Messages Transferred",
        value: initialStats.totalMessages.toString(),
        inline: true,
      },
      {
        name: "Duration",
        value: `${duration}ms`,
        inline: true,
      },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleReset(interaction: ChatInputCommandInteraction) {
  const confirm = interaction.options.getBoolean("confirm", true);

  if (!confirm) {
    await interaction.editReply({
      content:
        "❌ You must confirm to reset all memories by setting `confirm` to `true`.",
    });
    return;
  }

  try {
    // Get count before deletion
    const totalMemories = await database.memories.count();

    // Delete all memories
    await database.memories.deleteMany({});

    // Also clear conversation contexts
    conversationManager.instance.clearAllContexts();

    const embed = new EmbedBuilder()
      .setTitle("🔄 Memory System Reset")
      .setDescription(
        "All memories and conversation contexts have been cleared.",
      )
      .setColor(Colors.Orange)
      .addFields(
        {
          name: "Memories Deleted",
          value: totalMemories.toString(),
          inline: true,
        },
        {
          name: "Reason",
          value: "Embedding model dimension mismatch resolved",
          inline: true,
        },
        {
          name: "Next Steps",
          value:
            "You can now save new memories with the current embedding model",
          inline: false,
        },
      )
      .setTimestamp()
      .setFooter({ text: "Memory system has been reset" });

    await interaction.editReply({ embeds: [embed] });

    logger.info("Memory system reset completed", {
      memoriesDeleted: totalMemories,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error("Memory reset failed:", error);
    await interaction.editReply({
      content: `❌ Failed to reset memory system: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

export default command;
