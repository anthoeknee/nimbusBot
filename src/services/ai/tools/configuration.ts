import { ToolDefinition } from "../../../types/ai";
import { getConversationManager } from "../conversation";
import { logger } from "../../../utils/logger";
import { MemoryConfig } from "../memory/types";

export const configureMemorySystem: ToolDefinition = {
  name: "configure_memory_system",
  description:
    "Configure the memory system settings including tool-driven mode, thresholds, and permissions.",
  parameters: [
    {
      name: "enableToolDrivenMemory",
      type: "boolean",
      description: "Enable or disable tool-driven memory mode",
      required: false,
    },
    {
      name: "disableAutoTransfer",
      type: "boolean",
      description: "Disable automatic memory transfer",
      required: false,
    },
    {
      name: "memoryDecisionThreshold",
      type: "number",
      description: "Threshold for memory importance decisions (1-10)",
      required: false,
    },
    {
      name: "enableMemoryAnalytics",
      type: "boolean",
      description: "Enable memory analytics and insights",
      required: false,
    },
    {
      name: "intelligentMemoryFiltering",
      type: "boolean",
      description: "Enable intelligent memory filtering",
      required: false,
    },
    {
      name: "memoryRetentionPeriod",
      type: "number",
      description: "Memory retention period in days",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for configuration change",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const {
      enableToolDrivenMemory,
      disableAutoTransfer,
      memoryDecisionThreshold,
      enableMemoryAnalytics,
      intelligentMemoryFiltering,
      memoryRetentionPeriod,
      reason,
    } = args;

    // Validate inputs
    if (
      memoryDecisionThreshold !== undefined &&
      (memoryDecisionThreshold < 1 || memoryDecisionThreshold > 10)
    ) {
      throw new Error("Memory decision threshold must be between 1 and 10");
    }

    if (
      memoryRetentionPeriod !== undefined &&
      (memoryRetentionPeriod < 1 || memoryRetentionPeriod > 365)
    ) {
      throw new Error("Memory retention period must be between 1 and 365 days");
    }

    try {
      const conversationManager = getConversationManager();
      const currentConfig = conversationManager.instance.config;
      const updates: Partial<MemoryConfig> = {};

      // Apply configuration changes
      if (enableToolDrivenMemory !== undefined) {
        updates.enableToolDrivenMemory = enableToolDrivenMemory;
        if (enableToolDrivenMemory) {
          updates.disableAutoTransfer = true; // Auto-disable transfer in tool-driven mode
        }
      }

      if (disableAutoTransfer !== undefined) {
        updates.disableAutoTransfer = disableAutoTransfer;
      }

      if (memoryDecisionThreshold !== undefined) {
        updates.memoryDecisionThreshold = memoryDecisionThreshold;
      }

      if (enableMemoryAnalytics !== undefined) {
        updates.enableMemoryAnalytics = enableMemoryAnalytics;
      }

      if (intelligentMemoryFiltering !== undefined) {
        updates.intelligentMemoryFiltering = intelligentMemoryFiltering;
      }

      if (memoryRetentionPeriod !== undefined) {
        updates.memoryRetentionPeriod = memoryRetentionPeriod;
      }

      // Apply updates
      conversationManager.instance.updateConfig(updates);

      // Log configuration change
      logger.info("Memory system configuration updated", {
        updates,
        reason: reason || "No reason provided",
        timestamp: new Date().toISOString(),
      });

      const newConfig = conversationManager.instance.config;

      return {
        success: true,
        message: "Memory system configuration updated successfully",
        updatedSettings: updates,
        currentConfiguration: {
          toolDrivenMode: newConfig.enableToolDrivenMemory,
          autoTransferDisabled: newConfig.disableAutoTransfer,
          memoryDecisionThreshold: newConfig.memoryDecisionThreshold,
          analyticsEnabled: newConfig.enableMemoryAnalytics,
          intelligentFiltering: newConfig.intelligentMemoryFiltering,
          retentionPeriod: newConfig.memoryRetentionPeriod,
        },
        reason: reason || "Configuration update",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to configure memory system:", error);
      throw new Error("Memory system configuration failed");
    }
  },
};

export const setMemoryPermissions: ToolDefinition = {
  name: "set_memory_permissions",
  description:
    "Configure tool permissions for memory operations to control what memory actions are allowed.",
  parameters: [
    {
      name: "allowSave",
      type: "boolean",
      description: "Allow saving new memories",
      required: false,
    },
    {
      name: "allowSearch",
      type: "boolean",
      description: "Allow searching existing memories",
      required: false,
    },
    {
      name: "allowDelete",
      type: "boolean",
      description: "Allow deleting memories",
      required: false,
    },
    {
      name: "allowConsolidate",
      type: "boolean",
      description: "Allow memory consolidation",
      required: false,
    },
    {
      name: "allowAnalytics",
      type: "boolean",
      description: "Allow memory analytics and insights",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for permission change",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const {
      allowSave,
      allowSearch,
      allowDelete,
      allowConsolidate,
      allowAnalytics,
      reason,
    } = args;

    try {
      const conversationManager = getConversationManager();
      const currentConfig = conversationManager.instance.config;
      const currentPermissions = currentConfig.toolMemoryPermissions;

      const updatedPermissions = {
        ...currentPermissions,
        ...(allowSave !== undefined && { allowSave }),
        ...(allowSearch !== undefined && { allowSearch }),
        ...(allowDelete !== undefined && { allowDelete }),
        ...(allowConsolidate !== undefined && { allowConsolidate }),
        ...(allowAnalytics !== undefined && { allowAnalytics }),
      };

      conversationManager.instance.updateConfig({
        toolMemoryPermissions: updatedPermissions,
      });

      logger.info("Memory permissions updated", {
        oldPermissions: currentPermissions,
        newPermissions: updatedPermissions,
        reason: reason || "No reason provided",
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: "Memory permissions updated successfully",
        permissions: updatedPermissions,
        changes: {
          ...(allowSave !== undefined && { allowSave }),
          ...(allowSearch !== undefined && { allowSearch }),
          ...(allowDelete !== undefined && { allowDelete }),
          ...(allowConsolidate !== undefined && { allowConsolidate }),
          ...(allowAnalytics !== undefined && { allowAnalytics }),
        },
        reason: reason || "Permission update",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to set memory permissions:", error);
      throw new Error("Memory permissions update failed");
    }
  },
};

export const addMemoryCategory: ToolDefinition = {
  name: "add_memory_category",
  description:
    "Add a new memory category to the system for better organization and classification.",
  parameters: [
    {
      name: "category",
      type: "string",
      description: "Name of the new category",
      required: true,
    },
    {
      name: "description",
      type: "string",
      description: "Description of what this category represents",
      required: false,
    },
    {
      name: "priority",
      type: "number",
      description: "Priority level for this category (1-10)",
      required: false,
    },
    {
      name: "keywords",
      type: "array",
      description: "Keywords that might trigger this category",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const { category, description, priority = 5, keywords = [] } = args;

    if (typeof category !== "string" || category.trim().length === 0) {
      throw new Error("Category must be a non-empty string");
    }

    if (priority < 1 || priority > 10) {
      throw new Error("Priority must be between 1 and 10");
    }

    try {
      const conversationManager = getConversationManager();
      const currentConfig = conversationManager.instance.config;
      const currentCategories = currentConfig.memoryCategories || [];

      // Check if category already exists
      if (currentCategories.includes(category)) {
        throw new Error(`Category '${category}' already exists`);
      }

      // Add new category
      const updatedCategories = [...currentCategories, category];

      conversationManager.instance.updateConfig({
        memoryCategories: updatedCategories,
      });

      logger.info("Memory category added", {
        category,
        description,
        priority,
        keywords,
        totalCategories: updatedCategories.length,
      });

      return {
        success: true,
        message: `Memory category '${category}' added successfully`,
        category,
        description,
        priority,
        keywords,
        totalCategories: updatedCategories.length,
        allCategories: updatedCategories,
        addedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to add memory category:", error);
      throw new Error("Memory category addition failed");
    }
  },
};

export const getMemoryConfiguration: ToolDefinition = {
  name: "get_memory_configuration",
  description:
    "Get current memory system configuration including all settings, permissions, and categories.",
  parameters: [
    {
      name: "includeStats",
      type: "boolean",
      description: "Include memory usage statistics",
      required: false,
    },
    {
      name: "includePermissions",
      type: "boolean",
      description: "Include detailed permission settings",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const { includeStats = false, includePermissions = true } = args;

    try {
      const conversationManager = getConversationManager();
      const config = conversationManager.instance.config;
      const stats = includeStats
        ? conversationManager.instance.getStats()
        : null;

      const configuration = {
        toolDrivenMode: config.enableToolDrivenMemory,
        autoTransferSettings: {
          enabled: config.enableAutoTransfer,
          disabled: config.disableAutoTransfer,
          transferThreshold: config.longTermTransferThreshold,
        },
        memorySettings: {
          shortTermLimit: config.shortTermLimit,
          maxRelevantMemories: config.maxRelevantMemories,
          memoryRelevanceThreshold: config.memoryRelevanceThreshold,
          memoryDecisionThreshold: config.memoryDecisionThreshold,
          sessionTimeout: config.sessionTimeout,
        },
        featureFlags: {
          memoryRetrieval: config.enableMemoryRetrieval,
          memoryDecay: config.enableMemoryDecay,
          memoryAnalytics: config.enableMemoryAnalytics,
          memoryConsolidation: config.enableMemoryConsolidation,
          intelligentFiltering: config.intelligentMemoryFiltering,
          memoryRelationships: config.enableMemoryRelationships,
        },
        categories: config.memoryCategories,
        retentionPolicy: {
          retentionPeriod: config.memoryRetentionPeriod,
          decayFactor: config.memoryDecayFactor,
        },
        performance: {
          batchSize: config.batchSize,
          maxRetries: config.maxRetries,
          embeddingDimension: config.embeddingDimension,
          consolidationThreshold: config.consolidationThreshold,
        },
      };

      if (includePermissions) {
        configuration.permissions = config.toolMemoryPermissions;
      }

      if (includeStats) {
        configuration.statistics = stats;
      }

      return {
        success: true,
        configuration,
        retrievedAt: new Date().toISOString(),
        version: "1.0.0",
      };
    } catch (error) {
      logger.error("Failed to get memory configuration:", error);
      throw new Error("Memory configuration retrieval failed");
    }
  },
};

export const enableToolDrivenMode: ToolDefinition = {
  name: "enable_tool_driven_mode",
  description:
    "Enable tool-driven memory mode with automatic configuration adjustments. This switches from automatic to intentional memory management.",
  parameters: [
    {
      name: "memoryDecisionThreshold",
      type: "number",
      description: "Importance threshold for memory decisions (default 6.0)",
      required: false,
    },
    {
      name: "preserveExistingMemories",
      type: "boolean",
      description: "Keep existing memories when switching modes",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for enabling tool-driven mode",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const {
      memoryDecisionThreshold = 6.0,
      preserveExistingMemories = true,
      reason,
    } = args;

    if (memoryDecisionThreshold < 1 || memoryDecisionThreshold > 10) {
      throw new Error("Memory decision threshold must be between 1 and 10");
    }

    try {
      const conversationManager = getConversationManager();
      const currentConfig = conversationManager.instance.config;

      if (currentConfig.enableToolDrivenMemory) {
        return {
          success: true,
          message: "Tool-driven memory mode is already enabled",
          currentThreshold: currentConfig.memoryDecisionThreshold,
          wasAlreadyEnabled: true,
        };
      }

      // Configure for tool-driven mode
      const updates: Partial<MemoryConfig> = {
        enableToolDrivenMemory: true,
        disableAutoTransfer: true,
        memoryDecisionThreshold,
        enableMemoryAnalytics: true,
        intelligentMemoryFiltering: true,
        toolMemoryPermissions: {
          allowSave: true,
          allowSearch: true,
          allowDelete: false,
          allowConsolidate: true,
          allowAnalytics: true,
        },
      };

      conversationManager.instance.updateConfig(updates);

      // Handle existing memories if needed
      let memoryHandlingResult = null;
      if (preserveExistingMemories) {
        try {
          const stats = conversationManager.instance.getStats();
          memoryHandlingResult = {
            preservedContexts: stats.activeContexts,
            preservedMessages: stats.totalMessages,
          };
        } catch (error) {
          logger.warn("Failed to get memory stats during mode switch:", error);
        }
      }

      logger.info("Tool-driven memory mode enabled", {
        threshold: memoryDecisionThreshold,
        preserveExisting: preserveExistingMemories,
        reason: reason || "Mode switch requested",
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: "Tool-driven memory mode enabled successfully",
        configuration: {
          toolDrivenMode: true,
          autoTransferDisabled: true,
          memoryDecisionThreshold,
          analyticsEnabled: true,
          intelligentFiltering: true,
        },
        memoryHandling: memoryHandlingResult,
        reason: reason || "Tool-driven mode activation",
        enabledAt: new Date().toISOString(),
        instructions: [
          "You now have full control over memory management",
          "Use analyze_conversation_for_memory to evaluate what to save",
          "Use save_structured_memory for important information",
          "Use memory search tools to find relevant past information",
          "Memories will no longer be created automatically",
        ],
      };
    } catch (error) {
      logger.error("Failed to enable tool-driven mode:", error);
      throw new Error("Tool-driven mode activation failed");
    }
  },
};

export const resetMemoryConfiguration: ToolDefinition = {
  name: "reset_memory_configuration",
  description:
    "Reset memory configuration to default values. Use with caution as this will change all memory settings.",
  parameters: [
    {
      name: "confirmReset",
      type: "boolean",
      description: "Confirm that you want to reset all memory settings",
      required: true,
    },
    {
      name: "preservePermissions",
      type: "boolean",
      description: "Keep current permission settings",
      required: false,
    },
    {
      name: "reason",
      type: "string",
      description: "Reason for resetting configuration",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const { confirmReset, preservePermissions = false, reason } = args;

    if (!confirmReset) {
      throw new Error("Configuration reset must be confirmed");
    }

    try {
      const conversationManager = getConversationManager();
      const currentConfig = conversationManager.instance.config;
      const currentPermissions = currentConfig.toolMemoryPermissions;

      // Default configuration
      const defaultConfig: Partial<MemoryConfig> = {
        enableToolDrivenMemory: false,
        disableAutoTransfer: false,
        shortTermLimit: 35,
        longTermTransferThreshold: 30,
        maxRelevantMemories: 8,
        memoryRelevanceThreshold: 0.65,
        sessionTimeout: 60 * 60 * 1000,
        enableAutoTransfer: true,
        enableMemoryRetrieval: true,
        enableMemoryDecay: true,
        memoryDecayFactor: 0.95,
        batchSize: 10,
        maxRetries: 3,
        embeddingDimension: 1024,
        consolidationThreshold: 0.85,
        memoryDecisionThreshold: 6.0,
        enableMemoryAnalytics: true,
        memoryCategories: [
          "user_preference",
          "important_fact",
          "decision",
          "relationship",
          "event",
          "knowledge",
          "reminder",
          "context",
        ],
        enableMemoryRelationships: true,
        memoryRetentionPeriod: 90,
        enableMemoryConsolidation: true,
        intelligentMemoryFiltering: true,
        toolMemoryPermissions: preservePermissions
          ? currentPermissions
          : {
              allowSave: true,
              allowSearch: true,
              allowDelete: false,
              allowConsolidate: false,
              allowAnalytics: true,
            },
      };

      conversationManager.instance.updateConfig(defaultConfig);

      logger.info("Memory configuration reset to defaults", {
        preservedPermissions: preservePermissions,
        reason: reason || "Configuration reset requested",
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: "Memory configuration reset to default values",
        resetConfiguration: defaultConfig,
        preservedPermissions: preservePermissions,
        reason: reason || "Configuration reset",
        resetAt: new Date().toISOString(),
        warnings: [
          "All memory settings have been reset to defaults",
          "Tool-driven mode has been disabled",
          "Auto-transfer has been re-enabled",
          "Consider reconfiguring based on your needs",
        ],
      };
    } catch (error) {
      logger.error("Failed to reset memory configuration:", error);
      throw new Error("Memory configuration reset failed");
    }
  },
};

export const validateMemoryConfiguration: ToolDefinition = {
  name: "validate_memory_configuration",
  description:
    "Validate current memory configuration and identify potential issues or optimization opportunities.",
  parameters: [
    {
      name: "includeRecommendations",
      type: "boolean",
      description: "Include optimization recommendations",
      required: false,
    },
    {
      name: "checkConsistency",
      type: "boolean",
      description: "Check configuration consistency",
      required: false,
    },
  ],
  handler: async (args, context) => {
    const { includeRecommendations = true, checkConsistency = true } = args;

    try {
      const conversationManager = getConversationManager();
      const config = conversationManager.instance.config;
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        recommendations: [],
      };

      // Check basic configuration validity
      if (config.shortTermLimit < 1 || config.shortTermLimit > 100) {
        validation.errors.push(
          "Short term limit should be between 1 and 100 messages",
        );
        validation.isValid = false;
      }

      if (
        config.memoryDecisionThreshold < 1 ||
        config.memoryDecisionThreshold > 10
      ) {
        validation.errors.push(
          "Memory decision threshold should be between 1 and 10",
        );
        validation.isValid = false;
      }

      if (
        config.memoryRelevanceThreshold < 0 ||
        config.memoryRelevanceThreshold > 1
      ) {
        validation.errors.push(
          "Memory relevance threshold should be between 0 and 1",
        );
        validation.isValid = false;
      }

      // Check consistency
      if (checkConsistency) {
        if (config.enableToolDrivenMemory && config.enableAutoTransfer) {
          validation.warnings.push(
            "Tool-driven mode with auto-transfer enabled may cause conflicts",
          );
        }

        if (config.enableToolDrivenMemory && !config.disableAutoTransfer) {
          validation.warnings.push(
            "Tool-driven mode should typically disable auto-transfer",
          );
        }

        if (
          config.longTermTransferThreshold > config.shortTermLimit &&
          config.enableAutoTransfer
        ) {
          validation.warnings.push(
            "Transfer threshold is higher than short term limit",
          );
        }
      }

      // Generate recommendations
      if (includeRecommendations) {
        if (config.enableToolDrivenMemory) {
          validation.recommendations.push(
            "Consider enabling memory analytics for better insights",
          );
          validation.recommendations.push(
            "Set memory decision threshold based on your use case",
          );
        }

        if (config.maxRelevantMemories > 15) {
          validation.recommendations.push(
            "Consider reducing max relevant memories for better performance",
          );
        }

        if (config.memoryDecayFactor > 0.98) {
          validation.recommendations.push(
            "Consider a lower decay factor for better memory aging",
          );
        }
      }

      return {
        success: true,
        validation,
        configuration: {
          toolDrivenMode: config.enableToolDrivenMemory,
          autoTransferEnabled:
            config.enableAutoTransfer && !config.disableAutoTransfer,
          shortTermLimit: config.shortTermLimit,
          memoryDecisionThreshold: config.memoryDecisionThreshold,
          memoryRelevanceThreshold: config.memoryRelevanceThreshold,
        },
        validatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to validate memory configuration:", error);
      throw new Error("Memory configuration validation failed");
    }
  },
};
