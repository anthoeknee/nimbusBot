import { ToolDefinition } from "../../../../types/ai";
import { getConversationManager } from "../../conversation";
import { logger } from "../../../../utils/logger";
import { database } from "../../../db";
import type {
  MemoryWorthinessAnalysis,
  MemoryRecommendation,
  MemoryDecisionContext,
  MemoryManagementAction,
  ToolMemoryContext,
} from "../../memory/types";

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const conversationManager = getConversationManager();
    // Use the memory manager's embedding generation
    return await (
      conversationManager.instance as any
    ).memoryManager.generateEmbedding(text);
  } catch (error) {
    logger.error("Error generating embedding for memory curation", error);
    // Return a fallback embedding
    return new Array(1024).fill(0);
  }
}

async function analyzeConversationContext(
  messages: any[],
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

export const analyzeMemoryWorthiness: ToolDefinition = {
  name: "analyze_memory_worthiness",
  description:
    "Analyze conversation content to determine if it should be saved to long-term memory. Returns detailed analysis including importance score, category, and reasoning.",
  parameters: [
    {
      name: "content",
      type: "string",
      description: "The conversation content to analyze",
      required: true,
    },
    {
      name: "context",
      type: "object",
      description:
        "Additional context about the conversation (participants, channel, etc.)",
      required: false,
    },
    {
      name: "existing_memories",
      type: "array",
      description:
        "Related existing memories to consider for duplication analysis",
      required: false,
    },
  ],
  handler: async (
    args: any,
    context: ToolMemoryContext,
  ): Promise<MemoryWorthinessAnalysis> => {
    try {
      const {
        content,
        context: convContext = {},
        existing_memories = [],
      } = args;

      logger.info("Analyzing memory worthiness", {
        contentLength: content.length,
        hasContext: !!convContext,
        existingMemoriesCount: existing_memories.length,
      });

      const conversationManager = getConversationManager();

      // Analyze content for various factors
      const importance = calculateImportanceScore(content, convContext);
      const category = determineMemoryCategory(content);
      const memoryType = determineMemoryType(content);
      const retentionPriority = determineRetentionPriority(
        importance,
        category,
      );

      // Check for duplication with existing memories
      const isDuplicate = await checkForDuplication(content, existing_memories);

      // Generate reasoning
      const reasoning = generateAnalysisReasoning(
        content,
        importance,
        category,
        isDuplicate,
      );

      // Extract facts and tags
      const extractedFacts = extractFactualInformation(content);
      const suggestedTags = generateTags(content, category);

      // Find related memories
      const relatedMemories = await findRelatedMemories(content, context);

      const shouldSave =
        importance >=
          conversationManager.instance.config.memoryDecisionThreshold &&
        !isDuplicate;

      const analysis: MemoryWorthinessAnalysis = {
        shouldSave,
        confidence: calculateConfidence(importance, category, isDuplicate),
        importance,
        category,
        reasoning,
        suggestedTags,
        extractedFacts,
        relatedMemories,
        memoryType,
        retentionPriority,
      };

      logger.info("Memory worthiness analysis complete", {
        shouldSave: analysis.shouldSave,
        importance: analysis.importance,
        category: analysis.category,
        confidence: analysis.confidence,
      });

      return analysis;
    } catch (error) {
      logger.error("Error analyzing memory worthiness", error);
      throw new Error(`Memory worthiness analysis failed: ${error.message}`);
    }
  },
};

export const curateMemoryCollection: ToolDefinition = {
  name: "curate_memory_collection",
  description:
    "Curate and organize a collection of memories by consolidating similar ones, removing duplicates, and optimizing storage.",
  parameters: [
    {
      name: "memory_ids",
      type: "array",
      description: "Array of memory IDs to curate",
      required: true,
    },
    {
      name: "curation_strategy",
      type: "string",
      description:
        "Strategy for curation: 'consolidate', 'prioritize', 'deduplicate', 'reorganize'",
      required: true,
      enum: ["consolidate", "prioritize", "deduplicate", "reorganize"],
    },
    {
      name: "preserve_metadata",
      type: "boolean",
      description: "Whether to preserve original metadata during curation",
      required: false,
      default: true,
    },
  ],
  handler: async (args: any, context: ToolMemoryContext): Promise<any> => {
    try {
      const { memory_ids, curation_strategy, preserve_metadata = true } = args;

      logger.info("Starting memory curation", {
        memoryCount: memory_ids.length,
        strategy: curation_strategy,
        preserveMetadata: preserve_metadata,
      });

      const conversationManager = getConversationManager();
      if (
        !conversationManager.instance.config.toolMemoryPermissions.allowCuration
      ) {
        throw new Error("Memory curation not permitted");
      }

      // Fetch memories to curate
      const memories = await fetchMemoriesById(memory_ids);

      let results = [];

      switch (curation_strategy) {
        case "consolidate":
          results = await consolidateMemories(memories, preserve_metadata);
          break;
        case "prioritize":
          results = await prioritizeMemories(memories);
          break;
        case "deduplicate":
          results = await deduplicateMemories(memories);
          break;
        case "reorganize":
          results = await reorganizeMemories(memories);
          break;
        default:
          throw new Error(`Unknown curation strategy: ${curation_strategy}`);
      }

      logger.info("Memory curation complete", {
        originalCount: memories.length,
        resultCount: results.length,
        strategy: curation_strategy,
      });

      return {
        original_count: memories.length,
        curated_count: results.length,
        strategy: curation_strategy,
        results,
        summary: generateCurationSummary(memories, results, curation_strategy),
      };
    } catch (error) {
      logger.error("Error during memory curation", error);
      throw new Error(`Memory curation failed: ${error.message}`);
    }
  },
};

export const generateMemoryRecommendations: ToolDefinition = {
  name: "generate_memory_recommendations",
  description:
    "Generate intelligent recommendations for memory management actions based on analysis of current memory state and conversation patterns.",
  parameters: [
    {
      name: "analysis_scope",
      type: "string",
      description: "Scope of analysis: 'user', 'channel', 'global'",
      required: true,
      enum: ["user", "channel", "global"],
    },
    {
      name: "focus_area",
      type: "string",
      description:
        "Area to focus recommendations on: 'cleanup', 'organization', 'consolidation', 'relationships'",
      required: false,
      enum: ["cleanup", "organization", "consolidation", "relationships"],
    },
    {
      name: "max_recommendations",
      type: "number",
      description: "Maximum number of recommendations to generate",
      required: false,
      default: 5,
    },
  ],
  handler: async (
    args: any,
    context: ToolMemoryContext,
  ): Promise<MemoryRecommendation[]> => {
    try {
      const { analysis_scope, focus_area, max_recommendations = 5 } = args;

      logger.info("Generating memory recommendations", {
        scope: analysis_scope,
        focusArea: focus_area,
        maxRecommendations: max_recommendations,
      });

      const conversationManager = getConversationManager();
      if (!conversationManager.instance.config.enableMemoryRecommendations) {
        throw new Error("Memory recommendations not enabled");
      }

      // Analyze current memory state
      const memoryAnalytics =
        await conversationManager.instance.getMemoryAnalytics();
      const patterns = await analyzeMemoryPatterns(analysis_scope, context);

      // Generate recommendations based on analysis
      const recommendations = await generateRecommendations(
        memoryAnalytics,
        patterns,
        focus_area,
        max_recommendations,
      );

      logger.info("Memory recommendations generated", {
        count: recommendations.length,
        topPriority: recommendations[0]?.priority || 0,
      });

      return recommendations;
    } catch (error) {
      logger.error("Error generating memory recommendations", error);
      throw new Error(`Memory recommendations failed: ${error.message}`);
    }
  },
};

export const assessMemoryQuality: ToolDefinition = {
  name: "assess_memory_quality",
  description:
    "Assess the quality of stored memories and identify issues like outdated information, low relevance, or poor organization.",
  parameters: [
    {
      name: "memory_ids",
      type: "array",
      description:
        "Array of memory IDs to assess (if empty, assesses all memories)",
      required: false,
    },
    {
      name: "assessment_criteria",
      type: "array",
      description:
        "Specific criteria to assess: 'relevance', 'accuracy', 'completeness', 'organization'",
      required: false,
      enum: ["relevance", "accuracy", "completeness", "organization"],
    },
    {
      name: "generate_fixes",
      type: "boolean",
      description: "Whether to generate suggested fixes for identified issues",
      required: false,
      default: true,
    },
  ],
  handler: async (args: any, context: ToolMemoryContext): Promise<any> => {
    try {
      const {
        memory_ids = [],
        assessment_criteria = [
          "relevance",
          "accuracy",
          "completeness",
          "organization",
        ],
        generate_fixes = true,
      } = args;

      logger.info("Assessing memory quality", {
        memoryCount: memory_ids.length || "all",
        criteria: assessment_criteria,
        generateFixes: generate_fixes,
      });

      const conversationManager = getConversationManager();

      // Fetch memories to assess
      const memories =
        memory_ids.length > 0
          ? await fetchMemoriesById(memory_ids)
          : await fetchAllMemories(context);

      const assessment = {
        total_memories: memories.length,
        quality_scores: {} as Record<string, number>,
        issues: [] as any[],
        recommendations: [] as any[],
        overall_score: 0,
      };

      // Assess each criterion
      for (const criterion of assessment_criteria) {
        const score = await assessCriterion(memories, criterion);
        assessment.quality_scores[criterion] = score;

        if (score < 0.7) {
          const issues = await identifyIssues(memories, criterion);
          assessment.issues.push(...issues);

          if (generate_fixes) {
            const fixes = await generateFixes(issues, criterion);
            assessment.recommendations.push(...fixes);
          }
        }
      }

      // Calculate overall score
      const scores = Object.values(assessment.quality_scores);
      assessment.overall_score =
        scores.reduce((sum, score) => sum + score, 0) / scores.length;

      logger.info("Memory quality assessment complete", {
        overallScore: assessment.overall_score,
        issuesFound: assessment.issues.length,
        recommendationsGenerated: assessment.recommendations.length,
      });

      return assessment;
    } catch (error) {
      logger.error("Error assessing memory quality", error);
      throw new Error(`Memory quality assessment failed: ${error.message}`);
    }
  },
};

// Helper functions
function calculateImportanceScore(content: string, context: any): number {
  let score = 0;

  // Base score from content length and complexity
  score += Math.min(content.length / 100, 2);

  // Boost for decision-making content
  if (/(?:decide|choose|will|going to|plan to)/i.test(content)) score += 3;

  // Boost for preferences
  if (/(?:prefer|like|dislike|favorite)/i.test(content)) score += 2;

  // Boost for factual information
  if (/(?:fact|information|data|research)/i.test(content)) score += 2;

  // Boost for questions and answers
  if (/\?/.test(content)) score += 1;

  // Boost for emotional content
  if (/(?:excited|frustrated|happy|sad|angry)/i.test(content)) score += 1;

  // Context-based boosts
  if (context.userInteraction) score += 1;
  if (context.conversationLength > 5) score += 1;

  return Math.min(score, 10);
}

function determineMemoryCategory(content: string): string {
  const patterns = {
    user_preference: /(?:prefer|like|dislike|favorite|hate|love)/i,
    important_fact: /(?:fact|information|data|research|study)/i,
    decision: /(?:decide|choose|will|going to|plan to)/i,
    relationship: /(?:friend|family|colleague|team|partner)/i,
    event: /(?:meeting|appointment|deadline|event|conference)/i,
    knowledge: /(?:learn|study|understand|know|remember)/i,
    reminder: /(?:remind|remember|don't forget|make sure)/i,
    feedback: /(?:feedback|suggestion|improvement|better)/i,
  };

  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.test(content)) return category;
  }

  return "context";
}

