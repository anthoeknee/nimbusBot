import { logger } from "./logger";
import { database } from "../services/db";
import type { MemoryAnalytics } from "../types/memory";

/**
 * Validates that the memory system is functioning correctly
 */
export async function validateMemorySystem(): Promise<boolean> {
  try {
    // Check if database is accessible
    const isHealthy = await database.healthCheck();
    if (!isHealthy) {
      logger.error("Memory system validation failed: Database health check failed");
      return false;
    }

    // Check if memory repository is working
    const memoryCount = await database.memories.count();
    logger.debug(`Memory system validation: Found ${memoryCount} memories in database`);

    // Test basic memory operations
    const testEmbedding = Array.from({ length: 1024 }, () => Math.random());
    const searchResults = await database.memories.findSimilar(testEmbedding, {
      topK: 1,
      minSimilarity: 0.0
    });

    logger.debug(`Memory system validation: Search operation returned ${searchResults.length} results`);

    logger.info("✅ Memory system validation passed");
    return true;
  } catch (error) {
    logger.error("❌ Memory system validation failed:", error);
    return false;
  }
}

/**
 * Logs the current status of the memory system
 */
export async function logMemorySystemStatus(): Promise<void> {
  try {
    logger.info("🧠 Checking memory system status...");

    // Validate system functionality
    const isValid = await validateMemorySystem();
    if (!isValid) {
      logger.warn("⚠️ Memory system validation failed - some features may not work correctly");
      return;
    }

    // Get memory analytics
    const analytics = await database.memories.getAnalytics();

    logger.info("📊 Memory System Status:");
    logger.info(`   Total memories: ${analytics.totalMemories}`);
    logger.info(`   Average importance: ${analytics.averageImportance.toFixed(2)}`);
    logger.info(`   Recent activity: ${analytics.recentActivity} memories accessed in last 7 days`);

    if (analytics.memoryByType) {
      const typeStats = Object.entries(analytics.memoryByType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(", ");
      logger.info(`   Memory types: ${typeStats}`);
    }

    if (analytics.topTags && analytics.topTags.length > 0) {
      const topTags = analytics.topTags
        .slice(0, 5)
        .map(tag => `${tag.tag}(${tag.count})`)
        .join(", ");
      logger.info(`   Top tags: ${topTags}`);
    }

    if (analytics.toolDrivenAnalytics) {
      logger.info(`   Tool-driven memories: ${analytics.toolDrivenAnalytics.toolDrivenMemories}`);
      logger.info(`   Automatic memories: ${analytics.toolDrivenAnalytics.automaticMemories}`);
    }

    logger.info("✅ Memory system is operational and ready");
  } catch (error) {
    logger.error("❌ Failed to get memory system status:", error);
    logger.warn("⚠️ Memory system may not be functioning correctly");
  }
}

/**
 * Quick health check for memory system (non-destructive)
 */
export async function quickValidateMemorySystem(): Promise<{
  isHealthy: boolean;
  memoryCount: number;
  canSearch: boolean;
  analytics: MemoryAnalytics | null;
}> {
  try {
    const isHealthy = await database.healthCheck();
    const memoryCount = await database.memories.count();

    let canSearch = false;
    let analytics: MemoryAnalytics | null = null;

    if (isHealthy) {
      try {
        // Test search functionality
        const testEmbedding = Array.from({ length: 1024 }, () => Math.random());
        await database.memories.findSimilar(testEmbedding, { topK: 1 });
        canSearch = true;

        // Get analytics
        analytics = await database.memories.getAnalytics();
      } catch (error) {
        logger.debug("Memory search test failed:", error);
      }
    }

    return {
      isHealthy,
      memoryCount,
      canSearch,
      analytics
    };
  } catch (error) {
    logger.error("Quick memory validation failed:", error);
    return {
      isHealthy: false,
      memoryCount: 0,
      canSearch: false,
      analytics: null
    };
  }
}

/**
 * Comprehensive memory system diagnostics
 */
export async function diagnoseMemorySystem(): Promise<{
  database: boolean;
  repository: boolean;
  search: boolean;
  analytics: boolean;
  relationships: boolean;
  overall: boolean;
}> {
  const results = {
    database: false,
    repository: false,
    search: false,
    analytics: false,
    relationships: false,
    overall: false
  };

  try {
    // Test database connectivity
    results.database = await database.healthCheck();
    logger.debug(`Database check: ${results.database ? "PASS" : "FAIL"}`);

    if (results.database) {
      // Test repository operations
      try {
        await database.memories.count();
        results.repository = true;
        logger.debug("Repository check: PASS");
      } catch (error) {
        logger.debug("Repository check: FAIL", error);
      }

      // Test search functionality
      try {
        const testEmbedding = Array.from({ length: 1024 }, () => Math.random());
        await database.memories.findSimilar(testEmbedding, { topK: 1 });
        results.search = true;
        logger.debug("Search check: PASS");
      } catch (error) {
        logger.debug("Search check: FAIL", error);
      }

      // Test analytics
      try {
        await database.memories.getAnalytics();
        results.analytics = true;
        logger.debug("Analytics check: PASS");
      } catch (error) {
        logger.debug("Analytics check: FAIL", error);
      }

      // Test relationships
      try {
        await database.memories.getRelationships("test");
        results.relationships = true;
        logger.debug("Relationships check: PASS");
      } catch (error) {
        logger.debug("Relationships check: FAIL", error);
      }
    }

    results.overall = results.database && results.repository && results.search;

    logger.info(`Memory system diagnostics: ${results.overall ? "HEALTHY" : "ISSUES DETECTED"}`);

    return results;
  } catch (error) {
    logger.error("Memory system diagnostics failed:", error);
    return results;
  }
}
