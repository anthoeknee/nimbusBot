// src/middleware/commandPipeline.ts
import type {
  ChatInputCommandInteraction,
  Message,
  Client,
  Guild,
  GuildMember,
  User,
} from "discord.js";
import type { Command } from "../types/command";
import type { Event } from "../types/event";
import { withExecutionLock } from "../events/helpers/executionLock";
import { commandErrorHandler, eventErrorHandler } from "./errorHandler";

// --- Normalized Command Context ---
export type CommandContext = {
  raw: ChatInputCommandInteraction | Message;
  client: Client;
  user: User;
  member?: GuildMember;
  guild?: Guild | null;
  channelId: string;
  isInteraction: boolean;
  isMessage: boolean;
  args?: string[];
  command?: Command;
  event?: Event<any>;
  [key: string]: any;
};

// --- Middleware Types ---
export type CommandMiddleware = (
  ctx: CommandContext,
  next: () => Promise<void>
) => Promise<void>;

export type MiddlewarePipeline = CommandMiddleware[];

// --- Context Normalizer ---
export function normalizeContext(
  raw: ChatInputCommandInteraction | Message,
  extra: Partial<CommandContext> = {}
): CommandContext {
  const isInteraction =
    "isChatInputCommand" in raw &&
    typeof raw.isChatInputCommand === "function" &&
    raw.isChatInputCommand();
  const isMessage = !isInteraction;
  const user = isInteraction
    ? (raw as ChatInputCommandInteraction).user
    : (raw as Message).author;
  const member = isInteraction
    ? ((raw as ChatInputCommandInteraction).member as GuildMember)
    : ((raw as Message).member as GuildMember);
  const guild = isInteraction
    ? (raw as ChatInputCommandInteraction).guild
    : (raw as Message).guild;
  const channelId = isInteraction
    ? (raw as ChatInputCommandInteraction).channelId
    : (raw as Message).channelId;
  const client = raw.client;
  return {
    raw,
    client,
    user,
    member,
    guild,
    channelId,
    isInteraction,
    isMessage,
    ...extra,
  };
}

function checkPermissions(
  requiredPerms: string[],
  ctx: CommandContext
): boolean {
  // Owner bypass
  const userId = ctx.user?.id;
  if (
    userId &&
    ctx.client &&
    ctx.client["config"]?.ownerId &&
    userId === ctx.client["config"].ownerId
  ) {
    return true;
  }
  const member = ctx.member;
  if (!member || !("permissions" in member)) return false;
  const permissions = member.permissions;
  if (typeof permissions === "string" || !permissions.has) return false;
  const { PermissionFlagsBits } = require("discord.js");
  const permissionFlags = requiredPerms
    .map(
      (perm) => PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits]
    )
    .filter(Boolean);
  return permissionFlags.every((flag) => permissions.has(flag));
}

export function permissions(required: string[]): CommandMiddleware {
  return async (ctx, next) => {
    if (!checkPermissions(required, ctx)) {
      const error = new Error(
        "You do not have permission to use this command."
      );
      error.name = "PermissionDenied";
      throw error;
    }
    await next();
  };
}

export function executionLock(
  getKey: (ctx: CommandContext) => string
): CommandMiddleware {
  return async (ctx, next) => {
    const key = getKey(ctx);
    await withExecutionLock(key, next);
  };
}

export function errorHandler(): CommandMiddleware {
  return async (ctx, next) => {
    // Use the existing error handler for both command and event
    if (ctx.command) {
      await commandErrorHandler(next, ctx.command.meta.name)(ctx.raw);
    } else if (ctx.event) {
      await eventErrorHandler(next, ctx.event.name)(ctx.raw);
    } else {
      try {
        await next();
      } catch (err) {
        // Fallback: just throw
        throw err;
      }
    }
  };
}

// --- Pipeline Runner ---
export function composePipeline(
  middleware: MiddlewarePipeline
): CommandMiddleware {
  return async (ctx, next) => {
    let idx = -1;
    async function dispatch(i: number): Promise<void> {
      if (i <= idx) throw new Error("next() called multiple times");
      idx = i;
      const fn = middleware[i] || next;
      if (!fn) return;
      await fn(ctx, () => dispatch(i + 1));
    }
    await dispatch(0);
  };
}

export async function runPipeline(
  pipeline: MiddlewarePipeline,
  ctx: CommandContext,
  final: () => Promise<void>
) {
  const composed = composePipeline(pipeline);
  await composed(ctx, final);
}

// --- Helpers to apply pipeline to commands/events ---
export function applyCommandPipeline(
  command: Command,
  pipeline: MiddlewarePipeline
): Command {
  return {
    ...command,
    execute: async (raw, context) => {
      const ctx = normalizeContext(raw, { command, args: context?.args });
      await runPipeline(pipeline, ctx, async () => {
        await command.execute(raw, context);
      });
    },
  };
}

export function applyEventPipeline(
  event: Event<any>,
  pipeline: MiddlewarePipeline
): Event<any> {
  return {
    ...event,
    execute: async (...args: any[]) => {
      // Only normalize if first arg is Message or Interaction
      const raw = args[0];
      const ctx = normalizeContext(raw, { event });
      await runPipeline(pipeline, ctx, async () => {
        await event.execute(...args);
      });
    },
  };
}