function determineMemoryType(
  content: string,
): "episodic" | "semantic" | "procedural" | "contextual" {
  if (/(?:how to|step|process|procedure)/i.test(content)) return "procedural";
  if (/(?:fact|definition|concept|theory)/i.test(content)) return "semantic";
  if (/(?:when|where|what happened|experience)/i.test(content))
    return "episodic";
  return "contextual";
}

function determineRetentionPriority(
  importance: number,
  category: string,
): "low" | "medium" | "high" | "critical" {
  if (importance >= 8) return "critical";
  if (importance >= 6) return "high";
  if (importance >= 4) return "medium";
  return "low";
}

async function checkForDuplication(
  content: string,
  existingMemories: any[],
): Promise<boolean> {
  const embedding = await generateEmbedding(content);

  for (const memory of existingMemories) {
    const similarity = calculateCosineSimilarity(embedding, memory.embedding);
    if (similarity > 0.9) return true;
  }

  return false;
}

function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  return dotProduct / (magnitudeA * magnitudeB);
}

function generateAnalysisReasoning(
  content: string,
  importance: number,
  category: string,
  isDuplicate: boolean,
): string {
  const reasons = [];

  if (importance >= 8)
    reasons.push("High importance due to significant content");
  if (importance >= 6) reasons.push("Medium-high importance");
  if (isDuplicate) reasons.push("Similar content already exists in memory");

  reasons.push(`Categorized as ${category}`);

  if (content.includes("?"))
    reasons.push("Contains questions or seeks information");
  if (/(?:decide|choose)/i.test(content))
    reasons.push("Contains decision-making content");

  return reasons.join("; ");
}

