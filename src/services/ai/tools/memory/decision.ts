import { ToolDefinition } from "../../../../types/ai";
import { getConversationManager } from "../../conversation";
import { logger } from "../../../../utils/logger";
import { database } from "../../../db";
import type {
  MemoryWorthinessAnalysis,
  MemoryDecisionContext,
  MemoryInsight,
  ToolMemoryContext,
  MemoryRelationship,
  MemoryRecord,
} from "../../memory/types";

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const conversationManager = getConversationManager();
    return await (
      conversationManager.instance as any
    ).memoryManager.generateEmbedding(text);
  } catch (error) {
    logger.error("Error generating embedding for memory decision", error);
    return new Array(1024).fill(0);
  }
}

function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  return dotProduct / (magnitudeA * magnitudeB);
}

export const makeMemoryDecision: ToolDefinition = {
  name: "make_memory_decision",
  description:
    "Make an intelligent decision about whether conversation content should be saved to memory, considering context, importance, and existing memories.",
  parameters: [
    {
      name: "conversation_messages",
      type: "array",
      description: "Array of conversation messages to analyze",
      required: true,
    },
    {
      name: "decision_criteria",
      type: "object",
      description:
        "Criteria for making the decision (importance_threshold, category_preferences, etc.)",
      required: false,
    },
    {
      name: "context_window",
      type: "number",
      description: "Number of recent messages to consider for context",
      required: false,
      default: 10,
    },
    {
      name: "check_existing_memories",
      type: "boolean",
      description:
        "Whether to check for duplicate or similar existing memories",
      required: false,
      default: true,
    },
  ],
  handler: async (args: any, context: ToolMemoryContext): Promise<any> => {
    try {
      const {
        conversation_messages,
        decision_criteria = {},
        context_window = 10,
        check_existing_memories = true,
      } = args;

      logger.info("Making memory decision", {
        messageCount: conversation_messages.length,
        contextWindow: context_window,
        checkExisting: check_existing_memories,
      });

      const conversationManager = getConversationManager();

      // Extract relevant messages for analysis
      const relevantMessages = conversation_messages.slice(-context_window);
      const combinedContent = relevantMessages
        .map((m) => (typeof m.content === "string" ? m.content : "[Media]"))
        .join(" ");

      // Analyze conversation context
      const contextAnalysis = await performConversationContextAnalysis(
        relevantMessages,
        context,
      );

      // Calculate importance scores
      const importanceScores = await calculateImportanceScores(
        relevantMessages,
        contextAnalysis,
      );

      // Determine memory categories
      const suggestedCategories = await determinePotentialCategories(
        combinedContent,
        contextAnalysis,
      );

      // Check for existing similar memories
      let similarMemories: any[] = [];
      if (check_existing_memories) {
        similarMemories = await findSimilarMemories(combinedContent, context);
      }

      // Make the decision
      const decision = await makeIntelligentDecision(
        combinedContent,
        contextAnalysis,
        importanceScores,
        suggestedCategories,
        similarMemories,
        decision_criteria,
      );

      logger.info("Memory decision made", {
        decision: decision.decision,
        confidence: decision.confidence,
        importance: decision.importance,
        category: decision.category,
      });

      return decision;
    } catch (error) {
      logger.error("Error making memory decision", error);
      throw new Error(`Memory decision failed: ${error.message}`);
    }
  },
};

