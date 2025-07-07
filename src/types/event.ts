import { ClientEvents } from "discord.js";

export interface Event<T extends keyof ClientEvents = keyof ClientEvents> {
  name: T;
  once?: boolean;
  execute: (...args: ClientEvents[T]) => void | Promise<void>;
}