function extractFactualInformation(content: string): string[] {
  const facts = [];

  // Extract sentences with factual patterns
  const sentences = content.split(/[.!?]+/);

  for (const sentence of sentences) {
    if (/(?:is|are|was|were|has|have|will be|can be)/i.test(sentence)) {
      facts.push(sentence.trim());
    }
  }

  return facts.slice(0, 3);
}

function generateTags(content: string, category: string): string[] {
  const tags = [category];

  // Add topic-based tags
  const topics = extractTopics(content);
  tags.push(...topics);

  // Add context tags
  if (content.includes("?")) tags.push("question");
  if (/(?:urgent|important|asap)/i.test(content)) tags.push("urgent");
  if (/(?:personal|private)/i.test(content)) tags.push("personal");

  return [...new Set(tags)];
}

async function findRelatedMemories(
  content: string,
  context: ToolMemoryContext,
): Promise<string[]> {
  // This would typically use semantic search
  // For now, return empty array as placeholder
  return [];
}

function calculateConfidence(
  importance: number,
  category: string,
  isDuplicate: boolean,
): number {
  let confidence = 0.5;

  if (importance >= 8) confidence += 0.3;
  else if (importance >= 6) confidence += 0.2;
  else if (importance >= 4) confidence += 0.1;

  if (category !== "context") confidence += 0.1;

  if (isDuplicate) confidence -= 0.3;

  return Math.max(0, Math.min(1, confidence));
}