export const analyzeConversationContext: ToolDefinition = {
  name: "analyze_conversation_context",
  description:
    "Analyze the context of a conversation to understand participants, topics, emotional tone, and decision-making patterns.",
  parameters: [
    {
      name: "messages",
      type: "array",
      description: "Array of conversation messages to analyze",
      required: true,
    },
    {
      name: "analysis_depth",
      type: "string",
      description: "Depth of analysis: 'basic', 'detailed', 'comprehensive'",
      required: false,
      default: "detailed",
      enum: ["basic", "detailed", "comprehensive"],
    },
    {
      name: "include_sentiment",
      type: "boolean",
      description: "Whether to include sentiment analysis",
      required: false,
      default: true,
    },
    {
      name: "include_topics",
      type: "boolean",
      description: "Whether to include topic extraction",
      required: false,
      default: true,
    },
  ],
  handler: async (args: any, context: ToolMemoryContext): Promise<any> => {
    try {
      const {
        messages,
        analysis_depth = "detailed",
        include_sentiment = true,
        include_topics = true,
      } = args;

      logger.info("Analyzing conversation context", {
        messageCount: messages.length,
        depth: analysis_depth,
        includeSentiment: include_sentiment,
        includeTopics: include_topics,
      });

      const analysis = {
        basic: await performBasicAnalysis(messages),
        detailed: null as any,
        comprehensive: null as any,
      };

      if (analysis_depth === "detailed" || analysis_depth === "comprehensive") {
        analysis.detailed = await performDetailedAnalysis(
          messages,
          include_sentiment,
          include_topics,
        );
      }

      if (analysis_depth === "comprehensive") {
        analysis.comprehensive = await performComprehensiveAnalysis(
          messages,
          context,
        );
      }

      return {
        analysis_depth,
        timestamp: new Date().toISOString(),
        ...analysis.basic,
        ...(analysis.detailed || {}),
        ...(analysis.comprehensive || {}),
      };
    } catch (error) {
      logger.error("Error analyzing conversation context", error);
      throw new Error(`Conversation context analysis failed: ${error.message}`);
    }
  },
};

export const evaluateMemoryRelevance: ToolDefinition = {
  name: "evaluate_memory_relevance",
  description:
    "Evaluate the relevance of existing memories to current conversation context and suggest which memories to retrieve or reference.",
  parameters: [
    {
      name: "current_context",
      type: "string",
      description: "Current conversation context or query",
      required: true,
    },
    {
      name: "memory_pool",
      type: "array",
      description:
        "Array of memory IDs to evaluate (if empty, evaluates all accessible memories)",
      required: false,
    },
    {
      name: "relevance_threshold",
      type: "number",
      description: "Minimum relevance score to consider a memory relevant",
      required: false,
      default: 0.6,
    },
    {
      name: "max_results",
      type: "number",
      description: "Maximum number of relevant memories to return",
      required: false,
      default: 5,
    },
  ],
  handler: async (args: any, context: ToolMemoryContext): Promise<any> => {
    try {
      const {
        current_context,
        memory_pool = [],
        relevance_threshold = 0.6,
        max_results = 5,
      } = args;

      logger.info("Evaluating memory relevance", {
        contextLength: current_context.length,
        memoryPoolSize: memory_pool.length,
        threshold: relevance_threshold,
        maxResults: max_results,
      });

      const conversationManager = getConversationManager();

      // Generate embedding for current context
      const contextEmbedding = await generateEmbedding(current_context);

      // Fetch memories to evaluate
      const memories =
        memory_pool.length > 0
          ? await fetchMemoriesById(memory_pool)
          : await fetchAccessibleMemories(context);

      // Evaluate relevance for each memory
      const relevanceScores = await Promise.all(
        memories.map(async (memory) => {
          const similarity = calculateCosineSimilarity(
            contextEmbedding,
            memory.embedding,
          );
          const contextualRelevance = await calculateContextualRelevance(
            current_context,
            memory,
            context,
          );
          const temporalRelevance = calculateTemporalRelevance(memory);
          const accessRelevance = calculateAccessRelevance(memory);

          const finalScore =
            similarity * 0.4 +
            contextualRelevance * 0.3 +
            temporalRelevance * 0.2 +
            accessRelevance * 0.1;

          return {
            memory_id: memory.id,
            content_preview: memory.content.substring(0, 100) + "...",
            relevance_score: finalScore,
            similarity_score: similarity,
            contextual_relevance: contextualRelevance,
            temporal_relevance: temporalRelevance,
            access_relevance: accessRelevance,
            category: memory.metadata?.category || "unknown",
            tags: memory.tags || [],
            last_accessed: memory.lastAccessedAt,
            importance: memory.importance,
            reasoning: generateRelevanceReasoning(
              finalScore,
              similarity,
              contextualRelevance,
              memory,
            ),
          };
        }),
      );

      // Filter and sort by relevance
      const relevantMemories = relevanceScores
        .filter((score) => score.relevance_score >= relevance_threshold)
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, max_results);

      logger.info("Memory relevance evaluation complete", {
        totalMemories: memories.length,
        relevantMemories: relevantMemories.length,
        averageRelevance:
          relevantMemories.reduce((sum, m) => sum + m.relevance_score, 0) /
          relevantMemories.length,
      });

      return {
        total_memories_evaluated: memories.length,
        relevant_memories_found: relevantMemories.length,
        relevance_threshold: relevance_threshold,
        memories: relevantMemories,
        context_analysis: {
          key_topics: extractTopics(current_context),
          context_type: determineContextType(current_context),
          urgency_level: determineUrgencyLevel(current_context),
        },
      };
    } catch (error) {
      logger.error("Error evaluating memory relevance", error);
      throw new Error(`Memory relevance evaluation failed: ${error.message}`);
    }
  },
};

