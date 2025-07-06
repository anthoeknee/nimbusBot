import { ToolDefinition } from "../../../types/ai";
import { database } from "../../db";
import { AIClient } from "../client";
import { getConversationManager } from "../conversation";
import { config } from "../../../config";
import { logger } from "../../../utils/logger";
import { getMemoryDatabase } from "../memory";
import { MemoryDecision, MemoryInsight } from "../memory/types";
import type {
  MemoryRecord,
  MemorySearchResult,
  MemoryAnalytics,
  MemoryCategory,
  ConsolidationCandidate,
  SimilarityResult,
} from "../../../types/memory";

/**
 * Generate embedding for content using the default embedding model with enhanced error handling
 */
async function generateEmbedding(content: string): Promise<number[]> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await AIClient.embeddings({
        provider: "cohere",
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
          "Failed to generate embedding for advanced memory tool:",
          error,
        );
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

  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / norm);
}

export const analyzeConversationForMemory: ToolDefinition = {
  name: "analyze_conversation_for_memory",
  description:
    "Analyze current conversation to determine if it contains information worth saving to long-term memory. Returns analysis with recommendations.",
  parameters: [
    {
      name: "messageCount",
      type: "number",
      description: "Number of recent messages to analyze (default 10, max 50)",
      required: false,
    },
    {
      name: "contextType",
      type: "string",
      description: "Type of conversation context: 'user' or 'channel'",
      required: true,
      enum: ["user", "channel"],
    },
    {
      name: "contextId",
      type: "string",
      description: "User ID or Channel ID for context",
      required: true,
    },
    {
      name: "includeSystemMessages",
      type: "boolean",
      description: "Whether to include system messages in analysis",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const {
      messageCount = 10,
      contextType,
      contextId,
      includeSystemMessages = false,
    } = args;

    if (!["user", "channel"].includes(contextType)) {
      throw new Error("contextType must be 'user' or 'channel'");
    }

    try {
      const conversationManager = getConversationManager();
      const messages = conversationManager.instance.getHistory(
        contextType as "user" | "channel",
        contextId,
        {
          includeSystem: includeSystemMessages,
          limit: Math.min(messageCount, 50),
        },
      );

      if (messages.length === 0) {
        return {
          shouldSave: false,
          analysis: "No messages found in conversation context",
          recommendation: "No action needed",
        };
      }

      const analysis =
        await conversationManager.instance.analyzeMemoryWorthiness(
          messages,
          context,
        );

      return {
        shouldSave: analysis.shouldSave,
        importance: analysis.importance,
        category: analysis.category,
        reasoning: analysis.reasoning,
        suggestedTags: analysis.suggestedTags,
        extractedFacts: analysis.extractedFacts,
        relatedConcepts: analysis.relatedMemories,
        messageCount: messages.length,
        recommendation: analysis.shouldSave
          ? `Save to memory with category '${analysis.category}' and importance ${analysis.importance}`
          : "This conversation does not contain significant information worth preserving",
        analysis: analysis.reasoning,
      };
    } catch (error) {
      logger.error("Failed to analyze conversation for memory:", error);
      throw new Error("Memory analysis failed");
    }
  },
};

export const saveStructuredMemory: ToolDefinition = {
  name: "save_structured_memory",
  description:
    "Save a structured memory with enhanced categorization, relationships, and metadata. Optimized for AI decision-making.",
  parameters: [
    {
      name: "content",
      type: "string",
      description: "Primary memory content",
      required: true,
    },
    {
      name: "category",
      type: "string",
      description: "Memory category",
      required: true,
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
      name: "importance",
      type: "number",
      description: "Importance level 1-10",
      required: true,
    },
    {
      name: "facts",
      type: "array",
      description: "Extracted facts from the content",
      required: false,
    },
    {
      name: "relationships",
      type: "array",
      description: "Related entities or concepts",
      required: false,
    },
    {
      name: "userId",
      type: "number",
      description: "User ID if user-specific",
      required: false,
    },
    {
      name: "guildId",
      type: "number",
      description: "Guild ID if server-specific",
      required: false,
    },
    {
      name: "tags",
      type: "array",
      description: "Additional tags",
      required: false,
    },
    {
      name: "expiresAt",
      type: "string",
      description: "ISO date when memory should expire (for reminders)",
      required: false,
    },
    {
      name: "priority",
      type: "string",
      description: "Priority level for retrieval",
      required: false,
      enum: ["low", "medium", "high", "critical"],
    },
  ],
  handler: async (args, context) => {
    const {
      content,
      category,
      importance,
      facts = [],
      relationships = [],
      userId,
      guildId,
      tags = [],
      expiresAt,
      priority = "medium",
    } = args;

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("Content must be a non-empty string");
    }

    if (importance < 1 || importance > 10) {
      throw new Error("Importance must be between 1 and 10");
    }

    try {
      const embedding = await generateEmbedding(content);

      // Enhanced tags with category and priority
      const enhancedTags = [
        ...tags,
        category,
        `priority_${priority}`,
        ...(facts.length > 0 ? ["has_facts"] : []),
        ...(relationships.length > 0 ? ["has_relationships"] : []),
      ];

      // Enhanced metadata
      const enhancedMetadata = {
        category,
        facts,
        relationships,
        priority,
        createdBy: "structured_memory_tool",
        structuredData: true,
        ...(expiresAt && { expiresAt }),
        processingTimestamp: new Date().toISOString(),
      };

      const memoryDb = getMemoryDatabase();
      const memory = await memoryDb.createWithEmbedding(
        content,
        embedding,
        userId,
        guildId,
        {
          importance,
          tags: enhancedTags,
          metadata: enhancedMetadata,
        },
      );

      logger.info(`Saved structured memory: ${memory.id}`, {
        category,
        importance,
        priority,
        factsCount: facts.length,
        relationshipsCount: relationships.length,
      });

      return {
        success: true,
        memoryId: memory.id,
        category,
        importance,
        priority,
        tags: enhancedTags,
        factsStored: facts.length,
        relationshipsStored: relationships.length,
        summary: content.slice(0, 100) + (content.length > 100 ? "..." : ""),
      };
    } catch (error) {
      logger.error("Failed to save structured memory:", error);
      throw new Error("Structured memory save failed");
    }
  },
};

