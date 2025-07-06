// Re-export unified memory types and extend with service-specific types
export * from "../../../types/memory";

// Import specific types for extension
import type {
  MemoryConfig as UnifiedMemoryConfig,
  MemoryRecord,
  MemoryAnalytics,
} from "../../../types/memory";

// Extend the unified MemoryConfig with additional service-specific permissions
export interface MemoryConfig
  extends Omit<UnifiedMemoryConfig, "toolMemoryPermissions"> {
  // Enhanced tool memory permissions for service layer
  toolMemoryPermissions: {
    allowSave: boolean;
    allowSearch: boolean;
    allowDelete: boolean;
    allowConsolidate: boolean;
    allowAnalytics: boolean;
    allowCuration: boolean;
    allowRelationships: boolean;
    allowBulkOperations: boolean;
  };

  // Additional service-specific configuration
  enableMemoryWorthinessAnalysis: boolean;
  requireExplicitMemorySave: boolean;
  enableMemoryInsights: boolean;
  enableMemoryRecommendations: boolean;
  enableMemoryPatternAnalysis: boolean;
  enableContextualMemoryRetrieval: boolean;
  enableMemoryArchiving: boolean;
  memoryImportanceWeighting: {
    userPreference: number;
    factualInformation: number;
    decisions: number;
    relationships: number;
    events: number;
    knowledge: number;
  };
}

// Memory decision analysis types
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

export interface ToolMemoryContext {
  userId?: string;
  guildId?: string;
  channelId?: string;
  conversationContext: string[];
  currentMessage?: string;
  userPreferences?: Record<string, any>;
  sessionData?: Record<string, any>;
  memoryPermissions?: {
    canSave: boolean;
    canSearch: boolean;
    canDelete: boolean;
    canConsolidate: boolean;
    maxMemoriesPerSave: number;
    allowedCategories: string[];
  };
  aiDecisionContext?: {
    conversationImportance: number;
    userEngagement: number;
    topicRelevance: number;
    memoryPressure: number;
  };
}

// Enhanced conversation summary
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

// Memory scoring for relevance
export interface MemoryScore {
  recency: number;
  frequency: number;
  importance: number;
  relevance: number;
  final: number;
}

// Memory worthiness analysis
export interface MemoryWorthinessAnalysis {
  shouldSave: boolean;
  confidence: number;
  importance: number;
  category: string;
  reasoning: string;
  suggestedTags: string[];
  extractedFacts: string[];
  relatedMemories: string[];
  memoryType: "episodic" | "semantic" | "procedural" | "contextual";
  retentionPriority: "low" | "medium" | "high" | "critical";
}

// Memory management actions
export interface MemoryManagementAction {
  type: "save" | "consolidate" | "archive" | "delete" | "update" | "relate";
  memoryId?: string;
  content?: string;
  metadata?: Record<string, any>;
  reasoning: string;
  confidence: number;
  impact: "low" | "medium" | "high";
}

export interface MemoryRecommendation {
  action: MemoryManagementAction;
  priority: number;
  reasoning: string;
  context: string;
  expectedBenefit: string;
  risks: string[];
}

// Memory decision context
export interface MemoryDecisionContext {
  messages: any[];
  participants: string[];
  conversationLength: number;
  timeSpan: number;
  topics: string[];
  sentiment: string;
  userInteraction: boolean;
  decisionMade: boolean;
  factualContent: boolean;
  preferenceExpressed: boolean;
}

// Enhanced memory with service-specific fields
export interface EnhancedMemory extends MemoryRecord {
  score?: MemoryScore;
}
