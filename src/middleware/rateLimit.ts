import { CommandInteraction, Message } from "discord.js";

type RateLimitOptions = {
  windowMs: number; // ms
  max: number;      // max uses per window
  keyGenerator?: (ctx: CommandInteraction | Message) => string;
};

const rateLimitStore = new Map<string, { count: number; lastReset: number }>();

/**
 * Rate limit middleware for commands.
 * Usage: rateLimit({ windowMs: 5000, max: 2 })(interaction)
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyGenerator } = options;
  return (interactionOrMessage: CommandInteraction | Message, onFail?: (reason: string) => void): boolean => {
    const key = keyGenerator
      ? keyGenerator(interactionOrMessage)
      : (
          interactionOrMessage instanceof Message
            ? interactionOrMessage.author?.id
            : interactionOrMessage.member?.user.id
        );

    if (!key) return true; // fallback: allow if no user id

    const now = Date.now();
    const entry = rateLimitStore.get(key) || { count: 0, lastReset: now };

    if (now - entry.lastReset > windowMs) {
      entry.count = 0;
      entry.lastReset = now;
    }

    entry.count += 1;
    rateLimitStore.set(key, entry);

    if (entry.count > max) {
      if (onFail) onFail(`Rate limit exceeded. Try again in ${Math.ceil((windowMs - (now - entry.lastReset)) / 1000)}s.`);
      return false;
    }
    return true;
  };
}
