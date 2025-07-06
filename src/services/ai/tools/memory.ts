import { ToolDefinition } from "../../../types/ai";
import { database } from "../../db";

export const saveLongTermMemory: ToolDefinition = {
  name: "save_long_term_memory",
  description: "Save a new long-term memory with content and embedding.",
  parameters: [
    {
      name: "content",
      type: "string",
      description: "The memory content to store.",
      required: true,
    },
    {
      name: "embedding",
      type: "array",
      description: "Vector embedding for similarity search.",
      required: true,
    },
    {
      name: "userId",
      type: "number",
      description: "User ID (optional)",
      required: false,
    },
    {
      name: "guildId",
      type: "number",
      description: "Guild ID (optional)",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const { content, embedding, userId, guildId } = args;
    if (!Array.isArray(embedding) || typeof content !== "string") {
      throw new Error("Invalid arguments for save_long_term_memory");
    }
    const memory = await database.memories.createWithEmbedding(
      content,
      embedding,
      userId,
      guildId
    );
    return memory;
  },
};

export const searchLongTermMemory: ToolDefinition = {
  name: "search_long_term_memory",
  description: "Search long-term memories by vector similarity.",
  parameters: [
    {
      name: "embedding",
      type: "array",
      description: "Query embedding vector.",
      required: true,
    },
    {
      name: "topK",
      type: "number",
      description: "Number of top results to return (default 5)",
      required: false,
    },
    {
      name: "userId",
      type: "number",
      description: "User ID (optional)",
      required: false,
    },
    {
      name: "guildId",
      type: "number",
      description: "Guild ID (optional)",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const { embedding, topK, userId, guildId } = args;
    if (!Array.isArray(embedding)) {
      throw new Error("Invalid embedding for search_long_term_memory");
    }
    const results = await database.memories.findSimilar(embedding, {
      userId,
      guildId,
      topK: topK ?? 5,
    });
    return results;
  },
};
