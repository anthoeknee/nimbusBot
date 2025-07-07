import { ToolDefinition } from "../../../types/ai";

// Import all tools here (add new ones as you create them)
import { getWeather } from "./myTool";
import {
  saveLongTermMemory,
  searchLongTermMemory,
  getConversationStats,
  clearConversationContext,
  getMemoryAnalytics,
} from "./memory";
import {
  analyzeConversationForMemory,
  saveStructuredMemory,
  getMemoryInsights,
  consolidateMemories,
  searchMemoriesByCategory,
  manualMemoryTransfer,
} from "./memoryAdvanced";
import {
  configureMemorySystem,
  setMemoryPermissions,
  addMemoryCategory,
  getMemoryConfiguration,
  enableToolDrivenMode,
  resetMemoryConfiguration,
  validateMemoryConfiguration,
} from "./configuration";
import {
  analyzeMemoryWorthiness,
  curateMemoryCollection,
  generateMemoryRecommendations,
  assessMemoryQuality,
} from "./memory/curation";
import {
  decideMemoryAction,
  analyzeConversationContext,
  analyzeTemporalPatterns,
} from "./memory/decision";
import { mapMemoryRelationships } from "./memory/relationships";
import {
  findRelatedMemories,
  analyzeRelationshipPatterns,
} from "./memory/relationships";

// Export all tools as a flat array or object as needed
export const allTools: ToolDefinition[] = [
  getWeather,
  saveLongTermMemory,
  searchLongTermMemory,
  getConversationStats,
  clearConversationContext,
  getMemoryAnalytics,
  analyzeConversationForMemory,
  saveStructuredMemory,
  getMemoryInsights,
  consolidateMemories,
  searchMemoriesByCategory,
  manualMemoryTransfer,
  configureMemorySystem,
  setMemoryPermissions,
  addMemoryCategory,
  getMemoryConfiguration,
  enableToolDrivenMode,
  resetMemoryConfiguration,
  validateMemoryConfiguration,
  analyzeMemoryWorthiness,
  curateMemoryCollection,
  generateMemoryRecommendations,
  assessMemoryQuality,
  decideMemoryAction,
  mapMemoryRelationships,
  findRelatedMemories,
  analyzeRelationshipPatterns,
];

// Registry
const toolRegistry = new Map<string, ToolDefinition>();
for (const tool of allTools) {
  if (toolRegistry.has(tool.name)) {
    throw new Error(`Duplicate tool name: ${tool.name}`);
  }
  toolRegistry.set(tool.name, tool);
}

export function getTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values());
}

export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

// Converts a ToolDefinition to OpenAI/Cohere/Gemini function schema
export function toolToOpenAIFunction(tool: ToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: "object",
      properties: Object.fromEntries(
        tool.parameters.map((param) => [
          param.name,
          {
            type: param.type,
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
            ...(param.default !== undefined ? { default: param.default } : {}),
          },
        ])
      ),
      required: tool.parameters.filter((p) => p.required).map((p) => p.name),
    },
  };
}

export function getOpenAIFunctions() {
  return getTools().map(toolToOpenAIFunction);
}

export async function executeTool(
  name: string,
  args: any,
  context: any
): Promise<any> {
  const tool = getTool(name);
  if (!tool) throw new Error(`Tool '${name}' not found`);
  // Optionally: check permissions here
  return tool.handler(args, context);
}
