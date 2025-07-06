import { ConversationContext, ConversationMessage } from "../../types/ai";
import { database } from "../db";
import { AIClient } from "./client";
import { fetchShortTermMemoryHistory, cleanAIResponse } from "./utils";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import { EnhancedMemoryManager } from "./memory";
import type {
  MemoryConfig,
  MemoryDecision,
  MemoryInsight,
} from "./memory/types";

// Enhanced conversation manager using the new memory system
export class EnhancedConversationManager {
  private memoryManager: EnhancedMemoryManager;

  constructor(customConfig?: Partial<MemoryConfig>) {
    this.memoryManager = new EnhancedMemoryManager(customConfig);
    logger.info(
      "Enhanced Conversation Manager initialized with new memory system",
    );
  }

  /**
   * Add a message to the conversation with enhanced memory integration
   */
  async addMessage(
    type: "user" | "channel",
    id: string,
    message: ConversationMessage,
    channel?: any,
    botUserId?: string,
    client?: any,
  ): Promise<void> {
    return this.memoryManager.addMessage(
      type,
      id,
      message,
      channel,
      botUserId,
      client,
    );
  }

  /**
   * Get conversation history with optional memory integration
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
    return this.memoryManager.getHistory(type, id, options);
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    activeContexts: number;
    totalMessages: number;
    avgMessagesPerContext: number;
    memoryTransfersInProgress: number;
  } {
    return this.memoryManager.getStats();
  }

  /**
   * Force transfer of all contexts to long-term memory (useful for shutdown)
   */
  async transferAllToLongTerm(): Promise<void> {
    return this.memoryManager.transferAllToLongTerm();
  }

  /**
   * Clear a specific conversation context
   */
  async clearContext(
    type: "user" | "channel",
    id: string,
    transferToLongTerm: boolean = true,
  ): Promise<void> {
    return this.memoryManager.clearContext(type, id, transferToLongTerm);
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<MemoryConfig>): void {
    this.memoryManager.updateConfig(newConfig);
  }

  /**
   * Check if tool-driven memory mode is enabled
   */
  isToolDrivenMode(): boolean {
    return this.memoryManager.isToolDrivenMode();
  }

  /**
   * Get tool memory permissions
   */
  getToolPermissions() {
    return this.memoryManager.getToolPermissions();
  }

  /**
   * Get current configuration
   */
  get config() {
    return this.memoryManager.config;
  }

  /**
   * Analyze conversation content to determine if it should be saved to memory
   */
  async analyzeMemoryWorthiness(
    messages: ConversationMessage[],
    context?: any,
  ): Promise<MemoryDecision> {
    return this.memoryManager.analyzeMemoryWorthiness(messages, context);
  }

  /**
   * Get memory insights for tool use
   */
  async getMemoryInsights(
    query: string,
    context?: any,
  ): Promise<MemoryInsight[]> {
    return this.memoryManager.getMemoryInsights(query, context);
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
    return this.memoryManager.manualMemoryTransfer(type, id, options);
  }

  /**
   * Get memory analytics
   */
  async getMemoryAnalytics() {
    return this.memoryManager.getMemoryAnalytics();
  }

  /**
   * Shutdown gracefully
   */
  async shutdown(): Promise<void> {
    return this.memoryManager.shutdown();
  }
}

// Re-export types for backward compatibility
export type { MemoryConfig } from "./memory/types";
export type { ConversationSummary } from "./memory/types";
export type { MemoryDecision, MemoryInsight } from "./memory/types";

// Export a factory function for the enhanced conversation manager
let _conversationManager: EnhancedConversationManager | null = null;

export function getConversationManager(
  customConfig?: Partial<MemoryConfig>,
): EnhancedConversationManager {
  if (!_conversationManager) {
    _conversationManager = new EnhancedConversationManager(customConfig);
  }
  return _conversationManager;
}

// Export the enhanced conversation manager instance (lazy initialization)
export const conversationManager = {
  get instance() {
    return getConversationManager();
  },
};
