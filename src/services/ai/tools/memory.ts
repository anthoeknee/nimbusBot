import { ToolDefinition } from "../../../types/ai";
import { database } from "../../db";
import { AIClient } from "../client";
import { getConversationManager } from "../conversation";
import { config } from "../../../config";
import { logger } from "../../../utils/logger";
import { getMemoryDatabase } from "../memory";
import { ToolMemoryContext } from "../memory/types";
import type {
  MemoryRecord,
  MemorySearchResult,
  MemoryAnalytics,
} from "../../../types/memory";

/**
 * Generate embedding for content using the default embedding model with enhanced error handling
 */
async function generateEmbedding(content: string): Promise<number[]> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await AIClient.embeddings({
        provider: "cohere", // Use Cohere for embeddings since it's the only one that supports it
        model: config.defaultEmbedModel,
        texts: [content],
        inputType: "search_document",
      });

      if (response.embeddings && Array.isArray(response.embeddings[0])) {
        return response.embeddings[0];
      }

      throw new Error("Invalid embedding response format");
    } catch (error) {
      if (attempt === maxRetries - 1) {
        logger.error(
          "Failed to generate embedding for memory tool after all retries:",
          error,
        );
        // Return a deterministic fallback embedding
        return createFallbackEmbedding(content);
      }

      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return createFallbackEmbedding(content);
}

/**
 * Create a deterministic fallback embedding based on content
 */
function createFallbackEmbedding(content: string): number[] {
  const dimension = 1024;
  const embedding = new Array(dimension).fill(0);

  // Create a simple hash-based embedding
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  for (let i = 0; i < dimension; i++) {
    const seed = hash + i;
    embedding[i] = ((Math.sin(seed) * 10000) % 2) - 1;
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / norm);
}