async function fetchMemoriesById(ids: string[]): Promise<any[]> {
  // Database query to fetch memories by IDs
  const results = await database.db.query(
    "SELECT * FROM memories WHERE id = ANY($1)",
    [ids],
  );
  return results.rows;
}

async function fetchAllMemories(context: ToolMemoryContext): Promise<any[]> {
  // Database query to fetch all memories for context
  const results = await database.db.query(
    "SELECT * FROM memories WHERE user_id = $1 OR guild_id = $2",
    [context.userId, context.guildId],
  );
  return results.rows;
}

async function consolidateMemories(
  memories: any[],
  preserveMetadata: boolean,
): Promise<any[]> {
  // Group similar memories and consolidate them
  const groups = await groupSimilarMemories(memories);
  const consolidated = [];

  for (const group of groups) {
    if (group.length > 1) {
      const consolidatedMemory = await mergeMemories(group, preserveMetadata);
      consolidated.push(consolidatedMemory);
    } else {
      consolidated.push(group[0]);
    }
  }

  return consolidated;
}

async function groupSimilarMemories(memories: any[]): Promise<any[][]> {
  const groups = [];
  const used = new Set();

  for (const memory of memories) {
    if (used.has(memory.id)) continue;

    const group = [memory];
    used.add(memory.id);

    for (const other of memories) {
      if (used.has(other.id)) continue;

      const similarity = calculateCosineSimilarity(
        memory.embedding,
        other.embedding,
      );
      if (similarity > 0.8) {
        group.push(other);
        used.add(other.id);
      }
    }

    groups.push(group);
  }

  return groups;
}

async function mergeMemories(
  memories: any[],
  preserveMetadata: boolean,
): Promise<any> {
  const merged = {
    id: memories[0].id,
    content: memories.map((m) => m.content).join(" | "),
    embedding: memories[0].embedding,
    importance: Math.max(...memories.map((m) => m.importance)),
    tags: [...new Set(memories.flatMap((m) => m.tags))],
    metadata: preserveMetadata
      ? memories.reduce((acc, m) => ({ ...acc, ...m.metadata }), {})
      : {},
    createdAt: new Date(
      Math.min(...memories.map((m) => new Date(m.createdAt).getTime())),
    ),
    updatedAt: new Date(),
  };

  return merged;
}

