// Event handler type definitions for Discord bot

import { ClientEvents } from "discord.js";

// Generic event handler signature
type EventHandler<T = any> = (event: T, client: any) => Promise<void>;

// Example: Message event handler
type MessageEventHandler = EventHandler<any>; // Replace 'any' with your Discord message type

// Example: Ready event handler
type ReadyEventHandler = EventHandler<void>;

// Event structure for dynamic loading and registration
export interface Event<T extends keyof ClientEvents> {
    name: T;
    once?: boolean;
    execute: (...args: ClientEvents[T]) => void;
}

export type { EventHandler, MessageEventHandler, ReadyEventHandler };