export const mapMemoryRelationships: ToolDefinition = {
  name: "map_memory_relationships",
  description:
    "Analyze and map relationships between memories to understand connections, patterns, and knowledge graphs.",
  parameters: [
    {
      name: "source_memory_id",
      type: "string",
      description: "ID of the source memory to map relationships from",
      required: true,
    },
    {
      name: "relationship_types",
      type: "array",
      description:
        "Types of relationships to look for: 'similar', 'causal', 'temporal', 'categorical'",
      required: false,
      default: ["similar", "causal", "temporal", "categorical"],
      enum: [
        "similar",
        "causal",
        "temporal",
        "categorical",
        "contradictory",
        "supportive",
      ],
    },
    {
      name: "depth_limit",
      type: "number",
      description: "Maximum depth of relationship traversal",
      required: false,
      default: 3,
    },
    {
      name: "strength_threshold",
      type: "number",
      description: "Minimum relationship strength to consider",
      required: false,
      default: 0.3,
    },
  ],
  handler: async (args: any, context: ToolMemoryContext): Promise<any> => {
    try {
      const {
        source_memory_id,
        relationship_types = ["similar", "causal", "temporal", "categorical"],
        depth_limit = 3,
        strength_threshold = 0.3,
      } = args;

      logger.info("Mapping memory relationships", {
        sourceMemoryId: source_memory_id,
        relationshipTypes: relationship_types,
        depthLimit: depth_limit,
        strengthThreshold: strength_threshold,
      });

      const conversationManager = getConversationManager();

      // Fetch source memory
      const sourceMemory = await fetchMemoryById(source_memory_id);
      if (!sourceMemory) {
        throw new Error(`Source memory not found: ${source_memory_id}`);
      }

      // Find related memories
      const relatedMemories = await findRelatedMemories(sourceMemory, context);

      // Map relationships
      const relationshipMap = await buildRelationshipMap(
        sourceMemory,
        relatedMemories,
        relationship_types,
        depth_limit,
        strength_threshold,
      );

      // Generate insights
      const insights = await generateRelationshipInsights(relationshipMap);

      logger.info("Memory relationship mapping complete", {
        sourceMemoryId: source_memory_id,
        relationshipsFound: relationshipMap.relationships.length,
        connectedMemories: relationshipMap.connected_memories.length,
        insightsGenerated: insights.length,
      });

      return {
        source_memory: {
          id: sourceMemory.id,
          content_preview: sourceMemory.content.substring(0, 100) + "...",
          category: sourceMemory.metadata?.category,
          tags: sourceMemory.tags,
        },
        relationship_map: relationshipMap,
        insights: insights,
        statistics: {
          total_relationships: relationshipMap.relationships.length,
          relationship_types_found: [
            ...new Set(relationshipMap.relationships.map((r) => r.type)),
          ],
          strongest_relationship: relationshipMap.relationships.reduce(
            (max, r) => (r.strength > max.strength ? r : max),
            { strength: 0 },
          ),
          weakest_relationship: relationshipMap.relationships.reduce(
            (min, r) => (r.strength < min.strength ? r : min),
            { strength: 1 },
          ),
        },
      };
    } catch (error) {
      logger.error("Error mapping memory relationships", error);
      throw new Error(`Memory relationship mapping failed: ${error.message}`);
    }
  },
};