export const saveLongTermMemory: ToolDefinition = {
  name: "save_long_term_memory",
  description:
    "Save a new long-term memory with enhanced metadata and automatic tagging. Use this tool when you decide something is worth remembering long-term.",
  parameters: [
    {
      name: "content",
      type: "string",
      description: "The memory content to store.",
      required: true,
    },
    {
      name: "reasoning",
      type: "string",
      description:
        "Why this memory is worth saving (required in tool-driven mode).",
      required: false,
    },
    {
      name: "embedding",
      type: "array",
      description:
        "Vector embedding for similarity search (optional - will be auto-generated).",
      required: false,
    },
    {
      name: "userId",
      type: "number",
      description: "User ID (optional)",
      required: false,
    },
    {
      name: "guildId",
      type: "number",
      description: "Guild ID (optional)",
      required: false,
    },
    {
      name: "importance",
      type: "number",
      description:
        "Importance level 1-10 (required - you must assess importance)",
      required: true,
    },
    {
      name: "category",
      type: "string",
      description: "Memory category to organize information",
      required: false,
      enum: [
        "user_preference",
        "important_fact",
        "decision",
        "relationship",
        "event",
        "knowledge",
        "reminder",
        "context",
        "problem_solution",
        "insight",
      ],
    },
    {
      name: "tags",
      type: "array",
      description: "Tags to categorize the memory (optional)",
      required: false,
    },
    {
      name: "metadata",
      type: "object",
      description: "Additional metadata for the memory (optional)",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const {
      content,
      reasoning,
      embedding,
      userId,
      guildId,
      importance,
      category,
      tags = [],
      metadata = {},
    } = args;

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("Content must be a non-empty string");
    }

    // Validate importance
    if (importance === undefined || importance < 1 || importance > 10) {
      throw new Error("Importance must be between 1 and 10");
    }

    // Check tool permissions
    const conversationManager = getConversationManager();
    const permissions = conversationManager.instance.getToolPermissions();
    if (!permissions.allowSave) {
      throw new Error("Memory saving is not permitted");
    }

    // In tool-driven mode, require reasoning
    if (conversationManager.instance.isToolDrivenMode() && !reasoning) {
      throw new Error(
        "Reasoning is required in tool-driven mode - explain why this memory is worth saving",
      );
    }

    // Validate importance threshold in tool-driven mode
    if (conversationManager.instance.isToolDrivenMode()) {
      const config = conversationManager.instance.config;
      if (importance < config.memoryDecisionThreshold) {
        logger.warn(
          `Memory importance ${importance} is below threshold ${config.memoryDecisionThreshold}`,
        );
      }
    }

    let finalEmbedding = embedding;

    // Auto-generate embedding if not provided
    if (!finalEmbedding || !Array.isArray(finalEmbedding)) {
      logger.debug("Auto-generating embedding for memory content");
      finalEmbedding = await generateEmbedding(content);
    }

    // Auto-generate tags if not provided
    let finalTags = Array.isArray(tags) ? tags : [];
    if (finalTags.length === 0) {
      finalTags = await generateTags(content);
    }

    // Add category to tags if provided
    if (category) {
      finalTags.push(category);
    }

    // Enhanced metadata
    const enhancedMetadata = {
      ...metadata,
      createdBy: "memory_tool",
      autoGenerated: !embedding,
      contentLength: content.length,
      timestamp: new Date().toISOString(),
      toolDrivenMode: conversationManager.instance.isToolDrivenMode(),
      ...(reasoning && { reasoning }),
      ...(category && { category }),
    };

    try {
      const memoryDb = getMemoryDatabase();
      const memory = await memoryDb.createWithEmbedding(
        content,
        finalEmbedding,
        userId,
        guildId,
        {
          importance,
          tags: finalTags,
          metadata: enhancedMetadata,
        },
      );

      logger.info(`Saved enhanced long-term memory: ${memory.id}`, {
        contentLength: content.length,
        userId,
        guildId,
        importance,
        category,
        tags: finalTags,
        reasoning: reasoning ? "provided" : "not provided",
        toolDrivenMode: conversationManager.instance.isToolDrivenMode(),
      });

      return {
        success: true,
        memoryId: memory.id,
        content: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
        importance,
        category,
        tags: finalTags,
        reasoning,
        metadata: enhancedMetadata,
        message: `Memory saved successfully with importance ${importance}${category ? ` in category '${category}'` : ""}`,
      };
    } catch (error) {
      logger.error("Failed to save memory:", error);
      throw new Error("Memory save failed");
    }
  },
};

