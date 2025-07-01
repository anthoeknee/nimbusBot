import { logger } from "../utils/logger";
import { CommandInteraction, Message } from "discord.js";

/**
 * Wraps a handler in a try/catch and logs errors.
 * Usage: errorHandler(async (interaction) => { ... })(interaction)
 */
export function errorHandler<T extends CommandInteraction | Message>(
  handler: (ctx: T) => Promise<any> | any
) {
  return async (ctx: T) => {
    try {
      await handler(ctx);
    } catch (err) {
      logger.error("Handler error:", err);
      if ("reply" in ctx && typeof ctx.reply === "function") {
        try {
          await ctx.reply({ content: "An error occurred. Please try again later.", ephemeral: true });
        } catch {}
      }
    }
  };
}