export const analyzeTemporalPatterns: ToolDefinition = {
  name: "analyze_temporal_patterns",
  description:
    "Analyze temporal patterns in memories and conversations to identify trends, cycles, and time-based insights.",
  parameters: [
    {
      name: "time_range",
      type: "object",
      description: "Time range to analyze (start_date, end_date)",
      required: false,
    },
    {
      name: "pattern_types",
      type: "array",
      description:
        "Types of patterns to look for: 'daily', 'weekly', 'monthly', 'seasonal'",
      required: false,
      default: ["daily", "weekly", "monthly"],
      enum: ["daily", "weekly", "monthly", "seasonal", "recurring", "trending"],
    },
    {
      name: "memory_categories",
      type: "array",
      description: "Specific memory categories to analyze",
      required: false,
    },
    {
      name: "include_predictions",
      type: "boolean",
      description: "Whether to include pattern-based predictions",
      required: false,
      default: true,
    },
  ],
  handler: async (args: any, context: ToolMemoryContext): Promise<any> => {
    try {
      const {
        time_range = {},
        pattern_types = ["daily", "weekly", "monthly"],
        memory_categories = [],
        include_predictions = true,
      } = args;

      logger.info("Analyzing temporal patterns", {
        timeRange: time_range,
        patternTypes: pattern_types,
        categoriesFilter: memory_categories,
        includePredictions: include_predictions,
      });

      // Fetch memories within time range
      const memories = await fetchMemoriesInTimeRange(
        time_range,
        memory_categories,
        context,
      );

      // Analyze patterns
      const patterns = {
        daily: pattern_types.includes("daily")
          ? await analyzeDailyPatterns(memories)
          : null,
        weekly: pattern_types.includes("weekly")
          ? await analyzeWeeklyPatterns(memories)
          : null,
        monthly: pattern_types.includes("monthly")
          ? await analyzeMonthlyPatterns(memories)
          : null,
        seasonal: pattern_types.includes("seasonal")
          ? await analyzeSeasonalPatterns(memories)
          : null,
        recurring: pattern_types.includes("recurring")
          ? await analyzeRecurringPatterns(memories)
          : null,
        trending: pattern_types.includes("trending")
          ? await analyzeTrendingPatterns(memories)
          : null,
      };

      // Generate insights
      const insights = await generateTemporalInsights(patterns, memories);

      // Generate predictions if requested
      let predictions = null;
      if (include_predictions) {
        predictions = await generateTemporalPredictions(patterns, insights);
      }

      logger.info("Temporal pattern analysis complete", {
        memoriesAnalyzed: memories.length,
        patternsFound: Object.values(patterns).filter((p) => p && p.length > 0)
          .length,
        insightsGenerated: insights.length,
        predictionsGenerated: predictions?.length || 0,
      });

      return {
        analysis_period: {
          start_date: time_range.start_date || memories[0]?.createdAt,
          end_date:
            time_range.end_date || memories[memories.length - 1]?.createdAt,
          total_memories: memories.length,
        },
        patterns: patterns,
        insights: insights,
        predictions: predictions,
        statistics: {
          most_active_period: findMostActivePeriod(memories),
          memory_frequency: calculateMemoryFrequency(memories),
          category_distribution: calculateCategoryDistribution(memories),
        },
      };
    } catch (error) {
      logger.error("Error analyzing temporal patterns", error);
      throw new Error(`Temporal pattern analysis failed: ${error.message}`);
    }
  },
};

// Helper functions
async function performConversationContextAnalysis(
  messages: any[],
  context: ToolMemoryContext,
): Promise<MemoryDecisionContext> {
  const participants = new Set(messages.map((m) => m.userId).filter(Boolean));
  const timeSpan =
    messages.length > 0
      ? new Date(messages[messages.length - 1].timestamp).getTime() -
        new Date(messages[0].timestamp).getTime()
      : 0;

  const content = messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join(" ");
  const topics = extractTopics(content);
  const sentiment = analyzeSentiment(content);

  return {
    messages,
    participants: Array.from(participants),
    conversationLength: messages.length,
    timeSpan,
    topics,
    sentiment,
    userInteraction: messages.some((m) => m.type === "user"),
    decisionMade: /(?:decide|choose|will|going to|plan to)/i.test(content),
    factualContent: /(?:fact|information|data|research|study)/i.test(content),
    preferenceExpressed: /(?:prefer|like|dislike|favorite|hate|love)/i.test(
      content,
    ),
  };
}

async function calculateImportanceScores(
  messages: any[],
  context: MemoryDecisionContext,
): Promise<any> {
  const scores = {
    content_complexity: calculateContentComplexity(messages),
    user_engagement: calculateUserEngagement(messages),
    decision_weight: context.decisionMade ? 0.9 : 0.1,
    preference_weight: context.preferenceExpressed ? 0.8 : 0.1,
    factual_weight: context.factualContent ? 0.7 : 0.2,
    conversation_length: Math.min(context.conversationLength / 10, 1),
    participant_count: Math.min(context.participants.length / 5, 1),
  };

  scores.final_score =
    Object.values(scores).reduce((sum, score) => sum + score, 0) /
    Object.keys(scores).length;

  return scores;
}