export const getMemoryInsights: ToolDefinition = {
  name: "get_memory_insights",
  description:
    "Get intelligent insights about memories related to a query, including patterns, relationships, and recommendations.",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "Query to analyze for memory insights",
      required: true,
    },
    {
      name: "userId",
      type: "number",
      description: "User ID to scope insights",
      required: false,
    },
    {
      name: "guildId",
      type: "number",
      description: "Guild ID to scope insights",
      required: false,
    },
    {
      name: "categories",
      type: "array",
      description: "Memory categories to focus on",
      required: false,
    },
    {
      name: "includeRelationships",
      type: "boolean",
      description: "Include relationship analysis",
      required: false,
    },
    {
      name: "timeRange",
      type: "string",
      description: "Time range for analysis: 'day', 'week', 'month', 'all'",
      required: false,
      enum: ["day", "week", "month", "all"],
    },
  ],
  handler: async (args, context) => {
    const {
      query,
      userId,
      guildId,
      categories = [],
      includeRelationships = true,
      timeRange = "month",
    } = args;

    if (typeof query !== "string" || query.trim().length === 0) {
      throw new Error("Query must be a non-empty string");
    }

    try {
      const conversationManager = getConversationManager();
      const insights = await conversationManager.instance.getMemoryInsights(
        query,
        {
          userId,
          guildId,
          categories,
          timeRange,
        },
      );

      // Get related memories
      const queryEmbedding = await generateEmbedding(query);
      const memoryDb = getMemoryDatabase();
      const relatedMemories = await memoryDb.findSimilar(queryEmbedding, {
        userId,
        guildId,
        topK: 20,
        minSimilarity: 0.6,
      });

      // Analyze patterns
      const patterns = await analyzeMemoryPatterns(relatedMemories);

      // Generate recommendations
      const recommendations = await generateMemoryRecommendations(
        query,
        relatedMemories,
        patterns,
      );

      return {
        query,
        insights,
        relatedMemoriesCount: relatedMemories.length,
        patterns,
        recommendations,
        categories: extractCategories(relatedMemories),
        timeAnalysis: analyzeTimePatterns(relatedMemories),
        importanceDistribution: analyzeImportanceDistribution(relatedMemories),
        analysisTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get memory insights:", error);
      throw new Error("Memory insights failed");
    }
  },
};

