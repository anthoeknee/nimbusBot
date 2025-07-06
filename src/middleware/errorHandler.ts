// In your middleware/errorHandler.ts file

import {
  Message,
  Interaction,
  EmbedBuilder,
  Colors, // Make sure this is imported
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { logger } from "../utils/logger"; // Assuming this is correctly imported

// Error types for better categorization
export enum ErrorType {
  VALIDATION = "VALIDATION",
  PERMISSION = "PERMISSION",
  NETWORK = "NETWORK",
  DATABASE = "DATABASE",
  RATE_LIMIT = "RATE_LIMIT",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
  COMMAND = "COMMAND",
  EVENT = "EVENT",
  SERVICE = "SERVICE",
}

// Error severity levels
export enum ErrorSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

// Enhanced error context interface
export interface ErrorContext {
  type: ErrorType;
  severity: ErrorSeverity;
  userFriendly?: string;
  retryable?: boolean;
  code?: string;
  metadata?: Record<string, any>;
}

// Error tracking for analytics
interface ErrorReport {
  id: string;
  timestamp: Date;
  type: ErrorType;
  severity: ErrorSeverity;
  error: Error;
  context: ErrorContext;
  user?: string;
  guild?: string;
  channel?: string;
  stack?: string;
  metadata?: Record<string, any>;
}

// Global error tracking
const errorReports: ErrorReport[] = [];
const MAX_ERROR_REPORTS = 1000;

// Error categorization helper
function categorizeError(error: Error): ErrorContext {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Network errors
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("http") ||
    message.includes("timeout") ||
    message.includes("connection") ||
    name.includes("network")
  ) {
    return {
      type: ErrorType.NETWORK,
      severity: ErrorSeverity.MEDIUM,
      userFriendly:
        "Network connection issue. Please check your internet and try again.",
      retryable: true,
      code: "NETWORK_ERROR",
    };
  }

  // Database errors
  if (
    message.includes("database") ||
    message.includes("prisma") ||
    message.includes("sql") ||
    message.includes("connection") ||
    name.includes("database")
  ) {
    return {
      type: ErrorType.DATABASE,
      severity: ErrorSeverity.HIGH,
      userFriendly: "Database connection issue. Please try again in a moment.",
      retryable: true,
      code: "DB_ERROR",
    };
  }

  // Permission errors (explicit name check)
  if (
    name === "permissiondenied" ||
    message.includes("permission") ||
    message.includes("access") ||
    message.includes("forbidden") ||
    name.includes("permission")
  ) {
    return {
      type: ErrorType.PERMISSION,
      severity: ErrorSeverity.LOW,
      userFriendly: "You don't have permission to perform this action.",
      retryable: false,
      code: "PERMISSION_DENIED",
    };
  }

  // Rate limit errors
  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    name.includes("ratelimit")
  ) {
    return {
      type: ErrorType.RATE_LIMIT,
      severity: ErrorSeverity.MEDIUM,
      userFriendly: "You're making requests too quickly. Please wait a moment.",
      retryable: true,
      code: "RATE_LIMITED",
    };
  }

  // Timeout errors
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    name.includes("timeout")
  ) {
    return {
      type: ErrorType.TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      userFriendly: "Request timed out. Please try again.",
      retryable: true,
      code: "TIMEOUT",
    };
  }

  // Validation errors
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required") ||
    name.includes("validation")
  ) {
    return {
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.LOW,
      userFriendly:
        "Invalid input provided. Please check your request and try again.",
      retryable: false,
      code: "VALIDATION_ERROR",
    };
  }

  // Default unknown error
  return {
    type: ErrorType.UNKNOWN,
    severity: ErrorSeverity.HIGH,
    userFriendly: "An unexpected error occurred. Please try again later.",
    retryable: true,
    code: "UNKNOWN_ERROR",
  };
}

// Enhanced error logging
function logError(
  error: Error,
  context: ErrorContext,
  interaction?: Interaction | Message
) {
  const errorReport: ErrorReport = {
    id: generateErrorId(),
    timestamp: new Date(),
    type: context.type,
    severity: context.severity,
    error,
    context,
    user:
      interaction && "user" in interaction ? interaction.user?.id : undefined,
    guild:
      interaction && "guildId" in interaction
        ? interaction.guildId || undefined
        : undefined,
    channel:
      interaction && "channelId" in interaction
        ? interaction.channelId || undefined
        : undefined,
    stack: error.stack,
    metadata: context.metadata,
  };

  // Add to tracking
  errorReports.push(errorReport);
  if (errorReports.length > MAX_ERROR_REPORTS) {
    errorReports.shift(); // Remove oldest
  }

  // Enhanced logging with colors and structure
  const logLevel =
    context.severity === ErrorSeverity.CRITICAL
      ? "error"
      : context.severity === ErrorSeverity.HIGH
      ? "error"
      : "warn";

  logger[logLevel](
    `🚨 ERROR [${context.type}] [${context.severity}] [${errorReport.id}]:`,
    {
      message: error.message,
      name: error.name,
      code: context.code,
      user: errorReport.user,
      guild: errorReport.guild,
      channel: errorReport.channel,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      metadata: context.metadata,
    }
  );

  // Log to console with colors in development
  if (process.env.NODE_ENV === "development") {
    console.error(
      "\x1b[31m%s\x1b[0m",
      `[ERROR] ${errorReport.id} - ${error.name}: ${error.message}`
    );
    if (error.stack) {
      console.error("\x1b[33m%s\x1b[0m", error.stack);
    }
  }
}

