// src/utils/validate.ts
import { logger } from "./logger";
import { database } from "../services/db";
import { config } from "../config";
import {
  getMemoryDatabase,
  validateMemorySystemHealth,
} from "../services/ai/memory";

/**
 * Validation utility to check bot health and configuration
 */
export class BotValidator {
  /**
   * Validate environment configuration
   */
  static validateConfig(): boolean {
    const required = ["DISCORD_TOKEN", "AI_PROVIDER", "AI_MODEL"];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      logger.error(
        `Missing required environment variables: ${missing.join(", ")}`,
      );
      return false;
    }

    // Validate AI provider is supported
    const supportedProviders = ["groq", "cohere", "gemini"];
    if (!supportedProviders.includes(config.defaultProvider)) {
      logger.error(`Unsupported AI provider: ${config.defaultProvider}`);
      return false;
    }

    logger.info("Configuration validation passed");
    return true;
  }

  /**
   * Validate database connectivity
   */
  static async validateDatabase(): Promise<boolean> {
    try {
      const isHealthy = await database.healthCheck();
      if (!isHealthy) {
        logger.error("Database health check failed");
        return false;
      }

      // Test basic operations
      const userCount = await database.users.count();
      const guildCount = await database.guilds.count();

      logger.info(
        `Database validation passed - Users: ${userCount}, Guilds: ${guildCount}`,
      );
      return true;
    } catch (error) {
      logger.error("Database validation failed:", error);
      return false;
    }
  }

  /**
   * Validate AI services
   */
  static async validateAI(): Promise<boolean> {
    try {
      const { AIClient } = await import("../services/ai/client");

      // Test basic chat functionality
      const response = await AIClient.chat({
        provider: config.defaultProvider as any,
        model: config.defaultModel,
        messages: [{ role: "user", content: "Hello" }],
      });

      if (!response.choices?.[0]?.message?.content) {
        logger.error("AI validation failed - no response content");
        return false;
      }

      logger.info("AI services validation passed");
      return true;
    } catch (error) {
      logger.error("AI validation failed:", error);
      return false;
    }
  }

  /**
   * Validate unified memory system
   */
  static async validateMemorySystem(): Promise<boolean> {
    try {
      // Test basic memory repository access
      const memoryRepo = getMemoryDatabase();
      const memoryCount = await memoryRepo.count();

      // Test enhanced memory operations
      const testMemory = await memoryRepo.createWithEmbedding(
        "Validation test memory",
        new Array(1024).fill(0.1),
        undefined,
        undefined,
        {
          importance: 5,
          tags: ["validation", "test"],
          metadata: { test: true, validationRun: new Date().toISOString() },
        },
      );

      // Test similarity search
      const searchResults = await memoryRepo.findSimilar(
        new Array(1024).fill(0.1),
        { topK: 5, minSimilarity: 0.1 },
      );

      // Test analytics
      const analytics = await memoryRepo.getAnalytics();

      // Clean up test memory
      await memoryRepo.delete(parseInt(testMemory.id));

      // Validate system health
      const healthCheck = await validateMemorySystemHealth();
      if (!healthCheck.isHealthy) {
        logger.error("Memory system health check failed:", healthCheck.issues);
        return false;
      }

      logger.info("Unified memory system validation passed", {
        existingMemories: memoryCount,
        testMemoryId: testMemory.id,
        searchResults: searchResults.length,
        totalMemories: analytics.totalMemories,
        healthCheck: healthCheck.isHealthy,
      });

      return true;
    } catch (error) {
      logger.error("Memory system validation failed:", error);
      return false;
    }
  }

  /**
   * Run comprehensive validation
   */
  static async validateAll(): Promise<boolean> {
    logger.info("Starting comprehensive bot validation...");

    const configValid = this.validateConfig();
    if (!configValid) return false;

    const dbValid = await this.validateDatabase();
    if (!dbValid) return false;

    const memoryValid = await this.validateMemorySystem();
    if (!memoryValid) return false;

    const aiValid = await this.validateAI();
    if (!aiValid) return false;

    logger.info("✅ All validations passed - Bot is fully operational!");
    return true;
  }
  /**
   * Quick health check (non-destructive)
   */
  static async quickHealthCheck(): Promise<{
    config: boolean;
    database: boolean;
    memory: boolean;
    overall: boolean;
  }> {
    const config = this.validateConfig();
    const database = await this.validateDatabase();

    // Quick memory system check
    let memory = false;
    try {
      const memoryRepo = getMemoryDatabase();
      const count = await memoryRepo.count();
      memory = true;
      logger.debug(
        `Memory system quick check passed - ${count} memories found`,
      );
    } catch (error) {
      logger.warn("Memory system quick check failed:", error);
    }

    return {
      config,
      database,
      memory,
      overall: config && database && memory,
    };
  }
}

// Export for CLI usage
export default BotValidator;