export const searchLongTermMemory: ToolDefinition = {
  name: "search_long_term_memory",
  description:
    "Search long-term memories with enhanced filtering and ranking. Use this when you need to find relevant information from past conversations.",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "Text query to search for in memories.",
      required: true,
    },
    {
      name: "purpose",
      type: "string",
      description:
        "Why are you searching for this information? (helps with relevance)",
      required: false,
    },
    {
      name: "topK",
      type: "number",
      description: "Number of top results to return (default 5, max 20)",
      required: false,
    },
    {
      name: "userId",
      type: "number",
      description: "User ID to filter results (optional)",
      required: false,
    },
    {
      name: "guildId",
      type: "number",
      description: "Guild ID to filter results (optional)",
      required: false,
    },
    {
      name: "minSimilarity",
      type: "number",
      description: "Minimum similarity threshold 0-1 (default 0.5)",
      required: false,
    },
    {
      name: "categories",
      type: "array",
      description: "Filter by memory categories",
      required: false,
    },
    {
      name: "tags",
      type: "array",
      description: "Filter by specific tags (optional)",
      required: false,
    },
    {
      name: "importanceThreshold",
      type: "number",
      description: "Minimum importance level 1-10 (optional)",
      required: false,
    },
    {
      name: "includeMetadata",
      type: "boolean",
      description: "Include memory metadata in results (default false)",
      required: false,
    },
    {
      name: "includeReasoning",
      type: "boolean",
      description: "Include reasoning for why memories were saved",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const {
      query,
      purpose,
      topK = 5,
      userId,
      guildId,
      minSimilarity = 0.5,
      categories = [],
      tags = [],
      importanceThreshold = 0,
      includeMetadata = false,
      includeReasoning = false,
    } = args;

    if (typeof query !== "string" || query.trim().length === 0) {
      throw new Error("Query must be a non-empty string");
    }

    // Check tool permissions
    const conversationManager = getConversationManager();
    const permissions = conversationManager.instance.getToolPermissions();
    if (!permissions.allowSearch) {
      throw new Error("Memory searching is not permitted");
    }

    // Validate topK
    const finalTopK = Math.min(Math.max(topK, 1), 20);

    // Validate similarity threshold
    if (minSimilarity < 0 || minSimilarity > 1) {
      throw new Error("minSimilarity must be between 0 and 1");
    }

    // Validate importance threshold
    if (importanceThreshold < 0 || importanceThreshold > 10) {
      throw new Error("importanceThreshold must be between 0 and 10");
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);

      const memoryDb = getMemoryDatabase();

      // Combine categories and tags for filtering
      const allTags = [...tags, ...categories];

      const results = await memoryDb.findSimilar(queryEmbedding, {
        userId,
        guildId,
        topK: finalTopK * 3, // Get more candidates for better filtering
        minSimilarity,
        tags: allTags,
        importanceThreshold,
      });

      // Enhanced filtering with intelligent ranking
      const filteredResults = results
        .filter((result) => result.similarity >= minSimilarity)
        .map((result) => {
          const baseResult = {
            id: result.data.id,
            content: result.data.content,
            similarity: Math.round(result.similarity * 100) / 100,
            createdAt: result.data.createdAt,
            lastAccessedAt: result.data.lastAccessedAt,
            accessCount: result.data.accessCount,
            importance: result.data.importance,
            userId: result.data.userId,
            guildId: result.data.guildId,
            tags: result.data.tags,
            category: result.data.metadata?.category || "unknown",
            relevanceScore: calculateRelevanceScore(result, purpose),
          };

          if (includeMetadata) {
            baseResult.metadata = result.data.metadata;
          }

          if (includeReasoning && result.data.metadata?.reasoning) {
            baseResult.reasoning = result.data.metadata.reasoning;
          }

          return baseResult;
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, finalTopK);

      // Update access counts for retrieved memories
      for (const result of filteredResults) {
        try {
          await memoryDb.updateAccess(result.id);
        } catch (error) {
          logger.warn(
            `Failed to update access count for memory ${result.id}:`,
            error,
          );
        }
      }

      logger.debug(`Enhanced memory search completed`, {
        query: query.slice(0, 50),
        purpose: purpose || "not specified",
        resultsFound: filteredResults.length,
        topSimilarity: filteredResults[0]?.similarity || 0,
        averageImportance:
          filteredResults.reduce((sum, r) => sum + r.importance, 0) /
            filteredResults.length || 0,
        toolDrivenMode: conversationManager.instance.isToolDrivenMode(),
      });

      return {
        query,
        purpose,
        results: filteredResults,
        totalFound: filteredResults.length,
        searchedAt: new Date().toISOString(),
        searchOptions: {
          topK: finalTopK,
          minSimilarity,
          importanceThreshold,
          categories,
          tags,
        },
        insights:
          filteredResults.length > 0
            ? await generateSearchInsights(filteredResults)
            : null,
      };
    } catch (error) {
      logger.error("Memory search failed:", error);
      throw new Error("Memory search failed");
    }
  },
};

