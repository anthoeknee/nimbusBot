export type EntityId = number;
export type DiscordId = string;

export interface BaseMemoryRecord {
  id: string;
  content: string;
  embedding: number[];
  userId?: number;
  guildId?: number;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  importance: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface MemoryRow {
  id: EntityId;
  userId: EntityId | null;
  guildId: EntityId | null;
  content: string;
  embedding: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  accessCount: number;
  importance: number;
  tags: string;
  metadata: string;
}

export interface MemoryRecord extends BaseMemoryRecord {
  score?: MemoryScore;
}

export interface MemoryScore {
  recency: number;
  frequency: number;
  importance: number;
  relevance: number;
  final: number;
}

export interface CreateMemoryInput {
  userId?: EntityId;
  guildId?: EntityId;
  content: string;
  embedding: number[];
  importance?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  accessCount?: number;
  lastAccessedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateMemoryInput {
  content?: string;
  embedding?: number[];
  importance?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  updatedAt?: string;
}

export interface MemorySearchOptions {
  userId?: EntityId;
  guildId?: EntityId;
  topK?: number;
  minSimilarity?: number;
  tags?: string[];
  importanceThreshold?: number;
}

export interface MemorySearchResult {
  data: MemoryRecord;
  similarity: number;
}

export interface MemoryRelationship {
  id: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: string;
  strength: number;
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface MemoryAnalytics {
  totalMemories: number;
  memoryByType: Record<string, number>;
  averageImportance: number;
  recentActivity: number;
  topTags: Array<{ tag: string; count: number }>;
  memoryDistribution: {
    byImportance: Record<string, number>;
    byAge: Record<string, number>;
    byAccess: Record<string, number>;
  };
  toolDrivenAnalytics?: {
    toolDrivenMemories: number;
    automaticMemories: number;
    categoryDistribution: Record<string, number>;
  };
}

export interface ConsolidationCandidate {
  id: string;
  content: string;
  embedding: number[];
  similarity: number;
  createdAt: Date;
  accessCount: number;
}

export interface MemoryDecision {
  shouldSave: boolean;
  importance: number;
  category: string;
  reasoning: string;
  suggestedTags: string[];
  extractedFacts: string[];
  relatedMemories: string[];
}

export interface MemoryInsight {
  type: string;
  content: string;
  confidence: number;
  relatedMemories: string[];
  metadata: Record<string, any>;
}

export interface ConversationSummary {
  participantIds: string[];
  mainTopics: string[];
  keyEvents: string[];
  sentiment: string;
  importance: number;
  summary: string;
  messageCount: number;
  timespan: number;
}

export interface ToolMemoryContext {
  userId?: string;
  guildId?: string;
  channelId?: string;
  conversationContext: string[];
  currentMessage?: string;
  userPreferences?: Record<string, any>;
  sessionData?: Record<string, any>;
}

export interface MemoryConfig {
  shortTermLimit: number;
  longTermTransferThreshold: number;
  maxRelevantMemories: number;
  memoryRelevanceThreshold: number;
  sessionTimeout: number;
  enableAutoTransfer: boolean;
  enableMemoryRetrieval: boolean;
  enableMemoryDecay: boolean;
  enableMemoryAnalytics: boolean;
  enableMemoryConsolidation: boolean;
  enableMemoryRelationships: boolean;
  intelligentMemoryFiltering: boolean;
  enableToolDrivenMemory: boolean;
  disableAutoTransfer: boolean;
  memoryDecisionThreshold: number;
  toolMemoryPermissions: {
    allowSave: boolean;
    allowSearch: boolean;
    allowDelete: boolean;
    allowConsolidate: boolean;
    allowAnalytics: boolean;
  };
  memoryDecayFactor: number;
  batchSize: number;
  maxRetries: number;
  embeddingDimension: number;
  consolidationThreshold: number;
  memoryCategories: string[];
  memoryRetentionPeriod: number;
}

export interface MemoryCategory {
  name: string;
  description: string;
  priority: number;
  autoTag: boolean;
  keywords: string[];
}

export interface MemoryOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}
