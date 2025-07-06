import { ConversationContext, ConversationMessage } from "../../types/ai";
import { memories } from "../db";
import { AIClient } from "./client";
import { fetchShortTermMemoryHistory } from "./utils";

export class ConversationManager {
  private shortTermMemory: Map<string, ConversationContext> = new Map();
  private readonly SHORT_TERM_LIMIT = 35;
  private readonly SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
  private readonly defaultProvider = "cohere";
  private readonly defaultModel = "command-r-plus";
  private readonly defaultEmbedModel = "embed-english-v3.0";

  constructor() {
    setInterval(() => this.cleanupInactiveContexts(), 10 * 60 * 1000);
  }

  private cleanupInactiveContexts() {
    const now = Date.now();
    for (const [key, context] of this.shortTermMemory.entries()) {
      if (now - context.lastActive > this.SESSION_TIMEOUT) {
        this.shortTermMemory.delete(key);
      }
    }
  }

  private getContextKey(type: "user" | "channel", id: string) {
    return `${type}:${id}`;
  }

  /**
   * Add a message to the conversation context, initializing with short-term history if new.
   * @param type "user" for DMs, "channel" for guilds
   * @param id userId or channelId
   * @param message ConversationMessage to add
   * @param channel Discord.js channel object (TextBasedChannel)
   * @param botUserId The bot's user ID
   * @param client Discord.js client instance
   */
  async addMessage(
    type: "user" | "channel",
    id: string,
    message: ConversationMessage,
    channel?: any,
    botUserId?: string,
    client?: any
  ) {
    console.log(
      `[ConversationManager] addMessage: type=${type}, id=${id}, channel=${channel?.id}`
    );
    const key = this.getContextKey(type, id);
    let context = this.shortTermMemory.get(key);
    if (!context) {
      console.log(
        `[ConversationManager] No context found, fetching history...`
      );
      let history: ConversationMessage[] = [];
      if (channel && botUserId && client) {
        try {
          history = await fetchShortTermMemoryHistory(
            channel,
            botUserId,
            client,
            "g!"
          );
        } catch {
          history = [];
        }
      }
      context = { id, type, messages: history, lastActive: Date.now() };
      this.shortTermMemory.set(key, context);
    }
    context.messages.push(message);
    context.lastActive = Date.now();
    // Remove oldest message if over limit (no long-term transfer)
    if (context.messages.length > this.SHORT_TERM_LIMIT) {
      context.messages.shift();
    }
  }

  getHistory(type: "user" | "channel", id: string): ConversationMessage[] {
    const key = this.getContextKey(type, id);
    const context = this.shortTermMemory.get(key);
    return context ? context.messages : [];
  }
}
