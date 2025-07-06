import { ConversationContext, ConversationMessage } from "../../../types/ai";
import { getMemoryDatabase } from "./index";
import { AIClient } from "../client";
import { config } from "../../../config";
import { logger } from "../../../utils/logger";
import {
  MemoryConfig,
  MemoryScore,
  ConversationSummary,
  MemoryDecision,
  MemoryInsight,
} from "./types";
import {
  MemoryRecord,
  MemorySearchResult,
  MemoryAnalytics,
} from "../../../types/memory";

export class EnhancedMemoryManager {
  private shortTermMemory: Map<string, ConversationContext> = new Map();
  private memoryEmbeddingCache: Map<string, number[]> = new Map();
  private processingQueue: Map<string, Promise<void>> = new Map();
  private transferLocks: Set<string> = new Set();
  private embeddingQueue: Map<string, Promise<number[]>> = new Map();

  public readonly config: MemoryConfig;
  private readonly defaultProvider = config.defaultProvider as any;
  private readonly defaultModel = config.defaultModel;
  private readonly defaultEmbedModel = config.defaultEmbedModel;

  constructor(customConfig?: Partial<MemoryConfig>) {
    this.config = {
      shortTermLimit: 35,
      longTermTransferThreshold: 30,
      maxRelevantMemories: 8,
      memoryRelevanceThreshold: 0.65,
      sessionTimeout: 60 * 60 * 1000, // 1 hour
      enableAutoTransfer: false, // Disabled by default for tool-driven mode
      enableMemoryRetrieval: true,
      enableMemoryDecay: true,
      memoryDecayFactor: 0.95,
      batchSize: 10,
      maxRetries: 3,
      embeddingDimension: 1024,
      consolidationThreshold: 0.85,

      // Tool-driven memory configuration (prioritized)
      enableToolDrivenMemory: true, // Enable tool-driven mode by default
      disableAutoTransfer: true, // Disable auto-transfer by default
      toolMemoryPermissions: {
        allowSave: true,
        allowSearch: true,
        allowDelete: true,
        allowConsolidate: true,
        allowAnalytics: true,
        allowCuration: true,
        allowRelationships: true,
        allowBulkOperations: false,
      },

      // Memory decision making
      memoryDecisionThreshold: 6.0,
      enableMemoryWorthinessAnalysis: true,
      requireExplicitMemorySave: true,
      enableMemoryAnalytics: true,
      enableMemoryInsights: true,

      // Memory categorization and organization
      memoryCategories: [
        "user_preference",
        "important_fact",
        "decision",
        "relationship",
        "event",
        "knowledge",
        "reminder",
        "context",
        "learning",
        "feedback",
      ],
      enableMemoryRelationships: true,
      enableMemoryConsolidation: true,
      enableMemoryTagging: true,
      enableMemoryPrioritization: true,

      // Memory retention and cleanup
      memoryRetentionPeriod: 90,
      enableMemoryCleanup: true,
      intelligentMemoryFiltering: true,
      enableMemoryArchiving: true,

      // Advanced tool features
      enableMemoryWorthinessAnalysis: true,
      requireExplicitMemorySave: true,
      enableMemoryInsights: true,
      enableMemoryRecommendations: true,
      enableMemoryPatternAnalysis: true,
      enableContextualMemoryRetrieval: true,
      memoryImportanceWeighting: {
        userPreference: 0.9,
        factualInformation: 0.8,
        decisions: 0.95,
        relationships: 0.85,
        events: 0.7,
        knowledge: 0.8,
      },
      ...customConfig,
    };

    this.startBackgroundProcesses();
    logger.info("Enhanced Memory Manager initialized", {
      config: this.config,
      toolDrivenMode: this.config.enableToolDrivenMemory,
      autoTransferEnabled:
        this.config.enableAutoTransfer && !this.config.disableAutoTransfer,
    });
  }

  private startBackgroundProcesses() {
    // Cleanup inactive contexts
    setInterval(() => this.cleanupInactiveContexts(), 10 * 60 * 1000);

    // Process memory transfers (only if auto-transfer is enabled)
    if (this.config.enableAutoTransfer && !this.config.disableAutoTransfer) {
      setInterval(() => this.processMemoryTransfers(), 30 * 1000);
    }

    // Decay memory scores
    if (this.config.enableMemoryDecay) {
      setInterval(() => this.decayMemoryScores(), 60 * 60 * 1000); // hourly
    }

    // Consolidate similar memories
    if (this.config.enableMemoryConsolidation) {
      setInterval(() => this.consolidateMemories(), 6 * 60 * 60 * 1000); // 6 hours
    }
  }

