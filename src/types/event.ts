// Event handler type definitions for Discord bot

import { ClientEvents } from "discord.js";

export type ModuleType = "single" | "multi" | "auto";

// Event structure for dynamic loading and registration
export interface Event<T extends keyof ClientEvents> {
  name: T;
  once?: boolean;
  moduleType?: ModuleType;
  execute: (...args: ClientEvents[T]) => void | Promise<void>;
}