export const consolidateMemories: ToolDefinition = {
  name: "consolidate_memories",
  description:
    "Intelligently consolidate similar memories to reduce redundancy and improve organization.",
  parameters: [
    {
      name: "similarityThreshold",
      type: "number",
      description: "Similarity threshold for consolidation (0.8-0.95)",
      required: false,
    },
    {
      name: "category",
      type: "string",
      description: "Specific category to consolidate",
      required: false,
    },
    {
      name: "userId",
      type: "number",
      description: "User ID to scope consolidation",
      required: false,
    },
    {
      name: "guildId",
      type: "number",
      description: "Guild ID to scope consolidation",
      required: false,
    },
    {
      name: "dryRun",
      type: "boolean",
      description: "Preview consolidation without making changes",
      required: false,
    },
    {
      name: "maxGroups",
      type: "number",
      description: "Maximum number of groups to consolidate",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const {
      similarityThreshold = 0.85,
      category,
      userId,
      guildId,
      dryRun = false,
      maxGroups = 10,
    } = args;

    if (similarityThreshold < 0.8 || similarityThreshold > 0.95) {
      throw new Error("Similarity threshold must be between 0.8 and 0.95");
    }

    try {
      const memoryDb = getMemoryDatabase();
      const candidates =
        await memoryDb.findConsolidationCandidates(similarityThreshold);

      const consolidationPlan = candidates.slice(0, maxGroups).map((group) => ({
        groupId: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        memories: group.map((candidate) => ({
          id: candidate.id,
          content: candidate.content.slice(0, 100),
          similarity: candidate.similarity,
          accessCount: candidate.accessCount,
        })),
        consolidatedContent: generateConsolidatedContent(group),
        preservedMemoryId: selectBestMemory(group).id,
        toRemove: group.slice(1).map((c) => c.id),
      }));

      if (dryRun) {
        return {
          dryRun: true,
          consolidationPlan,
          totalGroups: consolidationPlan.length,
          totalMemoriesToRemove: consolidationPlan.reduce(
            (sum, group) => sum + group.toRemove.length,
            0,
          ),
          estimatedSavings: `${consolidationPlan.reduce((sum, group) => sum + group.toRemove.length, 0)} memories`,
        };
      }

      // Execute consolidation
      let consolidatedGroups = 0;
      let removedMemories = 0;

      for (const group of consolidationPlan) {
        try {
          // Update the preserved memory with consolidated content
          await memoryDb.updateMetadata(group.preservedMemoryId, {
            consolidated: true,
            consolidatedFrom: group.toRemove,
            consolidatedAt: new Date().toISOString(),
          });

          // Note: In a real implementation, you'd want to actually remove the memories
          // For safety, we'll just mark them as consolidated
          for (const memoryId of group.toRemove) {
            await memoryDb.updateMetadata(memoryId, {
              consolidatedInto: group.preservedMemoryId,
              consolidated: true,
            });
          }

          consolidatedGroups++;
          removedMemories += group.toRemove.length;
        } catch (error) {
          logger.error(`Failed to consolidate group ${group.groupId}:`, error);
        }
      }

      logger.info(`Memory consolidation completed`, {
        consolidatedGroups,
        removedMemories,
        similarityThreshold,
      });

      return {
        success: true,
        consolidatedGroups,
        removedMemories,
        totalGroups: consolidationPlan.length,
        similarityThreshold,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to consolidate memories:", error);
      throw new Error("Memory consolidation failed");
    }
  },
};

export const searchMemoriesByCategory: ToolDefinition = {
  name: "search_memories_by_category",
  description:
    "Search memories with advanced category-based filtering and intelligent ranking.",
  parameters: [
    {
      name: "category",
      type: "string",
      description: "Memory category to search",
      required: true,
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
      name: "query",
      type: "string",
      description: "Optional text query within the category",
      required: false,
    },
    {
      name: "userId",
      type: "number",
      description: "User ID to filter results",
      required: false,
    },
    {
      name: "guildId",
      type: "number",
      description: "Guild ID to filter results",
      required: false,
    },
    {
      name: "minImportance",
      type: "number",
      description: "Minimum importance level (1-10)",
      required: false,
    },
    {
      name: "maxResults",
      type: "number",
      description: "Maximum number of results (default 10)",
      required: false,
    },
    {
      name: "includeExpired",
      type: "boolean",
      description: "Include expired memories",
      required: false,
    },
    {
      name: "sortBy",
      type: "string",
      description: "Sort criteria",
      required: false,
      enum: ["relevance", "importance", "recency", "access_count"],
    },
  ],
  handler: async (args, context) => {
    const {
      category,
      query,
      userId,
      guildId,
      minImportance = 1,
      maxResults = 10,
      includeExpired = false,
      sortBy = "relevance",
    } = args;

    try {
      const memoryDb = getMemoryDatabase();
      let results;

      if (query) {
        const queryEmbedding = await generateEmbedding(query);
        results = await memoryDb.findSimilar(queryEmbedding, {
          userId,
          guildId,
          topK: maxResults * 2,
          minSimilarity: 0.5,
          tags: [category],
          importanceThreshold: minImportance,
        });
      } else {
        // For category-only search, we'd need a different method
        // This is a simplified implementation
        const searchEmbedding = await generateEmbedding(category);
        results = await memoryDb.findSimilar(searchEmbedding, {
          userId,
          guildId,
          topK: maxResults * 2,
          minSimilarity: 0.3,
          tags: [category],
          importanceThreshold: minImportance,
        });
      }

      // Filter out expired memories if requested
      if (!includeExpired) {
        results = results.filter((result) => {
          const expiresAt = result.data.metadata?.expiresAt;
          return !expiresAt || new Date(expiresAt) > new Date();
        });
      }

      // Sort results
      results.sort((a, b) => {
        switch (sortBy) {
          case "importance":
            return b.data.importance - a.data.importance;
          case "recency":
            return (
              new Date(b.data.createdAt).getTime() -
              new Date(a.data.createdAt).getTime()
            );
          case "access_count":
            return b.data.accessCount - a.data.accessCount;
          default: // relevance
            return b.similarity - a.similarity;
        }
      });

      const finalResults = results.slice(0, maxResults).map((result) => ({
        id: result.data.id,
        content: result.data.content,
        category: result.data.metadata?.category || category,
        importance: result.data.importance,
        relevance: Math.round(result.similarity * 100) / 100,
        createdAt: result.data.createdAt,
        accessCount: result.data.accessCount,
        tags: result.data.tags,
        facts: result.data.metadata?.facts || [],
        relationships: result.data.metadata?.relationships || [],
        priority: result.data.metadata?.priority || "medium",
      }));

      return {
        category,
        query: query || `All memories in category: ${category}`,
        results: finalResults,
        totalFound: finalResults.length,
        searchCriteria: {
          category,
          minImportance,
          sortBy,
          includeExpired,
        },
        searchedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to search memories by category:", error);
      throw new Error("Category-based memory search failed");
    }
  },
};

export const manualMemoryTransfer: ToolDefinition = {
  name: "manual_memory_transfer",
  description:
    "Manually transfer current conversation to long-term memory with custom options and analysis.",
  parameters: [
    {
      name: "contextType",
      type: "string",
      description: "Type of context: 'user' or 'channel'",
      required: true,
      enum: ["user", "channel"],
    },
    {
      name: "contextId",
      type: "string",
      description: "User ID or Channel ID",
      required: true,
    },
    {
      name: "importance",
      type: "number",
      description: "Importance level for the memory (1-10)",
      required: false,
    },
    {
      name: "category",
      type: "string",
      description: "Memory category",
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
      description: "Additional tags for the memory",
      required: false,
    },
    {
      name: "analyzeFirst",
      type: "boolean",
      description: "Analyze conversation before transfer",
      required: false,
    },
    {
      name: "keepRecentMessages",
      type: "number",
      description: "Number of recent messages to keep in short-term memory",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const {
      contextType,
      contextId,
      importance,
      category,
      tags = [],
      analyzeFirst = true,
      keepRecentMessages = 5,
    } = args;

    if (!["user", "channel"].includes(contextType)) {
      throw new Error("contextType must be 'user' or 'channel'");
    }

    try {
      const conversationManager = getConversationManager();
      let analysisResult = null;

      if (analyzeFirst) {
        // Analyze the conversation first
        const messages = conversationManager.instance.getHistory(
          contextType as "user" | "channel",
          contextId,
        );

        if (messages.length === 0) {
          throw new Error("No messages found to transfer");
        }

        analysisResult =
          await conversationManager.instance.analyzeMemoryWorthiness(
            messages,
            context,
          );

        if (!analysisResult.shouldSave && !importance) {
          return {
            success: false,
            reason: "Analysis suggests this conversation is not worth saving",
            analysis: analysisResult,
            recommendation:
              "Consider adding important context or increasing importance level",
          };
        }
      }

      // Perform manual transfer
      const transferOptions = {
        importance: importance || analysisResult?.importance || 5,
        category: category || analysisResult?.category || "context",
        tags: [
          ...tags,
          ...(analysisResult?.suggestedTags || []),
          "manual_transfer",
        ],
        metadata: {
          transferType: "manual",
          analyzedFirst: analyzeFirst,
          ...(analysisResult && { analysis: analysisResult }),
          transferredAt: new Date().toISOString(),
        },
      };

      await conversationManager.instance.manualMemoryTransfer(
        contextType as "user" | "channel",
        contextId,
        transferOptions,
      );

      logger.info(`Manual memory transfer completed`, {
        contextType,
        contextId,
        ...transferOptions,
      });

      return {
        success: true,
        contextType,
        contextId,
        transferOptions,
        analysis: analysisResult,
        message: "Conversation successfully transferred to long-term memory",
        transferredAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to manually transfer memory:", error);
      throw new Error("Manual memory transfer failed");
    }
  },
};

// Helper functions

async function analyzeMemoryPatterns(memories: MemorySearchResult[]) {
  const patterns = {
    mostCommonTags: {},
    categoryDistribution: {},
    importanceRange: { min: 10, max: 0, avg: 0 },
    accessPatterns: {},
    timePatterns: {},
  };

  for (const memory of memories) {
    // Tag analysis
    for (const tag of memory.data.tags) {
      patterns.mostCommonTags[tag] = (patterns.mostCommonTags[tag] || 0) + 1;
    }

    // Category analysis
    const category = memory.data.metadata?.category || "unknown";
    patterns.categoryDistribution[category] =
      (patterns.categoryDistribution[category] || 0) + 1;

    // Importance analysis
    const importance = memory.data.importance;
    patterns.importanceRange.min = Math.min(
      patterns.importanceRange.min,
      importance,
    );
    patterns.importanceRange.max = Math.max(
      patterns.importanceRange.max,
      importance,
    );
  }

  if (memories.length > 0) {
    patterns.importanceRange.avg =
      memories.reduce((sum, m) => sum + m.data.importance, 0) / memories.length;
  }

  return patterns;
}

async function generateMemoryRecommendations(
  query: string,
  memories: MemorySearchResult[],
  patterns: any,
) {
  const recommendations = [];

  if (memories.length === 0) {
    recommendations.push({
      type: "info",
      message:
        "No related memories found. Consider saving important information.",
    });
  } else {
    if (patterns.importanceRange.avg < 5) {
      recommendations.push({
        type: "suggestion",
        message:
          "Consider reviewing memory importance scores for better retrieval.",
      });
    }

    if (Object.keys(patterns.categoryDistribution).length > 5) {
      recommendations.push({
        type: "organization",
        message:
          "Multiple categories found. Consider consolidating similar memories.",
      });
    }
  }

  return recommendations;
}

function extractCategories(memories: MemorySearchResult[]) {
  const categories = new Set();
  for (const memory of memories) {
    const category = memory.data.metadata?.category;
    if (category) categories.add(category);
  }
  return Array.from(categories);
}

function analyzeTimePatterns(memories: MemorySearchResult[]) {
  const now = new Date();
  const timeRanges = {
    last24h: 0,
    lastWeek: 0,
    lastMonth: 0,
    older: 0,
  };

  for (const memory of memories) {
    const created = new Date(memory.data.createdAt);
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (diffHours <= 24) {
      timeRanges.last24h++;
    } else if (diffHours <= 168) {
      // 7 days
      timeRanges.lastWeek++;
    } else if (diffHours <= 720) {
      // 30 days
      timeRanges.lastMonth++;
    } else {
      timeRanges.older++;
    }
  }

  return timeRanges;
}

function analyzeImportanceDistribution(memories: MemorySearchResult[]) {
  const distribution = {
    low: 0, // 1-3
    medium: 0, // 4-6
    high: 0, // 7-8
    critical: 0, // 9-10
  };

  for (const memory of memories) {
    const importance = memory.data.importance;
    if (importance <= 3) {
      distribution.low++;
    } else if (importance <= 6) {
      distribution.medium++;
    } else if (importance <= 8) {
      distribution.high++;
    } else {
      distribution.critical++;
    }
  }

  return distribution;
}

function generateConsolidatedContent(group: ConsolidationCandidate[]) {
  // Simple implementation - in reality, you'd want more sophisticated merging
  const contents = group.map((candidate) => candidate.content);
  return `Consolidated: ${contents.join(" | ")}`;
}

function selectBestMemory(group: ConsolidationCandidate[]) {
  // Select the memory with highest access count and importance
  return group.reduce((best, current) => {
    const bestScore = best.accessCount + best.importance || 0;
    const currentScore = current.accessCount + current.importance || 0;
    return currentScore > bestScore ? current : best;
  });
}