  private async cleanupInactiveContexts() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, context] of this.shortTermMemory.entries()) {
      if (now - context.lastActive > this.config.sessionTimeout) {
        // Only auto-transfer if not disabled and not in tool-driven mode
        const shouldAutoTransfer =
          this.config.enableAutoTransfer &&
          !this.config.disableAutoTransfer &&
          !this.config.enableToolDrivenMemory &&
          context.messages.length > 0;

        if (shouldAutoTransfer) {
          await this.safeTransferToLongTerm(context);
        }
        this.shortTermMemory.delete(key);
        this.memoryEmbeddingCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} inactive conversation contexts`);
    }
  }

  private getContextKey(type: "user" | "channel", id: string): string {
    return `${type}:${id}`;
  }

  /**
   * Generate embedding with caching and fallback handling
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    const cacheKey = this.hashContent(content);

    if (this.memoryEmbeddingCache.has(cacheKey)) {
      return this.memoryEmbeddingCache.get(cacheKey)!;
    }

    // Check if embedding is already being generated
    if (this.embeddingQueue.has(cacheKey)) {
      return this.embeddingQueue.get(cacheKey)!;
    }

    const embeddingPromise = this.doGenerateEmbedding(content);
    this.embeddingQueue.set(cacheKey, embeddingPromise);

    try {
      const embedding = await embeddingPromise;
      this.memoryEmbeddingCache.set(cacheKey, embedding);
      return embedding;
    } finally {
      this.embeddingQueue.delete(cacheKey);
    }
  }

  private async doGenerateEmbedding(content: string): Promise<number[]> {
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await AIClient.embeddings({
          provider: "cohere",
          model: this.defaultEmbedModel,
          texts: [content],
          inputType: "search_document",
        });

        // Handle different Cohere response formats
        let embedding: number[] | null = null;

        if (response.embeddings) {
          if (Array.isArray(response.embeddings)) {
            // Format: { embeddings: [[1,2,3...]] }
            if (Array.isArray(response.embeddings[0])) {
              embedding = response.embeddings[0];
            }
            // Format: { embeddings: { float: [[1,2,3...]] } }
            else if (
              response.embeddings[0] &&
              typeof response.embeddings[0] === "object"
            ) {
              const embeddingObj = response.embeddings[0];
              if (embeddingObj.float && Array.isArray(embeddingObj.float)) {
                embedding = embeddingObj.float;
              }
            }
          }
          // Format: { embeddings: { float: [[1,2,3...]] } }
          else if (
            typeof response.embeddings === "object" &&
            response.embeddings.float
          ) {
            if (
              Array.isArray(response.embeddings.float) &&
              Array.isArray(response.embeddings.float[0])
            ) {
              embedding = response.embeddings.float[0];
            }
          }
        }

        if (embedding && Array.isArray(embedding) && embedding.length > 0) {
          return embedding;
        }

        logger.warn("Unexpected embedding response format:", response);
        throw new Error("Invalid embedding response format");
      } catch (error) {
        if (attempt === this.config.maxRetries - 1) {
          logger.error(
            `Failed to generate embedding after ${this.config.maxRetries} attempts:`,
            error,
          );
          return this.createFallbackEmbedding(content);
        }

        const delay = Math.pow(2, attempt) * 1000; // exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return this.createFallbackEmbedding(content);
  }

  private createFallbackEmbedding(content: string): number[] {
    // Create a deterministic but more sophisticated embedding based on content
    const embedding = new Array(this.config.embeddingDimension).fill(0);

    // Use multiple hash seeds for better distribution
    const hash1 = this.hashContent(content);
    const hash2 = this.hashContent(content.split("").reverse().join(""));
    const hash3 = this.hashContent(content.toLowerCase());

    // Create embedding using multiple hash functions and word-based features
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const wordHashes = words.slice(0, 10).map((word) => this.hashContent(word));

    for (let i = 0; i < this.config.embeddingDimension; i++) {
      let value = 0;

      // Primary hash component
      const seed1 = hash1 + i * 17;
      value += Math.sin(seed1) * 0.4;

      // Secondary hash component
      const seed2 = hash2 + i * 23;
      value += Math.cos(seed2) * 0.3;

      // Character-based component
      const seed3 = hash3 + i * 31;
      value += Math.sin(seed3 * 1.5) * 0.2;

      // Word-based component
      if (wordHashes.length > 0) {
        const wordIndex = i % wordHashes.length;
        const wordSeed = wordHashes[wordIndex] + i;
        value += Math.cos(wordSeed * 0.7) * 0.1;
      }

      embedding[i] = value;
    }

    // Normalize to unit vector
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) {
      // Fallback to random-like values if norm is zero
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = (Math.sin(hash1 + i) + Math.cos(hash2 + i)) / 2;
      }
      const newNorm = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0),
      );
      return embedding.map((val) => val / newNorm);
    }

    return embedding.map((val) => val / norm);
  }

  private hashContent(content: string): number {
    let hash = 5381; // Use djb2 hash algorithm for better distribution
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) + hash + char; // hash * 33 + char
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Retrieve relevant memories with enhanced scoring
   */
  private async retrieveRelevantMemories(
    contextKey: string,
    currentMessage: string,
    type: "user" | "channel",
    id: string,
  ): Promise<ConversationMessage[]> {
    if (!this.config.enableMemoryRetrieval) {
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(currentMessage);
      const isUserContext = type === "user";

      const searchOptions = {
        topK: this.config.maxRelevantMemories * 2, // Get more candidates for better filtering
        ...(isUserContext
          ? { userId: parseInt(id) }
          : { guildId: parseInt(id) }),
      };

      const results = await getMemoryDatabase().findSimilar(
        queryEmbedding,
        searchOptions,
      );

      const scoredMemories = results
        .filter(
          (result) => result.similarity >= this.config.memoryRelevanceThreshold,
        )
        .map((result) => {
          const score = this.calculateMemoryScore(result, currentMessage);
          return { ...result, score };
        })
        .sort((a, b) => b.score.final - a.score.final)
        .slice(0, this.config.maxRelevantMemories);

      // Update access patterns
      for (const memory of scoredMemories) {
        await this.updateMemoryAccess(memory.data.id);
      }

      const relevantMemories = scoredMemories.map((result) => ({
        id: `memory-${result.data.id}`,
        authorId: "system",
        authorName: "Memory",
        channelId: id,
        content: `[Memory] ${result.data.content}`,
        timestamp: new Date(result.data.createdAt).getTime(),
        type: "system" as const,
        metadata: {
          isMemory: true,
          similarity: result.similarity,
          memoryId: result.data.id,
          score: result.score,
        },
      }));

      if (relevantMemories.length > 0) {
        logger.debug(
          `Retrieved ${relevantMemories.length} relevant memories for ${contextKey}`,
          {
            topScore: scoredMemories[0]?.score.final,
            averageScore:
              scoredMemories.reduce((sum, m) => sum + m.score.final, 0) /
              scoredMemories.length,
          },
        );
      }

      return relevantMemories;
    } catch (error) {
      logger.error("Failed to retrieve relevant memories:", error);
      return [];
    }
  }

  private calculateMemoryScore(
    result: any,
    currentMessage: string,
  ): MemoryScore {
    const now = Date.now();
    const createdAt = new Date(result.data.createdAt).getTime();
    const lastAccessedAt = new Date(
      result.data.lastAccessedAt || result.data.createdAt,
    ).getTime();
    const accessCount = result.data.accessCount || 0;
    const importance = result.data.importance || 5;

    // Recency score (0-1, higher for more recent)
    const recency =
      Math.exp(-(now - lastAccessedAt) / (24 * 60 * 60 * 1000)) * 0.5 +
      Math.exp(-(now - createdAt) / (7 * 24 * 60 * 60 * 1000)) * 0.5;

    // Frequency score (0-1, higher for more accessed)
    const frequency = Math.min(accessCount / 10, 1);

    // Importance score (0-1, normalized from 1-10 scale)
    const importanceScore = importance / 10;

    // Relevance score (semantic similarity)
    const relevance = result.similarity;

    // Final weighted score
    const final =
      recency * 0.2 +
      frequency * 0.15 +
      importanceScore * 0.25 +
      relevance * 0.4;

    return {
      recency,
      frequency,
      importance: importanceScore,
      relevance,
      final,
    };
  }

  private async updateMemoryAccess(memoryId: string): Promise<void> {
    try {
      await getMemoryDatabase().updateAccess(memoryId);
    } catch (error) {
      logger.warn(`Failed to update memory access for ${memoryId}:`, error);
    }
  }

  /**
   * Enhanced conversation summarization with better context understanding
   */
  private async summarizeConversation(
    messages: ConversationMessage[],
  ): Promise<ConversationSummary> {
    try {
      const conversationText = messages
        .filter((msg) => msg.type !== "system")
        .map(
          (msg) =>
            `${msg.authorName}: ${typeof msg.content === "string" ? msg.content : "[Media]"}`,
        )
        .join("\n");

      const timespan =
        messages.length > 0
          ? messages[messages.length - 1].timestamp - messages[0].timestamp
          : 0;

      const summaryPrompt = `Analyze this conversation and provide a comprehensive summary:

${conversationText}

Provide a JSON response with:
- participantIds: array of user IDs
- mainTopics: array of main topics (max 5)
- keyEvents: array of important events (max 3)
- sentiment: overall sentiment (positive/neutral/negative)
- importance: score 1-10 (10 = most important)
- summary: 2-3 sentence summary of the conversation
- messageCount: number of messages
- timespan: duration in milliseconds

Focus on factual content, decisions made, and actionable information.`;

      const response = await AIClient.chat({
        provider: this.defaultProvider,
        model: this.defaultModel,
        messages: [
          {
            role: "system",
            content:
              "You are a conversation analyzer. Respond with valid JSON only. Focus on extracting meaningful information and context.",
          },
          { role: "user", content: summaryPrompt },
        ],
        temperature: 0.2,
      });

      const summaryText = response.choices[0]?.message?.content?.trim();
      if (summaryText) {
        try {
          const parsed = JSON.parse(summaryText);
          return {
            participantIds: parsed.participantIds || [],
            mainTopics: parsed.mainTopics || [],
            keyEvents: parsed.keyEvents || [],
            sentiment: parsed.sentiment || "neutral",
            importance: parsed.importance || 5,
            summary: parsed.summary || "General conversation",
            messageCount: messages.length,
            timespan,
          };
        } catch {
          return this.createFallbackSummary(messages, timespan);
        }
      }

      return this.createFallbackSummary(messages, timespan);
    } catch (error) {
      logger.error("Failed to generate conversation summary:", error);
      return this.createFallbackSummary(messages, timespan);
    }
  }

  private createFallbackSummary(
    messages: ConversationMessage[],
    timespan: number = 0,
  ): ConversationSummary {
    const participantIds = [...new Set(messages.map((m) => m.authorId))];
    return {
      participantIds,
      mainTopics: ["General conversation"],
      keyEvents: [],
      sentiment: "neutral",
      importance: 5,
      summary: `Conversation between ${participantIds.length} participants with ${messages.length} messages`,
      messageCount: messages.length,
      timespan,
    };
  }

  /**
   * Safe transfer to long-term memory with proper locking
   */
  private async safeTransferToLongTerm(
    context: ConversationContext,
  ): Promise<void> {
    const contextKey = this.getContextKey(context.type, context.id);

    if (this.transferLocks.has(contextKey)) {
      return; // Already being processed
    }

    this.transferLocks.add(contextKey);

    try {
      await this.transferToLongTermMemory(context);
    } finally {
      this.transferLocks.delete(contextKey);
    }
  }

  /**
   * Enhanced memory transfer with better batching and consolidation
   */
  private async transferToLongTermMemory(
    context: ConversationContext,
  ): Promise<void> {
    const messagesToTransfer = context.messages.filter(
      (msg) => msg.type === "user" || msg.type === "bot",
    );

    if (messagesToTransfer.length === 0) {
      return;
    }

    const batches = this.createSmartBatches(messagesToTransfer);

    for (const batch of batches) {
      await this.processBatch(batch, context.type, context.id);
    }

    logger.debug(
      `Transferred ${messagesToTransfer.length} messages to long-term memory`,
      {
        contextKey: this.getContextKey(context.type, context.id),
        batchCount: batches.length,
      },
    );
  }

  private createSmartBatches(
    messages: ConversationMessage[],
  ): ConversationMessage[][] {
    const batches: ConversationMessage[][] = [];
    let currentBatch: ConversationMessage[] = [];
    let currentBatchTokens = 0;
    const maxTokensPerBatch = 2000; // Rough estimate

    for (const message of messages) {
      const messageTokens = this.estimateTokens(message.content);

      if (
        currentBatchTokens + messageTokens > maxTokensPerBatch &&
        currentBatch.length > 0
      ) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchTokens = 0;
      }

      currentBatch.push(message);
      currentBatchTokens += messageTokens;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  private estimateTokens(content: any): number {
    if (typeof content === "string") {
      return Math.ceil(content.length / 4); // Rough estimate
    }
    return 10; // Default for non-string content
  }

  private async processBatch(
    messages: ConversationMessage[],
    type: "user" | "channel",
    id: string,
  ): Promise<void> {
    const summary = await this.summarizeConversation(messages);

    const memoryContent = this.createMemoryContent(summary, messages);
    const embedding = await this.generateEmbedding(memoryContent);

    const isUserContext = type === "user";
    const tags = this.extractTags(summary, messages);

    await getMemoryDatabase().createWithEmbedding(
      memoryContent,
      embedding,
      isUserContext ? parseInt(id) : undefined,
      !isUserContext ? parseInt(id) : undefined,
      {
        importance: summary.importance,
        tags,
        metadata: {
          summary,
          messageCount: messages.length,
        },
      },
    );
  }

  private createMemoryContent(
    summary: ConversationSummary,
    messages: ConversationMessage[],
  ): string {
    const recentMessages = messages
      .slice(-3)
      .map(
        (m) =>
          `${m.authorName}: ${typeof m.content === "string" ? m.content.slice(0, 200) : "[Media]"}`,
      )
      .join("\n");

    return `${summary.summary}

Topics: ${summary.mainTopics.join(", ")}
Participants: ${summary.participantIds.length} users
${summary.keyEvents.length > 0 ? `Key Events: ${summary.keyEvents.join("; ")}` : ""}
Sentiment: ${summary.sentiment}
Importance: ${summary.importance}/10

Recent Messages:
${recentMessages}`;
  }

  private extractTags(
    summary: ConversationSummary,
    messages: ConversationMessage[],
  ): string[] {
    const tags = new Set<string>();

    // Add topic-based tags
    summary.mainTopics.forEach((topic) => {
      tags.add(topic.toLowerCase().replace(/\s+/g, "_"));
    });

    // Add sentiment tag
    tags.add(summary.sentiment);

    // Add participant count tag
    if (summary.participantIds.length > 2) {
      tags.add("group_conversation");
    } else {
      tags.add("private_conversation");
    }

    // Add importance tag
    if (summary.importance >= 8) {
      tags.add("high_importance");
    } else if (summary.importance <= 3) {
      tags.add("low_importance");
    }

    return Array.from(tags);
  }

  /**
   * Memory decay process
   */
  private async decayMemoryScores(): Promise<void> {
    try {
      await getMemoryDatabase().decayScores(this.config.memoryDecayFactor);
      logger.debug("Memory decay process completed");
    } catch (error) {
      logger.error("Failed to decay memory scores:", error);
    }
  }

  /**
   * Consolidate similar memories
   */
  private async consolidateMemories(): Promise<void> {
    try {
      const candidates = await getMemoryDatabase().findConsolidationCandidates(
        this.config.consolidationThreshold,
      );

      let consolidated = 0;
      for (const group of candidates) {
        if (group.length > 1) {
          await this.consolidateMemoryGroup(group);
          consolidated++;
        }
      }

      if (consolidated > 0) {
        logger.info(`Consolidated ${consolidated} memory groups`);
      }
    } catch (error) {
      logger.error("Failed to consolidate memories:", error);
    }
  }

  private async consolidateMemoryGroup(memories: any[]): Promise<void> {
    // Implementation for consolidating similar memories
    // This would merge similar memories and update their embeddings
    // For now, we'll just mark them as consolidated
    logger.debug(`Would consolidate ${memories.length} similar memories`);
  }

  /**
   * Process memory transfers with better error handling
   */
  private async processMemoryTransfers(): Promise<void> {
    // Skip if auto-transfer is disabled or tool-driven mode is enabled
    if (
      !this.config.enableAutoTransfer ||
      this.config.disableAutoTransfer ||
      this.config.enableToolDrivenMemory
    ) {
      return;
    }

    const transferPromises: Promise<void>[] = [];

    for (const [contextKey, context] of this.shortTermMemory.entries()) {
      if (
        context.messages.length >= this.config.longTermTransferThreshold &&
        !this.transferLocks.has(contextKey)
      ) {
        const transferPromise = this.processContextTransfer(
          contextKey,
          context,
        );
        transferPromises.push(transferPromise);
      }
    }

    if (transferPromises.length > 0) {
      await Promise.allSettled(transferPromises);
    }
  }

  private async processContextTransfer(
    contextKey: string,
    context: ConversationContext,
  ): Promise<void> {
    const keepMessages = Math.floor(this.config.shortTermLimit * 0.7);
    const messagesToTransfer = context.messages.slice(0, -keepMessages);

    if (messagesToTransfer.length === 0) {
      return;
    }

    const transferContext: ConversationContext = {
      ...context,
      messages: messagesToTransfer,
    };

    await this.safeTransferToLongTerm(transferContext);

    // Update short-term memory
    context.messages = context.messages.slice(-keepMessages);
    context.lastActive = Date.now();
  }

  /**
   * Enhanced message addition with better context management
   */
  async addMessage(
    type: "user" | "channel",
    id: string,
    message: ConversationMessage,
    channel?: any,
    botUserId?: string,
    client?: any,
  ): Promise<void> {
    const contextKey = this.getContextKey(type, id);

    let context = this.shortTermMemory.get(contextKey);

    if (!context) {
      context = await this.initializeContext(
        type,
        id,
        channel,
        botUserId,
        client,
      );
      this.shortTermMemory.set(contextKey, context);
    }

    // Add relevant memories if this is a user message
    if (message.type === "user" && this.config.enableMemoryRetrieval) {
      const relevantMemories = await this.retrieveRelevantMemories(
        contextKey,
        typeof message.content === "string" ? message.content : "[Media]",
        type,
        id,
      );

      // Add memories before the current message
      context.messages.push(...relevantMemories);
    }

    context.messages.push(message);
    context.lastActive = Date.now();

    // Enhanced memory management for tool-driven mode
    if (context.messages.length > this.config.shortTermLimit) {
      const isToolDrivenMode = this.config.enableToolDrivenMemory;
      const shouldAutoTransfer =
        this.config.enableAutoTransfer &&
        !this.config.disableAutoTransfer &&
        !isToolDrivenMode;

      if (shouldAutoTransfer) {
        // Traditional auto-transfer mode
        setImmediate(() => this.processMemoryTransfers());
      } else if (isToolDrivenMode) {
        // Tool-driven mode: intelligent context management
        await this.handleToolDrivenMemoryDecision(
          context,
          contextKey,
          type,
          id,
        );
      } else {
        // Fallback: simple trimming
        context.messages = context.messages.slice(-this.config.shortTermLimit);
      }
    }

    // In tool-driven mode, analyze conversation for potential memory opportunities
    if (
      this.config.enableToolDrivenMemory &&
      this.config.enableMemoryWorthinessAnalysis &&
      message.type === "user"
    ) {
      await this.analyzeMemoryOpportunity(context, contextKey, type, id);
    }
  }

  private async initializeContext(
    type: "user" | "channel",
    id: string,
    channel?: any,
    botUserId?: string,
    client?: any,
  ): Promise<ConversationContext> {
    let history: ConversationMessage[] = [];

    if (channel && botUserId && client) {
      try {
        const { fetchShortTermMemoryHistory } = await import("../utils");
        history = await fetchShortTermMemoryHistory(
          channel,
          botUserId,
          client,
          "g!",
        );
      } catch (error) {
        logger.warn("Failed to fetch short-term history:", error);
      }
    }

    return {
      id,
      type,
      messages: history,
      lastActive: Date.now(),
    };
  }

  /**
   * Get conversation history with enhanced filtering
   */
  getHistory(
    type: "user" | "channel",
    id: string,
    options: {
      includeMemories?: boolean;
      includeSystem?: boolean;
      limit?: number;
    } = {},
  ): ConversationMessage[] {
    const { includeMemories = false, includeSystem = false, limit } = options;
    const contextKey = this.getContextKey(type, id);
    const context = this.shortTermMemory.get(contextKey);

    if (!context) {
      return [];
    }

    let messages = context.messages;

    if (!includeMemories) {
      messages = messages.filter((msg) => !msg.metadata?.isMemory);
    }

    if (!includeSystem) {
      messages = messages.filter((msg) => msg.type !== "system");
    }

    if (limit && limit > 0) {
      messages = messages.slice(-limit);
    }

    return messages;
  }

  /**
   * Enhanced statistics
   */
  getStats(): {
    activeContexts: number;
    totalMessages: number;
    avgMessagesPerContext: number;
    memoryTransfersInProgress: number;
    embeddingCacheSize: number;
    processingQueueSize: number;
  } {
    const activeContexts = this.shortTermMemory.size;
    const totalMessages = Array.from(this.shortTermMemory.values()).reduce(
      (sum, context) => sum + context.messages.length,
      0,
    );

    return {
      activeContexts,
      totalMessages,
      avgMessagesPerContext:
        activeContexts > 0 ? totalMessages / activeContexts : 0,
      memoryTransfersInProgress: this.transferLocks.size,
      embeddingCacheSize: this.memoryEmbeddingCache.size,
      processingQueueSize: this.processingQueue.size,
    };
  }

  /**
   * Force transfer all contexts to long-term memory
   */
  async transferAllToLongTerm(): Promise<void> {
    const transfers = Array.from(this.shortTermMemory.values()).map((context) =>
      this.safeTransferToLongTerm(context),
    );

    const results = await Promise.allSettled(transfers);
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    logger.info(
      `Transfer completed: ${successful} successful, ${failed} failed`,
    );
  }

  /**
   * Clear a specific conversation context
   */
  async clearContext(
    type: "user" | "channel",
    id: string,
    transferToLongTerm: boolean = true,
  ): Promise<void> {
    const contextKey = this.getContextKey(type, id);
    const context = this.shortTermMemory.get(contextKey);

    if (!context) {
      return;
    }

    if (transferToLongTerm && context.messages.length > 0) {
      await this.safeTransferToLongTerm(context);
    }

    this.shortTermMemory.delete(contextKey);
    this.memoryEmbeddingCache.delete(contextKey);

    logger.debug(`Cleared context: ${contextKey}`);
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<MemoryConfig>): void {
    Object.assign(this.config, newConfig);
    logger.info("Memory manager configuration updated", {
      config: this.config,
    });
  }

  /**
   * Get memory analytics
   */
  async getMemoryAnalytics(): Promise<MemoryAnalytics> {
    try {
      const stats = await getMemoryDatabase().getAnalytics();
      return stats;
    } catch (error) {
      logger.error("Failed to get memory analytics:", error);
      return {
        totalMemories: 0,
        memoryByType: {},
        averageImportance: 0,
        recentActivity: 0,
        topTags: [],
        memoryDistribution: {
          byImportance: {},
          byAge: {},
          byAccess: {},
        },
      };
    }
  }

  /**
   * Shutdown gracefully
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down memory manager...");

    // Clear all intervals
    // Note: In a real implementation, you'd want to store interval IDs

    // Transfer all remaining contexts
    await this.transferAllToLongTerm();

    // Clear caches
    this.memoryEmbeddingCache.clear();
    this.processingQueue.clear();
    this.transferLocks.clear();

    logger.info("Memory manager shutdown complete");
  }

  /**
   * Analyze conversation content to determine if it should be saved to memory
   */
  async analyzeMemoryWorthiness(
    messages: ConversationMessage[],
    context?: any,
  ): Promise<MemoryDecision> {
    if (!this.config.enableToolDrivenMemory) {
      return {
        shouldSave: false,
        importance: 0,
        category: "none",
        reasoning: "Tool-driven memory is disabled",
        suggestedTags: [],
        extractedFacts: [],
        relatedMemories: [],
      };
    }

    try {
      const conversationText = messages
        .filter((msg) => msg.type !== "system")
        .map(
          (msg) =>
            `${msg.authorName}: ${typeof msg.content === "string" ? msg.content : "[Media]"}`,
        )
        .join("\n");

      const analysisPrompt = `Analyze this conversation and determine if it contains information worth saving to long-term memory:

${conversationText}

Consider:
- Important facts or decisions
- User preferences or settings
- Significant events or milestones
- Knowledge that might be referenced later
- Relationship information
- Problem solutions or insights

Respond with JSON:
{
  "shouldSave": boolean,
  "importance": number (1-10),
  "category": string (${this.config.memoryCategories.join(", ")}),
  "reasoning": string,
  "suggestedTags": string[],
  "extractedFacts": string[],
  "relatedConcepts": string[]
}`;

      const response = await AIClient.chat({
        provider: this.defaultProvider,
        model: this.defaultModel,
        messages: [
          {
            role: "system",
            content:
              "You are a memory analyst. Determine what information is worth preserving long-term. Respond with valid JSON only.",
          },
          { role: "user", content: analysisPrompt },
        ],
        temperature: 0.1,
      });

      const analysisText = response.choices[0]?.message?.content?.trim();
      if (analysisText) {
        try {
          const analysis = JSON.parse(analysisText);
          return {
            shouldSave:
              analysis.shouldSave &&
              analysis.importance >= this.config.memoryDecisionThreshold,
            importance: analysis.importance || 0,
            category: analysis.category || "general",
            reasoning: analysis.reasoning || "AI analysis",
            suggestedTags: analysis.suggestedTags || [],
            extractedFacts: analysis.extractedFacts || [],
            relatedMemories: analysis.relatedConcepts || [],
          };
        } catch (parseError) {
          logger.warn("Failed to parse memory analysis JSON:", parseError);
        }
      }
    } catch (error) {
      logger.error("Memory analysis failed:", error);
    }

    return {
      shouldSave: false,
      importance: 0,
      category: "unknown",
      reasoning: "Analysis failed",
      suggestedTags: [],
      extractedFacts: [],
      relatedMemories: [],
    };
  }

  /**
   * Get memory insights for tool use
   */
  async getMemoryInsights(
    query: string,
    context?: any,
  ): Promise<MemoryInsight[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const results = await getMemoryDatabase().findSimilar(queryEmbedding, {
        topK: 20,
        minSimilarity: 0.5,
        ...(context?.userId && { userId: parseInt(context.userId) }),
        ...(context?.guildId && { guildId: parseInt(context.guildId) }),
      });

      const insights: MemoryInsight[] = [];

      // Group by themes
      const themes = new Map<string, typeof results>();
      for (const result of results) {
        const mainTag = result.data.tags[0] || "general";
        if (!themes.has(mainTag)) {
          themes.set(mainTag, []);
        }
        themes.get(mainTag)!.push(result);
      }

      // Create insights for each theme
      for (const [theme, memories] of themes) {
        if (memories.length >= 2) {
          insights.push({
            type: "theme",
            content: `Related memories about ${theme}: ${memories.length} entries`,
            confidence: Math.min(
              memories.reduce((sum, m) => sum + m.similarity, 0) /
                memories.length,
              1.0,
            ),
            relatedMemories: memories.map((m) => m.data.id),
            metadata: { theme, count: memories.length },
          });
        }
      }

      return insights;
    } catch (error) {
      logger.error("Failed to get memory insights:", error);
      return [];
    }
  }

  /**
   * Handle memory decisions in tool-driven mode
   */
  private async handleToolDrivenMemoryDecision(
    context: ConversationContext,
    contextKey: string,
    type: "user" | "channel",
    id: string,
  ): Promise<void> {
    try {
      // Analyze the conversation for memory worthiness
      const analysis = await this.analyzeMemoryWorthiness(context.messages, {
        type,
        id,
        contextKey,
      });

      if (analysis.shouldSave && analysis.confidence > 0.7) {
        // High confidence - suggest memory creation
        logger.info("High-confidence memory opportunity detected", {
          contextKey,
          importance: analysis.importance,
          confidence: analysis.confidence,
          category: analysis.category,
        });

        // Create memory opportunity insight for tools to use
        await this.createMemoryOpportunityInsight(
          analysis,
          context,
          contextKey,
        );
      }

      // Intelligent context trimming based on importance
      await this.intelligentContextTrimming(context, analysis);
    } catch (error) {
      logger.error("Error in tool-driven memory decision", error);
      // Fallback to simple trimming
      context.messages = context.messages.slice(-this.config.shortTermLimit);
    }
  }

  /**
   * Analyze conversation for memory opportunities
   */
  private async analyzeMemoryOpportunity(
    context: ConversationContext,
    contextKey: string,
    type: "user" | "channel",
    id: string,
  ): Promise<void> {
    try {
      // Only analyze if we have enough messages
      if (context.messages.length < 3) return;

      const recentMessages = context.messages.slice(-5);
      const shouldAnalyze =
        await this.shouldTriggerMemoryAnalysis(recentMessages);

      if (shouldAnalyze) {
        const analysis = await this.analyzeMemoryWorthiness(recentMessages, {
          type,
          id,
          contextKey,
        });

        if (
          analysis.shouldSave &&
          analysis.importance > this.config.memoryDecisionThreshold
        ) {
          await this.createMemoryOpportunityInsight(
            analysis,
            context,
            contextKey,
          );
        }
      }
    } catch (error) {
      logger.error("Error analyzing memory opportunity", error);
    }
  }

  /**
   * Generate memory decision context for analysis
   */
  private generateMemoryDecisionContext(
    messages: ConversationMessage[],
    contextInfo: any,
  ): any {
    const participants = new Set(messages.map((m) => m.userId).filter(Boolean));
    const timeSpan =
      messages.length > 0
        ? new Date(messages[messages.length - 1].timestamp).getTime() -
          new Date(messages[0].timestamp).getTime()
        : 0;

    const content = messages
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join(" ");

    return {
      messages,
      participants: Array.from(participants),
      conversationLength: messages.length,
      timeSpan,
      topics: this.extractTopics(content),
      sentiment: this.analyzeSentiment(content),
      userInteraction: messages.some((m) => m.type === "user"),
      decisionMade: /(?:decide|choose|will|going to|plan to)/i.test(content),
      factualContent: /(?:fact|information|data|research|study)/i.test(content),
      preferenceExpressed: /(?:prefer|like|dislike|favorite|hate|love)/i.test(
        content,
      ),
      contextInfo,
    };
  }

  /**
   * Determine if memory analysis should be triggered
   */
  private async shouldTriggerMemoryAnalysis(
    messages: ConversationMessage[],
  ): Promise<boolean> {
    const content = messages
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join(" ");

    // Trigger analysis for important patterns
    const triggers = [
      /(?:decide|choose|will|going to|plan to)/i, // Decisions
      /(?:prefer|like|dislike|favorite)/i, // Preferences
      /(?:important|remember|don't forget)/i, // Explicit importance
      /(?:fact|information|data|research)/i, // Factual content
      /(?:meeting|appointment|deadline|event)/i, // Events
      /\?.*\?/, // Multiple questions
    ];

    return triggers.some((pattern) => pattern.test(content));
  }

  /**
   * Create memory opportunity insight for tools
   */
  private async createMemoryOpportunityInsight(
    analysis: any,
    context: ConversationContext,
    contextKey: string,
  ): Promise<void> {
    const insight = {
      type: "memory_opportunity",
      timestamp: new Date().toISOString(),
      contextKey,
      analysis,
      recommendation: {
        action: "save_memory",
        priority:
          analysis.importance >= 8
            ? "high"
            : analysis.importance >= 6
              ? "medium"
              : "low",
        category: analysis.category,
        tags: analysis.suggestedTags,
        reasoning: analysis.reasoning,
      },
      context: {
        messageCount: context.messages.length,
        participants: context.participants || [],
        lastActive: context.lastActive,
      },
    };

    // Store insight for tools to access
    await this.storeMemoryInsight(insight);
  }

  /**
   * Intelligent context trimming based on importance
   */
  private async intelligentContextTrimming(
    context: ConversationContext,
    analysis: any,
  ): Promise<void> {
    if (context.messages.length <= this.config.shortTermLimit) return;

    // Score messages by importance
    const scoredMessages = context.messages.map((message, index) => ({
      message,
      index,
      score: this.calculateMessageImportance(
        message,
        index,
        context.messages.length,
      ),
    }));

    // Sort by score and keep the most important messages
    scoredMessages.sort((a, b) => b.score - a.score);

    const keepCount = Math.floor(this.config.shortTermLimit * 0.8);
    const indicesToKeep = scoredMessages
      .slice(0, keepCount)
      .map((sm) => sm.index);

    // Always keep the most recent messages
    const recentCount = Math.floor(this.config.shortTermLimit * 0.2);
    const recentIndices = Array.from(
      { length: recentCount },
      (_, i) => context.messages.length - 1 - i,
    );

    const allIndicesToKeep = [...new Set([...indicesToKeep, ...recentIndices])];
    allIndicesToKeep.sort((a, b) => a - b);

    context.messages = allIndicesToKeep.map((index) => context.messages[index]);
  }

  /**
   * Calculate importance score for a message
   */
  private calculateMessageImportance(
    message: ConversationMessage,
    index: number,
    totalMessages: number,
  ): number {
    let score = 0;

    // Recency bias
    const recencyRatio = index / totalMessages;
    score += recencyRatio * 0.3;

    // User messages are more important
    if (message.type === "user") score += 0.4;

    // Content-based scoring
    if (typeof message.content === "string") {
      const content = message.content.toLowerCase();

      // Decision-making content
      if (/(?:decide|choose|will|going to|plan to)/.test(content)) score += 0.3;

      // Preferences
      if (/(?:prefer|like|dislike|favorite)/.test(content)) score += 0.2;

      // Questions
      if (content.includes("?")) score += 0.1;

      // Explicit importance
      if (/(?:important|remember|don't forget)/.test(content)) score += 0.3;

      // Length bonus (longer messages often more important)
      score += Math.min(content.length / 200, 0.1);
    }

    return Math.min(score, 1.0);
  }

  /**
   * Extract topics from content
   */
  private extractTopics(content: string): string[] {
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

  /**
   * Analyze sentiment of content
   */
  private analyzeSentiment(content: string): string {
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

  /**
   * Store memory insight for tool access
   */
  private async storeMemoryInsight(insight: any): Promise<void> {
    try {
      // Store in a temporary insights table or cache
      // This could be implemented as a database table or in-memory cache
      logger.info("Memory insight stored", {
        type: insight.type,
        priority: insight.recommendation.priority,
        category: insight.recommendation.category,
      });
    } catch (error) {
      logger.error("Error storing memory insight", error);
    }
  }

  /**
   * Check if tool-driven memory mode is enabled
   */
  isToolDrivenMode(): boolean {
    return this.config.enableToolDrivenMemory;
  }

  /**
   * Get tool memory permissions
   */
  getToolPermissions() {
    return this.config.toolMemoryPermissions;
  }

  /**
   * Manually trigger memory transfer (for tools)
   */
  async manualMemoryTransfer(
    type: "user" | "channel",
    id: string,
    options: {
      importance?: number;
      category?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    const contextKey = this.getContextKey(type, id);
    const context = this.shortTermMemory.get(contextKey);

    if (!context || context.messages.length === 0) {
      throw new Error("No context found or no messages to transfer");
    }

    // Enhanced transfer with custom options
    const transferContext = {
      ...context,
      customOptions: options,
    };

    await this.safeTransferToLongTerm(transferContext);

    // Clear transferred messages but keep recent ones
    const keepMessages = Math.floor(this.config.shortTermLimit * 0.3);
    context.messages = context.messages.slice(-keepMessages);
    context.lastActive = Date.now();

    logger.info(`Manual memory transfer completed for ${contextKey}`, options);
  }

  /**
   * Manually trigger memory transfer (for tools)
   */
  async manualMemoryTransfer(
    type: "user" | "channel",
    id: string,
    options: {
      importance?: number;
      category?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    const contextKey = this.getContextKey(type, id);
    const context = this.shortTermMemory.get(contextKey);

    if (!context || context.messages.length === 0) {
      throw new Error("No context found or no messages to transfer");
    }

    // Enhanced transfer with custom options
    const transferContext = {
      ...context,
      customOptions: options,
    };

    await this.safeTransferToLongTerm(transferContext);

    // Clear transferred messages but keep recent ones
    const keepMessages = Math.floor(this.config.shortTermLimit * 0.3);
    context.messages = context.messages.slice(-keepMessages);
    context.lastActive = Date.now();

    logger.info(`Manual memory transfer completed for ${contextKey}`, options);
  }
}
