// Unified Memory Types - Single source of truth for all memory-related types

export type EntityId = number;
export type DiscordId = string;

// Base Memory Types
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

// Database Row Type (for raw SQLite results)
export interface MemoryRow {
  id: EntityId;
  userId: EntityId | null;
  guildId: EntityId | null;
  content: string;
  embedding: string; // JSON array string
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  accessCount: number;
  importance: number;
  tags: string; // JSON array string
  metadata: string; // JSON object string
}

// Enhanced Memory Record (parsed and enriched)
export interface MemoryRecord extends BaseMemoryRecord {
  score?: MemoryScore;
}

// Legacy alias for backward compatibility
export interface EnhancedMemory extends MemoryRecord {}

// Memory Score for relevance ranking
export interface MemoryScore {
  recency: number;
  frequency: number;
  importance: number;
  relevance: number;
  final: number;
}

// Input Types
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

// Search and Query Types
export interface MemorySearchOptions {
  userId?: EntityId;
  guildId?: EntityId;
  topK?: number;
  minSimilarity?: number;
  tags?: string[];
  importanceThreshold?: number;
}

export interface VectorSearchOptions extends MemorySearchOptions {}

export interface MemorySearchResult {
  data: MemoryRecord;
  similarity: number;
}

export interface SimilarityResult<T = MemoryRecord> {
  data: T;
  similarity: number;
}

export interface VectorSearchOptions extends MemorySearchOptions {
  // Additional vector-specific options can be added here
}

// Memory Relationships
export interface MemoryRelationship {
  id: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: string;
  strength: number;
  createdAt: Date;
  metadata: Record<string, any>;
}

// Memory Analytics
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

// Memory Consolidation
export interface ConsolidationCandidate {
  id: string;
  content: string;
  embedding: number[];
  similarity: number;
  createdAt: Date;
  accessCount: number;
}

// AI-Driven Memory Analysis
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

// Conversation Analysis
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

// Tool Context
export interface ToolMemoryContext {
  userId?: string;
  guildId?: string;
  channelId?: string;
  conversationContext: string[];
  currentMessage?: string;
  userPreferences?: Record<string, any>;
  sessionData?: Record<string, any>;
}

// Memory Configuration
export interface MemoryConfig {
  // Core Settings
  shortTermLimit: number;
  longTermTransferThreshold: number;
  maxRelevantMemories: number;
  memoryRelevanceThreshold: number;
  sessionTimeout: number;

  // Feature Flags
  enableAutoTransfer: boolean;
  enableMemoryRetrieval: boolean;
  enableMemoryDecay: boolean;
  enableMemoryAnalytics: boolean;
  enableMemoryConsolidation: boolean;
  enableMemoryRelationships: boolean;
  intelligentMemoryFiltering: boolean;

  // Tool-Driven Memory
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

  // Advanced Settings
  memoryDecayFactor: number;
  batchSize: number;
  maxRetries: number;
  embeddingDimension: number;
  consolidationThreshold: number;
  memoryCategories: string[];
  memoryRetentionPeriod: number;
}

// Memory Categories
export interface MemoryCategory {
  name: string;
  description: string;
  priority: number;
  autoTag: boolean;
  keywords: string[];
}

// Memory Operation Results
export interface MemoryOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// Type Guards
export function isMemoryRow(obj: unknown): obj is MemoryRow {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "id" in obj &&
    "content" in obj &&
    "embedding" in obj &&
    typeof (obj as any).id === "number" &&
    typeof (obj as any).content === "string" &&
    typeof (obj as any).embedding === "string"
  );
}

export function isMemoryRecord(obj: unknown): obj is MemoryRecord {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "id" in obj &&
    "content" in obj &&
    "embedding" in obj &&
    typeof (obj as any).id === "string" &&
    typeof (obj as any).content === "string" &&
    Array.isArray((obj as any).embedding)
  );
}

export function isCreateMemoryInput(obj: unknown): obj is CreateMemoryInput {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "content" in obj &&
    "embedding" in obj &&
    typeof (obj as any).content === "string" &&
    Array.isArray((obj as any).embedding) &&
    (obj as any).embedding.every((item: unknown) => typeof item === "number")
  );
}

export function isMemorySearchOptions(
  obj: unknown,
): obj is MemorySearchOptions {
  return obj !== null && typeof obj === "object";
}

// Utility Types
export type MemorySearchMode = "similarity" | "keyword" | "category" | "hybrid";
export type MemorySortBy =
  | "relevance"
  | "importance"
  | "recency"
  | "access_count";
export type MemoryImportanceLevel = "low" | "medium" | "high" | "critical";

// Strict type for memory importance values
export type MemoryImportanceValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Database operation result types
export interface DatabaseOperationSuccess<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface DatabaseOperationError {
  success: false;
  error: string;
  details?: any;
}

export type DatabaseOperationResult<T = any> =
  | DatabaseOperationSuccess<T>
  | DatabaseOperationError;

// Constants
export const MEMORY_CATEGORIES = [
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
] as const;

export type MemoryCategoryType = (typeof MEMORY_CATEGORIES)[number];

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  shortTermLimit: 35,
  longTermTransferThreshold: 30,
  maxRelevantMemories: 8,
  memoryRelevanceThreshold: 0.65,
  sessionTimeout: 60 * 60 * 1000,
  enableAutoTransfer: true,
  enableMemoryRetrieval: true,
  enableMemoryDecay: true,
  enableMemoryAnalytics: true,
  enableMemoryConsolidation: true,
  enableMemoryRelationships: true,
  intelligentMemoryFiltering: true,
  enableToolDrivenMemory: false,
  disableAutoTransfer: false,
  memoryDecisionThreshold: 6.0,
  toolMemoryPermissions: {
    allowSave: true,
    allowSearch: true,
    allowDelete: false,
    allowConsolidate: false,
    allowAnalytics: true,
  },
  memoryDecayFactor: 0.95,
  batchSize: 10,
  maxRetries: 3,
  embeddingDimension: 1024,
  consolidationThreshold: 0.85,
  memoryCategories: [...MEMORY_CATEGORIES],
  memoryRetentionPeriod: 90,
} as const;

// Helper function to validate memory configuration
export function validateMemoryConfig(
  config: Partial<MemoryConfig>,
): DatabaseOperationResult<MemoryConfig> {
  const errors: string[] = [];

  if (
    config.shortTermLimit !== undefined &&
    (config.shortTermLimit < 1 || config.shortTermLimit > 1000)
  ) {
    errors.push("shortTermLimit must be between 1 and 1000");
  }

  if (
    config.memoryRelevanceThreshold !== undefined &&
    (config.memoryRelevanceThreshold < 0 || config.memoryRelevanceThreshold > 1)
  ) {
    errors.push("memoryRelevanceThreshold must be between 0 and 1");
  }

  if (
    config.memoryDecisionThreshold !== undefined &&
    (config.memoryDecisionThreshold < 1 || config.memoryDecisionThreshold > 10)
  ) {
    errors.push("memoryDecisionThreshold must be between 1 and 10");
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: "Invalid memory configuration",
      details: errors,
    };
  }

  return {
    success: true,
    data: { ...DEFAULT_MEMORY_CONFIG, ...config },
  };
}