// Generate unique error ID
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create beautiful error embed
function createErrorEmbed(
  error: Error,
  context: ErrorContext,
  errorId: string
): EmbedBuilder {
  const severityColors = {
    [ErrorSeverity.LOW]: Colors.Yellow,
    [ErrorSeverity.MEDIUM]: Colors.Orange,
    [ErrorSeverity.HIGH]: Colors.Red,
    [ErrorSeverity.CRITICAL]: Colors.DarkRed,
  };

  const severityEmojis = {
    [ErrorSeverity.LOW]: "⚠️",
    [ErrorSeverity.MEDIUM]: "",
    [ErrorSeverity.HIGH]: "💥",
    [ErrorSeverity.CRITICAL]: "🔥",
  };

  const embed = new EmbedBuilder()
    .setTitle(`${severityEmojis[context.severity]} Error Occurred`)
    .setDescription(
      context.userFriendly ||
        "An unexpected error occurred. Please try again later."
    )
    .setColor(severityColors[context.severity])
    .addFields(
      {
        name: "Error Type",
        value: `\`${context.type}\``,
        inline: true,
      },
      {
        name: "Error Code",
        value: `\`${context.code || "N/A"}\``,
        inline: true,
      },
      {
        name: "Error ID",
        value: `\`${errorId}\``,
        inline: true,
      }
    )
    .setTimestamp();

  // Add retry information if applicable
  if (context.retryable) {
    embed.addFields({
      name: "🔄 Retry",
      value: "This error is retryable. You can try again in a moment.",
      inline: false,
    });
  }

  // Add development info
  if (process.env.NODE_ENV === "development") {
    embed.addFields({
      name: " Debug Info",
      value: `\`\`\`${error.name}: ${error.message}\`\`\``,
      inline: false,
    });
  }

  return embed;
}

// Create error action buttons
function createErrorActions(
  errorId: string,
  context: ErrorContext
): ActionRowBuilder<ButtonBuilder> {
  const buttons: ButtonBuilder[] = [];

  if (context.retryable) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`retry_${errorId}`)
        .setLabel("🔄 Retry")
        .setStyle(ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`report_${errorId}`)
      .setLabel("📋 Report Issue")
      .setStyle(ButtonStyle.Secondary)
  );

  if (process.env.NODE_ENV === "development") {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`debug_${errorId}`)
        .setLabel("🐛 Debug Info")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

// Enhanced error handler with multiple overloads
export function errorHandler<T extends ChatInputCommandInteraction | Message>(
  handler: (ctx: T) => Promise<any> | any,
  options?: {
    context?: Partial<ErrorContext>;
    fallback?: (ctx: T, error: Error) => Promise<void>;
    silent?: boolean;
  }
) {
  return async (ctx: T) => {
    try {
      await handler(ctx);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const baseContext = categorizeError(error);
      const context = { ...baseContext, ...options?.context };

      // Log the error
      logError(error, context, ctx as Interaction | Message);

      // Don't send user response if silent
      if (options?.silent) return;

      // Use fallback if provided
      if (options?.fallback) {
        try {
          await options.fallback(ctx, error);
          return;
        } catch (fallbackError) {
          logger.error("Fallback handler also failed:", fallbackError);
        }
      }

      // Send error response
      await sendErrorResponse(ctx, error, context);
    }
  };
}

// Specialized error handlers for different contexts
export function commandErrorHandler<
  T extends ChatInputCommandInteraction | Message
>(handler: (ctx: T) => Promise<any> | any, commandName?: string) {
  return errorHandler(handler, {
    context: (error?: Error) => {
      if (error && error.name === "PermissionDenied") {
        return {
          type: ErrorType.PERMISSION,
          severity: ErrorSeverity.LOW,
          metadata: { commandName },
        };
      }
      return {
        type: ErrorType.COMMAND,
        severity: ErrorSeverity.MEDIUM,
        metadata: { commandName },
      };
    },
  });
}

export function eventErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<any> | any,
  eventName?: string
) {
  return async (...args: T) => {
    try {
      await handler(...args);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const context = {
        ...categorizeError(error),
        type: ErrorType.EVENT,
        severity: ErrorSeverity.HIGH,
        metadata: { eventName },
      };

      logError(error, context);

      // For events, we might want to log but not necessarily respond
      logger.error(`Event handler failed for ${eventName}:`, error);
    }
  };
}