async function determinePotentialCategories(
  content: string,
  context: MemoryDecisionContext,
): Promise<string[]> {
  const categories = [];

  if (context.preferenceExpressed) categories.push("user_preference");
  if (context.factualContent) categories.push("important_fact");
  if (context.decisionMade) categories.push("decision");
  if (/(?:friend|family|colleague|team|partner)/i.test(content))
    categories.push("relationship");
  if (/(?:meeting|appointment|deadline|event)/i.test(content))
    categories.push("event");
  if (/(?:learn|study|understand|know)/i.test(content))
    categories.push("knowledge");
  if (/(?:remind|remember|don't forget)/i.test(content))
    categories.push("reminder");

  return categories.length > 0 ? categories : ["context"];
}

async function findSimilarMemories(
  content: string,
  context: ToolMemoryContext,
): Promise<any[]> {
  const embedding = await generateEmbedding(content);
  const memories = await fetchAccessibleMemories(context);

  return memories
    .map((memory) => ({
      ...memory,
      similarity: calculateCosineSimilarity(embedding, memory.embedding),
    }))
    .filter((memory) => memory.similarity > 0.7)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

async function makeIntelligentDecision(
  content: string,
  context: MemoryDecisionContext,
  importance: any,
  categories: string[],
  similarMemories: any[],
  criteria: any,
): Promise<any> {
  const threshold = criteria.importance_threshold || 0.6;
  const maxSimilarity =
    similarMemories.length > 0
      ? Math.max(...similarMemories.map((m) => m.similarity))
      : 0;

  const shouldSave = importance.final_score >= threshold && maxSimilarity < 0.9;

  return {
    decision: shouldSave ? "save" : "skip",
    confidence: calculateDecisionConfidence(importance, maxSimilarity, context),
    importance: importance.final_score,
    category: categories[0] || "context",
    reasoning: generateDecisionReasoning(
      shouldSave,
      importance,
      maxSimilarity,
      context,
    ),
    similar_memories: similarMemories.map((m) => ({
      id: m.id,
      similarity: m.similarity,
      content_preview: m.content.substring(0, 50) + "...",
    })),
    suggested_tags: generateTags(content, categories[0] || "context"),
    metadata: {
      participants: context.participants,
      topics: context.topics,
      sentiment: context.sentiment,
      conversation_length: context.conversationLength,
      time_span: context.timeSpan,
    },
  };
}

function calculateDecisionConfidence(
  importance: any,
  maxSimilarity: number,
  context: MemoryDecisionContext,
): number {
  let confidence = importance.final_score;

  if (maxSimilarity > 0.9) confidence *= 0.3; // Very similar content exists
  if (context.decisionMade) confidence *= 1.2;
  if (context.preferenceExpressed) confidence *= 1.1;

  return Math.min(confidence, 1.0);
}

function generateDecisionReasoning(
  shouldSave: boolean,
  importance: any,
  maxSimilarity: number,
  context: MemoryDecisionContext,
): string {
  const reasons = [];

  if (shouldSave) {
    reasons.push(`High importance score: ${importance.final_score.toFixed(2)}`);
    if (context.decisionMade) reasons.push("Contains decision-making content");
    if (context.preferenceExpressed) reasons.push("Contains user preferences");
    if (context.factualContent) reasons.push("Contains factual information");
  } else {
    if (importance.final_score < 0.6) reasons.push("Low importance score");
    if (maxSimilarity > 0.9)
      reasons.push("Very similar content already exists");
  }

  return reasons.join("; ");
}

// Additional helper functions
async function performBasicAnalysis(messages: any[]): Promise<any> {
  const content = messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join(" ");

  return {
    message_count: messages.length,
    participants: [...new Set(messages.map((m) => m.userId).filter(Boolean))],
    total_characters: content.length,
    has_questions: /\?/.test(content),
    has_decisions: /(?:decide|choose|will|going to)/i.test(content),
    has_preferences: /(?:prefer|like|dislike|favorite)/i.test(content),
  };
}

async function performDetailedAnalysis(
  messages: any[],
  includeSentiment: boolean,
  includeTopics: boolean,
): Promise<any> {
  const content = messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join(" ");

  const analysis: any = {
    content_complexity: calculateContentComplexity(messages),
    user_engagement: calculateUserEngagement(messages),
  };

  if (includeSentiment) {
    analysis.sentiment = analyzeSentiment(content);
  }

  if (includeTopics) {
    analysis.topics = extractTopics(content);
  }

  return analysis;
}

async function performComprehensiveAnalysis(
  messages: any[],
  context: ToolMemoryContext,
): Promise<any> {
  return {
    temporal_patterns: await analyzeMessageTiming(messages),
    interaction_patterns: await analyzeInteractionPatterns(messages),
    content_evolution: await analyzeContentEvolution(messages),
    memory_triggers: await identifyMemoryTriggers(messages),
  };
}

function calculateContentComplexity(messages: any[]): number {
  const content = messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join(" ");
  const words = content.split(/\s+/).length;
  const sentences = content.split(/[.!?]+/).length;
  const avgWordsPerSentence = words / sentences;

  return Math.min(avgWordsPerSentence / 20, 1); // Normalized complexity score
}

function calculateUserEngagement(messages: any[]): number {
  const userMessages = messages.filter((m) => m.type === "user");
  const totalMessages = messages.length;

  if (totalMessages === 0) return 0;

  const engagementRatio = userMessages.length / totalMessages;
  const responseTime = calculateAverageResponseTime(messages);

  return (engagementRatio + (1 - Math.min(responseTime / 300000, 1))) / 2; // 5 minutes max response time
}

function calculateAverageResponseTime(messages: any[]): number {
  let totalTime = 0;
  let count = 0;

  for (let i = 1; i < messages.length; i++) {
    const prevTime = new Date(messages[i - 1].timestamp).getTime();
    const currTime = new Date(messages[i].timestamp).getTime();
    totalTime += currTime - prevTime;
    count++;
  }

  return count > 0 ? totalTime / count : 0;
}

function analyzeSentiment(content: string): string {
  const positiveWords = [
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "love",
    "like",
    "enjoy",
    "happy",
    "excited",
  ];
  const negativeWords = [
    "bad",
    "terrible",
    "awful",
    "hate",
    "dislike",
    "frustrated",
    "annoyed",
    "disappointed",
    "sad",
    "angry",
  ];

  const words = content.toLowerCase().split(/\s+/);
  const positiveCount = words.filter((word) =>
    positiveWords.includes(word),
  ).length;
  const negativeCount = words.filter((word) =>
    negativeWords.includes(word),
  ).length;

  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

function extractTopics(content: string): string[] {
  const topicPatterns = [
    /(?:about|discuss|talk about|regarding)\s+(\w+(?:\s+\w+)*)/gi,
    /(?:topic|subject|theme):\s*(\w+(?:\s+\w+)*)/gi,
    /(?:learning|studying|working on)\s+(\w+(?:\s+\w+)*)/gi,
  ];

  const topics = new Set<string>();

  for (const pattern of topicPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        topics.add(match[1].toLowerCase().trim());
      }
    }
  }

  return Array.from(topics).slice(0, 5);
}

function generateTags(content: string, category: string): string[] {
  const tags = [category];

  const topics = extractTopics(content);
  tags.push(...topics);

  if (content.includes("?")) tags.push("question");
  if (/(?:urgent|important|asap)/i.test(content)) tags.push("urgent");
  if (/(?:personal|private)/i.test(content)) tags.push("personal");

  return [...new Set(tags)];
}

// Database helper functions
async function fetchMemoriesById(ids: string[]): Promise<any[]> {
  const stmt = database.db.prepare("SELECT * FROM memories WHERE id = ?");
  const results = [];

  for (const id of ids) {
    const row = stmt.get(id);
    if (row) {
      results.push({
        ...row,
        embedding: Array.isArray(row.embedding)
          ? row.embedding
          : JSON.parse(row.embedding || "[]"),
      });
    }
  }

  return results;
}

async function fetchMemoryById(id: string): Promise<any> {
  const stmt = database.db.prepare("SELECT * FROM memories WHERE id = ?");
  const row = stmt.get(id);

  if (!row) return null;

  return {
    ...row,
    embedding: Array.isArray(row.embedding)
      ? row.embedding
      : JSON.parse(row.embedding || "[]"),
  };
}

async function fetchAccessibleMemories(
  context: ToolMemoryContext,
): Promise<any[]> {
  let query = "SELECT * FROM memories WHERE 1=1";
  const params = [];

  if (context.userId) {
    query += " AND userId = ?";
    params.push(context.userId);
  }

  if (context.guildId) {
    query += " AND guildId = ?";
    params.push(context.guildId);
  }

  const stmt = database.db.prepare(query);
  const rows = stmt.all(...params);

  return rows.map((row) => ({
    ...row,
    embedding: Array.isArray(row.embedding)
      ? row.embedding
      : JSON.parse(row.embedding || "[]"),
  }));
}

async function fetchMemoriesInTimeRange(
  timeRange: any,
  categories: string[],
  context: ToolMemoryContext,
): Promise<any[]> {
  let query = "SELECT * FROM memories WHERE 1=1";
  const params = [];

  if (timeRange.start_date) {
    query += " AND createdAt >= ?";
    params.push(timeRange.start_date);
  }

  if (timeRange.end_date) {
    query += " AND createdAt <= ?";
    params.push(timeRange.end_date);
  }

  if (categories.length > 0) {
    const categoryConditions = categories
      .map(() => "metadata LIKE ?")
      .join(" OR ");
    query += ` AND (${categoryConditions})`;
    categories.forEach((category) => params.push(`%"category":"${category}"%`));
  }

  if (context.userId) {
    query += " AND userId = ?";
    params.push(context.userId);
  }

  if (context.guildId) {
    query += " AND guildId = ?";
    params.push(context.guildId);
  }

  const stmt = database.db.prepare(query);
  const rows = stmt.all(...params);

  return rows.map((row) => ({
    ...row,
    embedding: Array.isArray(row.embedding)
      ? row.embedding
      : JSON.parse(row.embedding || "[]"),
  }));
}

async function analyzeDailyPatterns(memories: any[]): Promise<any[]> {
  const patterns = [];
  const hourCounts = new Array(24).fill(0);

  for (const memory of memories) {
    const hour = new Date(memory.createdAt).getHours();
    hourCounts[hour]++;
  }

  const maxCount = Math.max(...hourCounts);
  const peakHour = hourCounts.indexOf(maxCount);

  patterns.push({
    type: "daily_peak",
    hour: peakHour,
    count: maxCount,
    description: `Peak memory creation at ${peakHour}:00`,
  });

  return patterns;
}

async function analyzeWeeklyPatterns(memories: any[]): Promise<any[]> {
  const patterns = [];
  const dayCounts = new Array(7).fill(0);

  for (const memory of memories) {
    const day = new Date(memory.createdAt).getDay();
    dayCounts[day]++;
  }

  const maxCount = Math.max(...dayCounts);
  const peakDay = dayCounts.indexOf(maxCount);

  patterns.push({
    type: "weekly_peak",
    day: peakDay,
    count: maxCount,
    description: `Peak memory creation on day ${peakDay}`,
  });

  return patterns;
}

async function analyzeMonthlyPatterns(memories: any[]): Promise<any[]> {
  const patterns = [];
  const monthCounts = new Array(12).fill(0);

  for (const memory of memories) {
    const month = new Date(memory.createdAt).getMonth();
    monthCounts[month]++;
  }

  const maxCount = Math.max(...monthCounts);
  const peakMonth = monthCounts.indexOf(maxCount);

  patterns.push({
    type: "monthly_peak",
    month: peakMonth,
    count: maxCount,
    description: `Peak memory creation in month ${peakMonth}`,
  });

  return patterns;
}

async function analyzeSeasonalPatterns(memories: any[]): Promise<any[]> {
  return [];
}

async function analyzeRecurringPatterns(memories: any[]): Promise<any[]> {
  return [];
}

async function analyzeTrendingPatterns(memories: any[]): Promise<any[]> {
  return [];
}

async function generateTemporalInsights(
  patterns: any,
  memories: any[],
): Promise<any[]> {
  const insights = [];

  if (patterns.daily && patterns.daily.length > 0) {
    insights.push({
      type: "temporal",
      message: `Daily pattern detected: ${patterns.daily[0].description}`,
      confidence: 0.7,
    });
  }

  return insights;
}

async function generateTemporalPredictions(
  patterns: any,
  insights: any[],
): Promise<any[]> {
  return [];
}

function findMostActivePeriod(memories: any[]): string {
  if (memories.length === 0) return "No data";

  const hourCounts = new Array(24).fill(0);
  for (const memory of memories) {
    const hour = new Date(memory.createdAt).getHours();
    hourCounts[hour]++;
  }

  const maxCount = Math.max(...hourCounts);
  const peakHour = hourCounts.indexOf(maxCount);
  return `${peakHour}:00-${(peakHour + 1) % 24}:00`;
}

function calculateMemoryFrequency(memories: any[]): number {
  if (memories.length < 2) return 0;

  const timeSpan =
    new Date(memories[memories.length - 1].createdAt).getTime() -
    new Date(memories[0].createdAt).getTime();
  const days = timeSpan / (1000 * 60 * 60 * 24);

  return memories.length / Math.max(days, 1);
}

function calculateCategoryDistribution(
  memories: any[],
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const memory of memories) {
    const category = memory.metadata?.category || "unknown";
    distribution[category] = (distribution[category] || 0) + 1;
  }

  return distribution;
}

async function analyzeMessageTiming(messages: any[]): Promise<any> {
  return {
    averageInterval: 0,
    peakTimes: [],
    patterns: [],
  };
}

async function analyzeInteractionPatterns(messages: any[]): Promise<any> {
  return {
    userEngagement: 0,
    responsePatterns: [],
    conversationFlow: [],
  };
}

async function analyzeContentEvolution(messages: any[]): Promise<any> {
  return {
    topicProgression: [],
    complexityTrend: [],
    sentimentEvolution: [],
  };
}

async function identifyMemoryTriggers(messages: any[]): Promise<any> {
  return {
    keywords: [],
    patterns: [],
    contexts: [],
  };
}

function determineContextType(content: string): string {
  if (/\?/.test(content)) return "question";
  if (/(?:decide|choose)/i.test(content)) return "decision";
  if (/(?:fact|information)/i.test(content)) return "information";
  return "general";
}

function determineUrgencyLevel(content: string): string {
  if (/(?:urgent|asap|immediately)/i.test(content)) return "high";
  if (/(?:soon|quickly)/i.test(content)) return "medium";
  return "low";
}

function generateRelevanceReasoning(
  finalScore: number,
  similarity: number,
  contextualRelevance: number,
  memory: any,
): string {
  const reasons = [];

  if (similarity > 0.8) reasons.push("High semantic similarity");
  if (contextualRelevance > 0.7) reasons.push("Strong contextual relevance");
  if (memory.importance >= 8) reasons.push("High importance memory");
  if (memory.accessCount > 5) reasons.push("Frequently accessed");

  return reasons.join("; ") || "General relevance";
}

async function calculateContextualRelevance(
  currentContext: string,
  memory: any,
  context: ToolMemoryContext,
): Promise<number> {
  // Simple contextual relevance calculation
  const contextWords = currentContext.toLowerCase().split(/\s+/);
  const memoryWords = memory.content.toLowerCase().split(/\s+/);

  const commonWords = contextWords.filter(
    (word) => memoryWords.includes(word) && word.length > 3,
  );

  return Math.min(commonWords.length / Math.max(contextWords.length, 1), 1);
}

function calculateTemporalRelevance(memory: any): number {
  const now = Date.now();
  const memoryTime = new Date(memory.createdAt).getTime();
  const daysSince = (now - memoryTime) / (1000 * 60 * 60 * 24);

  // More recent memories are more relevant
  return Math.max(0, 1 - daysSince / 365);
}

function calculateAccessRelevance(memory: any): number {
  // Normalize access count to 0-1 scale
  return Math.min(memory.accessCount / 10, 1);
}

async function findRelatedMemories(
  sourceMemory: any,
  context: ToolMemoryContext,
): Promise<any[]> {
  return fetchAccessibleMemories(context);
}

async function buildRelationshipMap(
  sourceMemory: any,
  relatedMemories: any[],
  relationshipTypes: string[],
  depthLimit: number,
  strengthThreshold: number,
): Promise<any> {
  return {
    relationships: [],
    connected_memories: [],
  };
}

async function generateRelationshipInsights(
  relationshipMap: any,
): Promise<any[]> {
  return [];
}