export const getConversationStats: ToolDefinition = {
  name: "get_conversation_stats",
  description:
    "Get comprehensive statistics about current conversation contexts and enhanced memory usage.",
  parameters: [
    {
      name: "includeAnalytics",
      type: "boolean",
      description: "Include detailed memory analytics (default false)",
      required: false,
    },
    {
      name: "includeConfig",
      type: "boolean",
      description: "Include memory configuration details",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const { includeAnalytics = false, includeConfig = false } = args;

    try {
      const conversationManager = getConversationManager();
      const stats = conversationManager.instance.getStats();

      let memoryStats = {};
      try {
        const memoryDb = getMemoryDatabase();
        const memoryCount = await memoryDb.count();
        memoryStats = { totalMemories: memoryCount };

        if (includeAnalytics) {
          const analytics = await memoryDb.getAnalytics();
          memoryStats = { ...memoryStats, ...analytics };
        }
      } catch (error) {
        logger.warn("Failed to get memory stats:", error);
        memoryStats = { totalMemories: 0, error: "Memory stats unavailable" };
      }

      const response = {
        conversation: stats,
        memory: memoryStats,
        toolDrivenMode: conversationManager.instance.isToolDrivenMode(),
        permissions: conversationManager.instance.getToolPermissions(),
        timestamp: new Date().toISOString(),
      };

      if (includeConfig) {
        response.configuration = {
          toolDrivenMode: conversationManager.instance.isToolDrivenMode(),
          autoTransferEnabled:
            !conversationManager.instance.config.disableAutoTransfer,
          memoryDecisionThreshold:
            conversationManager.instance.config.memoryDecisionThreshold,
          enabledCategories:
            conversationManager.instance.config.memoryCategories,
        };
      }

      return response;
    } catch (error) {
      logger.error("Failed to get conversation stats:", error);
      throw new Error("Stats retrieval failed");
    }
  },
};

export const clearConversationContext: ToolDefinition = {
  name: "clear_conversation_context",
  description:
    "Clear conversation context for a specific user or channel with enhanced options.",
  parameters: [
    {
      name: "type",
      type: "string",
      description:
        "Context type: 'user' for DMs or 'channel' for guild channels",
      required: true,
      enum: ["user", "channel"],
    },
    {
      name: "id",
      type: "string",
      description: "User ID or Channel ID to clear context for",
      required: true,
    },
    {
      name: "transferToLongTerm",
      type: "boolean",
      description:
        "Whether to transfer current messages to long-term memory before clearing (default: true)",
      required: false,
    },
    {
      name: "preserveImportant",
      type: "boolean",
      description:
        "Whether to preserve important messages in long-term memory (default: true)",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const {
      type,
      id,
      transferToLongTerm = true,
      preserveImportant = true,
    } = args;

    if (!["user", "channel"].includes(type)) {
      throw new Error("Type must be 'user' or 'channel'");
    }

    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error("ID must be a non-empty string");
    }

    try {
      const conversationManager = getConversationManager();

      // Get current context before clearing
      const currentHistory = conversationManager.instance.getHistory(
        type as "user" | "channel",
        id,
      );

      let transferredCount = 0;
      if (transferToLongTerm && currentHistory.length > 0) {
        // Transfer to long-term memory before clearing
        try {
          await conversationManager.instance.transferAllToLongTerm();
          transferredCount = currentHistory.length;
          logger.info(
            `Transferred ${transferredCount} messages to long-term memory before clearing context`,
          );
        } catch (error) {
          logger.error(
            "Failed to transfer messages to long-term memory:",
            error,
          );
        }
      }

      // Clear the context
      await conversationManager.instance.clearContext(
        type as "user" | "channel",
        id,
        transferToLongTerm,
      );

      return {
        success: true,
        clearedMessages: currentHistory.length,
        transferredMessages: transferredCount,
        transferredToLongTerm: transferToLongTerm,
        preservedImportant: preserveImportant,
        contextKey: `${type}:${id}`,
        clearedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to clear conversation context:", error);
      throw new Error("Context clearing failed");
    }
  },
};

/**
 * Generate tags for content using simple keyword extraction
 */
async function generateTags(content: string): Promise<string[]> {
  const tags: string[] = [];
  const contentLower = content.toLowerCase();

  // Enhanced keyword-based tagging for tool-driven mode
  const keywords = [
    { pattern: /\b(help|assistance|support)\b/g, tag: "help" },
    { pattern: /\b(code|programming|development)\b/g, tag: "coding" },
    { pattern: /\b(question|ask|wondering)\b/g, tag: "question" },
    { pattern: /\b(error|bug|issue|problem)\b/g, tag: "error" },
    { pattern: /\b(learn|learning|tutorial)\b/g, tag: "learning" },
    { pattern: /\b(discussion|chat|conversation)\b/g, tag: "discussion" },
    { pattern: /\b(important|urgent|critical)\b/g, tag: "important" },
    { pattern: /\b(meeting|appointment|schedule)\b/g, tag: "meeting" },
    { pattern: /\b(project|task|work)\b/g, tag: "project" },
    { pattern: /\b(idea|suggestion|proposal)\b/g, tag: "idea" },
    { pattern: /\b(prefer|like|dislike|hate)\b/g, tag: "preference" },
    { pattern: /\b(decide|decision|choose|choice)\b/g, tag: "decision" },
    { pattern: /\b(remember|recall|remind)\b/g, tag: "memory" },
    { pattern: /\b(fact|information|data)\b/g, tag: "fact" },
    { pattern: /\b(solution|solve|fix|resolved)\b/g, tag: "solution" },
    { pattern: /\b(insight|realization|understanding)\b/g, tag: "insight" },
  ];

  for (const keyword of keywords) {
    if (keyword.pattern.test(contentLower)) {
      tags.push(keyword.tag);
    }
  }

  // Add length-based tags
  if (content.length > 500) {
    tags.push("long_content");
  } else if (content.length < 50) {
    tags.push("short_content");
  }

  // Add context-based tags
  const conversationManager = getConversationManager();
  if (conversationManager.instance.isToolDrivenMode()) {
    tags.push("tool_driven");
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Calculate relevance score for search results
 */
function calculateRelevanceScore(result: any, purpose?: string): number {
  let score = result.similarity * 0.4; // Base similarity score

  // Add importance weighting
  score += (result.data.importance / 10) * 0.3;

  // Add recency bonus
  const daysSinceCreated =
    (Date.now() - new Date(result.data.createdAt).getTime()) /
    (1000 * 60 * 60 * 24);
  const recencyBonus = Math.max(0, 1 - daysSinceCreated / 30) * 0.1;
  score += recencyBonus;

  // Add access frequency bonus
  const accessBonus = Math.min(result.data.accessCount / 10, 1) * 0.1;
  score += accessBonus;

  // Purpose-based bonus
  if (purpose && result.data.metadata?.reasoning) {
    const reasoningLower = result.data.metadata.reasoning.toLowerCase();
    const purposeLower = purpose.toLowerCase();
    if (
      reasoningLower.includes(purposeLower) ||
      purposeLower.includes(reasoningLower)
    ) {
      score += 0.1;
    }
  }

  return Math.min(score, 1.0);
}

/**
 * Generate search insights
 */
async function generateSearchInsights(
  results: MemorySearchResult[],
): Promise<any> {
  const categories = new Set();
  const tags = new Set();
  let totalImportance = 0;

  for (const result of results) {
    if (result.category) categories.add(result.category);
    result.tags.forEach((tag: string) => tags.add(tag));
    totalImportance += result.importance;
  }

  return {
    totalResults: results.length,
    categories: Array.from(categories),
    commonTags: Array.from(tags).slice(0, 10),
    averageImportance: totalImportance / results.length,
    highImportanceCount: results.filter((r) => r.importance >= 8).length,
    recentCount: results.filter((r) => {
      const daysSince =
        (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    }).length,
  };
}

export const getMemoryAnalytics: ToolDefinition = {
  name: "get_memory_analytics",
  description:
    "Get detailed analytics about the memory system including usage patterns and insights.",
  parameters: [],
  handler: async (args, context) => {
    try {
      const memoryDb = getMemoryDatabase();
      const analytics = await memoryDb.getAnalytics();

      return {
        success: true,
        analytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get memory analytics:", error);
      throw new Error("Memory analytics retrieval failed");
    }
  },
};