export function serviceErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<any> | any,
  serviceName?: string
) {
  return async (...args: T) => {
    try {
      await handler(...args);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const context = {
        ...categorizeError(error),
        type: ErrorType.SERVICE,
        severity: ErrorSeverity.HIGH,
        metadata: { serviceName },
      };

      logError(error, context);

      // Services might need special handling
      logger.error(`Service error in ${serviceName}:`, error);
    }
  };
}

// Helper to create a pretty permission denied embed
export function createPermissionDeniedEmbed(user?: {
  tag?: string;
  id?: string;
}) {
  return new EmbedBuilder()
    .setTitle("🚫 Permission Denied")
    .setDescription(
      `Sorry, you don't have permission to use this command.` +
        (user ? `\n\nUser: **${user.tag || user.id || "Unknown"}**` : "")
    )
    .setColor(Colors.Red)
    .setFooter({
      text: "If you believe this is a mistake, contact the server admin or bot owner.",
    })
    .setTimestamp();
}

// Send error response to user
async function sendErrorResponse(
  ctx: ChatInputCommandInteraction | Message,
  error: Error,
  context: ErrorContext
) {
  const errorId = generateErrorId();
  const embed = createErrorEmbed(error, context, errorId);
  const actions = createErrorActions(errorId, context);

  try {
    // Use pretty embed for permission errors
    if (context.type === ErrorType.PERMISSION) {
      const embed = createPermissionDeniedEmbed(
        ctx instanceof Message
          ? { tag: ctx.author?.tag, id: ctx.author?.id }
          : ctx instanceof ChatInputCommandInteraction
          ? { tag: ctx.user?.tag, id: ctx.user?.id }
          : undefined
      );
      if (ctx instanceof ChatInputCommandInteraction) {
        if (ctx.replied || ctx.deferred) {
          await ctx.editReply({ embeds: [embed], components: [] });
        } else {
          await ctx.reply({ embeds: [embed], ephemeral: true });
        }
      } else if (ctx instanceof Message) {
        await ctx.reply({ embeds: [embed] });
      }
      return;
    }

    if (ctx instanceof ChatInputCommandInteraction) {
      if (ctx.deferred && !ctx.replied) {
        await ctx.editReply({
          embeds: [embed],
          components: [actions],
        });
      } else if (ctx.replied) {
        logger.warn(
          `Skipping user-facing error response for interaction ID ${ctx.id} ` +
            `because it's already replied and the command likely completed successfully. ` +
            `Error: ${error.message}`
        );
        return;
      } else {
        await ctx.reply({
          embeds: [embed],
          components: [actions],
          flags: MessageFlags.Ephemeral,
        });
      }
    } else if (ctx instanceof Message) {
      await ctx.reply({
        embeds: [embed],
        components: [actions],
      });
    }
  } catch (replyError) {
    logger.error(
      "Failed to send error response to user (outer catch):",
      replyError
    );
    // Fallback to simple text response if the embed/components reply failed
    try {
      if (ctx instanceof ChatInputCommandInteraction) {
        // Attempt a simple text editReply if already replied/deferred, else a simple reply
        if (ctx.replied || ctx.deferred) {
          await ctx.editReply({
            content: `❌ ${
              context.userFriendly ||
              "An error occurred. Please try again later."
            }`,
            components: [], // Clear components
          });
        } else {
          await ctx.reply({
            content: `❌ ${
              context.userFriendly ||
              "An error occurred. Please try again later."
            }`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } else if (ctx instanceof Message) {
        await ctx.reply({
          content: `❌ ${
            context.userFriendly || "An error occurred. Please try again later."
          }`,
        });
      }
    } catch (fallbackError) {
      logger.error("Even fallback error response failed:", fallbackError);
    }
  }
}

// Error analytics and reporting
export function getErrorStats() {
  const stats = {
    total: errorReports.length,
    byType: {} as Record<ErrorType, number>,
    bySeverity: {} as Record<ErrorSeverity, number>,
    recent: errorReports.filter(
      (r) => Date.now() - r.timestamp.getTime() < 3600000
    ).length, // Last hour
    critical: errorReports.filter((r) => r.severity === ErrorSeverity.CRITICAL)
      .length,
  };

  errorReports.forEach((report) => {
    stats.byType[report.type] = (stats.byType[report.type] || 0) + 1;
    stats.bySeverity[report.severity] =
      (stats.bySeverity[report.severity] || 0) + 1;
  });

  return stats;
}

// Clear old error reports
export function clearOldErrorReports(maxAge: number = 86400000) {
  // 24 hours default
  const cutoff = Date.now() - maxAge;
  const initialLength = errorReports.length;

  for (let i = errorReports.length - 1; i >= 0; i--) {
    if (errorReports[i].timestamp.getTime() < cutoff) {
      errorReports.splice(i, 1);
    }
  }

  const cleared = initialLength - errorReports.length;
  if (cleared > 0) {
    logger.info(`Cleared ${cleared} old error reports`);
  }
}

// Export types for use in other modules
export type { ErrorReport };
