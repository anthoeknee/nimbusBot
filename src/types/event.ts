import { ClientEvents } from "discord.js";

/**
 * Event handler interface for Discord.js events
 */
export interface Event<T extends keyof ClientEvents = keyof ClientEvents> {
  name: T;
  once?: boolean;
  execute: (...args: ClientEvents[T]) => void | Promise<void>;
}
