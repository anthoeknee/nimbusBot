import { ToolDefinition } from "../../../../types/ai";
import { logger } from "../../../../utils/logger";
import { getConversationManager } from "../../conversation";
import type {
  ToolMemoryContext,
  MemoryDecisionContext,
} from "../../memory/types";
import {
  generateEmbedding,
  analyzeConversationContext,
  calculateImportanceScore,
  determineMemoryCategory,
  determineMemoryType,
  determineRetentionPriority,
  checkForDuplication,
  generateAnalysisReasoning,
  extractFactualInformation,
  generateTags,
  findRelatedMemories,
  calculateConfidence,
} from "../memoryUtils";

export const decideMemoryAction: ToolDefinition = {
  name: "decide_memory_action",
  description:
    "Given a memory analysis, decide what action to take (save, update, discard, etc.) and return a decision object.",
  parameters: [
    {
      name: "analysis",
      type: "object",
      description: "The memory worthiness analysis object",
      required: true,
    },
    {
      name: "context",
      type: "object",
      description: "Additional context for the decision",
      required: false,
    },
  ],
  handler: async (args: any, context: ToolMemoryContext): Promise<any> => {
    try {
      const { analysis, context: decisionContext = {} } = args;
      logger.info("Deciding memory action", { analysis });

      // Use shared helpers for decision logic
      const shouldSave = analysis.shouldSave;
      const action = shouldSave ? "save" : "discard";
      const confidence = calculateConfidence(
        analysis.importance,
        analysis.category,
        analysis.isDuplicate ?? false
      );
      return {
        action,
        confidence,
        reasoning: analysis.reasoning,
        tags: analysis.suggestedTags,
        extractedFacts: analysis.extractedFacts,
        relatedMemories: analysis.relatedMemories,
        memoryType: analysis.memoryType,
        retentionPriority: analysis.retentionPriority,
      };
    } catch (error) {
      logger.error("Error deciding memory action", error);
      throw new Error(`Memory action decision failed: ${error.message}`);
    }
  },
};