async function prioritizeMemories(memories: any[]): Promise<any[]> {
  return memories.sort((a, b) => b.importance - a.importance);
}

async function deduplicateMemories(memories: any[]): Promise<any[]> {
  const unique = [];
  const seen = new Set();

  for (const memory of memories) {
    const key = `${memory.content.substring(0, 50)}-${memory.importance}`;
    if (!seen.has(key)) {
      unique.push(memory);
      seen.add(key);
    }
  }

  return unique;
}

async function reorganizeMemories(memories: any[]): Promise<any[]> {
  // Reorganize by category and importance
  const organized = memories.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return b.importance - a.importance;
  });

  return organized;
}

function generateCurationSummary(
  original: any[],
  curated: any[],
  strategy: string,
): string {
  const reduction = (
    ((original.length - curated.length) / original.length) *
    100
  ).toFixed(1);
  return `${strategy} strategy applied: ${original.length} → ${curated.length} memories (${reduction}% reduction)`;
}

async function analyzeMemoryPatterns(
  scope: string,
  context: ToolMemoryContext,
): Promise<any> {
  // Analyze patterns in memory usage and content
  return {
    mostUsedCategories: ["user_preference", "important_fact"],
    averageImportance: 6.2,
    duplicateRate: 0.15,
    accessPatterns: {},
  };
}

async function generateRecommendations(
  analytics: any,
  patterns: any,
  focusArea: string | undefined,
  maxRecommendations: number,
): Promise<MemoryRecommendation[]> {
  const recommendations: MemoryRecommendation[] = [];

  if (patterns.duplicateRate > 0.2) {
    recommendations.push({
      action: {
        type: "consolidate",
        reasoning: "High duplicate rate detected",
        confidence: 0.8,
        impact: "medium",
      },
      priority: 8,
      reasoning:
        "Consolidating duplicate memories will improve storage efficiency",
      context: "Memory optimization",
      expectedBenefit: "Reduced storage usage and improved search relevance",
      risks: ["Potential loss of nuanced information"],
    });
  }

  if (analytics.totalMemories > 1000) {
    recommendations.push({
      action: {
        type: "archive",
        reasoning: "Large memory collection detected",
        confidence: 0.7,
        impact: "high",
      },
      priority: 7,
      reasoning:
        "Archiving old, low-importance memories will improve performance",
      context: "Performance optimization",
      expectedBenefit: "Faster search and retrieval times",
      risks: ["Archived memories may be harder to access"],
    });
  }

  return recommendations.slice(0, maxRecommendations);
}

async function assessCriterion(
  memories: any[],
  criterion: string,
): Promise<number> {
  switch (criterion) {
    case "relevance":
      return (
        memories.reduce((sum, m) => sum + (m.accessCount > 0 ? 1 : 0.5), 0) /
        memories.length
      );
    case "accuracy":
      return 0.8; // Placeholder - would need more sophisticated analysis
    case "completeness":
      return (
        memories.reduce(
          (sum, m) => sum + (m.content.length > 50 ? 1 : 0.5),
          0,
        ) / memories.length
      );
    case "organization":
      return (
        memories.reduce((sum, m) => sum + (m.tags.length > 0 ? 1 : 0.5), 0) /
        memories.length
      );
    default:
      return 0.5;
  }
}

async function identifyIssues(
  memories: any[],
  criterion: string,
): Promise<any[]> {
  const issues = [];

  for (const memory of memories) {
    switch (criterion) {
      case "relevance":
        if (
          memory.accessCount === 0 &&
          memory.createdAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ) {
          issues.push({
            memoryId: memory.id,
            issue: "Never accessed and older than 30 days",
            severity: "medium",
          });
        }
        break;
      case "completeness":
        if (memory.content.length < 20) {
          issues.push({
            memoryId: memory.id,
            issue: "Content too short to be meaningful",
            severity: "low",
          });
        }
        break;
      case "organization":
        if (memory.tags.length === 0) {
          issues.push({
            memoryId: memory.id,
            issue: "No tags assigned",
            severity: "low",
          });
        }
        break;
    }
  }

  return issues;
}

async function generateFixes(issues: any[], criterion: string): Promise<any[]> {
  return issues.map((issue) => ({
    issueId: issue.memoryId,
    fix: `Apply ${criterion} improvement strategy`,
    confidence: 0.6,
    automated: true,
  }));
}
