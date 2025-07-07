import { EnhancedMemoryManager } from "./MemoryManager";
import { database } from "../../db";
import { logger } from "../../../utils/logger";

// Re-export types and classes
export { EnhancedMemoryManager } from "./MemoryManager";

// Export all unified memory types
export * from "../../../types/memory";

// Export legacy types from AI memory module for backward compatibility
export type { MemoryDecision, MemoryInsight, ToolMemoryContext } from "./types";

// Global enhanced memory repository instance
let enhancedMemoryRepository: any = null;

/**
 * Initialize the enhanced memory repository (replaces old MemoryDatabase)
 */
export async function initializeMemoryDatabase(
  mainDatabase?: any
): Promise<any> {
  if (enhancedMemoryRepository) {
    return enhancedMemoryRepository;
  }

  try {
    // Use the unified database system
    enhancedMemoryRepository = database.memories;

    // Verify the memory system is working correctly
    const testCount = await enhancedMemoryRepository.count();
    logger.info(
      `Enhanced memory repository initialized successfully with ${testCount} existing memories`
    );

    return enhancedMemoryRepository;
  } catch (error) {
    logger.error("Failed to initialize enhanced memory repository:", error);
    throw new Error(
      `Enhanced memory repository initialization failed: ${error.message}`
    );
  }
}

/**
 * Get the enhanced memory repository instance (replaces getMemoryDatabase)
 */
export function getMemoryDatabase(): any {
  if (!enhancedMemoryRepository) {
    // Auto-initialize with the unified database system
    enhancedMemoryRepository = database.memories;
  }
  return enhancedMemoryRepository;
}

/**
 * Alias for backward compatibility
 */
export const getEnhancedMemoryRepository = getMemoryDatabase;

/**
 * Create a new enhanced memory manager with default configuration
 */
export function createMemoryManager(
  config?: Partial<any>
): EnhancedMemoryManager {
  // Import default config from unified types
  const { DEFAULT_MEMORY_CONFIG } = require("../../../types/memory");

  const mergedConfig = {
    ...DEFAULT_MEMORY_CONFIG,
    ...config,
  };

  return new EnhancedMemoryManager(mergedConfig);
}

/**
 * Initialize the unified memory system
 */
export async function initializeMemorySystem(mainDatabase?: any): Promise<{
  memoryDatabase: any;
  memoryManager: EnhancedMemoryManager;
}> {
  try {
    // Use the unified database system - tables are already verified in schema
    const memoryDb = await initializeMemoryDatabase();
    const memoryManager = createMemoryManager();

    logger.info("Unified memory system initialized successfully", {
      memoryManagerConfig: {
        toolDrivenMode: memoryManager.isToolDrivenMode(),
        autoTransfer: memoryManager.config.enableAutoTransfer,
      },
    });

    return {
      memoryDatabase: memoryDb,
      memoryManager,
    };
  } catch (error) {
    logger.error("Failed to initialize unified memory system:", error);
    throw new Error(
      `Unified memory system initialization failed: ${error.message}`
    );
  }
}

/**
 * Shutdown the memory system gracefully
 */
export async function shutdownMemorySystem(): Promise<void> {
  if (enhancedMemoryRepository) {
    // The enhanced repository doesn't need explicit shutdown
    enhancedMemoryRepository = null;
  }

  logger.info("Unified memory system shutdown complete");
}

// NOTE: The EnhancedDatabaseService and related service-layer abstractions have been removed.
//       Use the direct repository classes (e.g., database.memories) for all database operations.
//       This ensures maximum clarity, maintainability, and type safety.

/**
 * Validate memory system health
 */
export async function validateMemorySystemHealth(): Promise<{
  isHealthy: boolean;
  issues: string[];
  stats: any;
  tableStructure?: any;
}> {
  const issues: string[] = [];
  let stats: any = {};
  let tableStructure: any = {};

  try {
    if (!enhancedMemoryRepository) {
      issues.push("Enhanced memory repository not initialized");
    } else {
      // Check table structure using the database connection
      const memoryTableInfo = database.db
        .prepare(`PRAGMA table_info(memories)`)
        .all();

      const relationshipTableInfo = database.db
        .prepare(`PRAGMA table_info(memory_relationships)`)
        .all();

      tableStructure = {
        memoriesColumns: memoryTableInfo.map((col: any) => col.name),
        relationshipsColumns: relationshipTableInfo.map((col: any) => col.name),
      };

      // Verify required columns exist
      const requiredMemoryColumns = [
        "id",
        "content",
        "embedding",
        "importance",
        "tags",
        "metadata",
        "lastAccessedAt",
        "accessCount",
      ];
      const missingColumns = requiredMemoryColumns.filter(
        (col) => !tableStructure.memoriesColumns.includes(col)
      );

      if (missingColumns.length > 0) {
        issues.push(
          `Missing required columns in memories table: ${missingColumns.join(", ")}`
        );
      }

      stats = await enhancedMemoryRepository.getAnalytics();
    }

    // Add more health checks here
    if (stats.totalMemories === 0) {
      // This is not necessarily an issue for a new system
      logger.debug(
        "No memories found in database - this is normal for a new installation"
      );
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      stats,
      tableStructure,
    };
  } catch (error) {
    issues.push(`Health check failed: ${error.message}`);
    return {
      isHealthy: false,
      issues,
      stats: {},
      tableStructure: {},
    };
  }
}
