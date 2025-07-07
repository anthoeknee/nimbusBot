// src/utils/loader.ts
import { readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { Command } from "../types/command";
import { Event } from "../types/event";
import { logger } from "./logger";
import {
  applyCommandPipeline,
  applyEventPipeline,
  errorHandler,
  executionLock,
  permissions as permissionsMiddleware,
} from "../middleware/commandPipeline";

/**
 * Recursively walks a directory and returns all TypeScript/JavaScript files
 * Skips helper directories and non-module files
 */
function getFiles(dir: string, skipHelpers: boolean = false): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip helper directories when loading events/commands
        if (skipHelpers && (entry === "helpers" || entry === "utils")) {
          continue;
        }
        files.push(...getFiles(fullPath, skipHelpers));
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if ((ext === ".ts" || ext === ".js") && !entry.endsWith(".d.ts")) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    logger.warn(`Failed to read directory ${dir}:`, error);
  }

  return files;
}

/**
 * Load all commands from the commands directory
 */
export async function loadCommands(): Promise<Map<string, Command>> {
  const commands = new Map<string, Command>();
  const commandsDir = join(import.meta.dir, "../commands");
  const files = getFiles(commandsDir, true);

  for (const file of files) {
    try {
      const module = await import(file);
      const command = module.default || module.command;

      if (command && command.meta && command.data && command.execute) {
        // --- Build pipeline ---
        const pipeline = [
          errorHandler(),
          executionLock((ctx) =>
            ctx.isInteraction
              ? `int_${ctx.raw.id}`
              : ctx.isMessage
                ? `msg_${ctx.raw.id}`
                : `cmd_${command.meta.name}`
          ),
        ];
        if (command.meta.permissions && command.meta.permissions.length > 0) {
          pipeline.push(permissionsMiddleware(command.meta.permissions));
        }
        commands.set(
          command.meta.name,
          applyCommandPipeline(command, pipeline)
        );
        logger.debug(`Loaded command: ${command.meta.name}`);
      } else {
        logger.warn(
          `Invalid command module at ${file}: missing required properties`
        );
      }
    } catch (error) {
      logger.error(`Failed to load command from ${file}:`, error);
    }
  }

  logger.info(`Loaded ${commands.size} commands`);
  return commands;
}

/**
 * Load all events from the events directory
 */
export async function loadEvents(): Promise<Event<any>[]> {
  const events: Event<any>[] = [];
  const eventsDir = join(import.meta.dir, "../events");
  const files = getFiles(eventsDir, true);

  for (const file of files) {
    try {
      const module = await import(file);
      const event = module.default || module.event;

      if (event && event.name && event.execute) {
        // --- Build pipeline ---
        const pipeline = [
          errorHandler(),
          executionLock((ctx) =>
            ctx.isInteraction
              ? `int_${ctx.raw.id}`
              : ctx.isMessage
                ? `msg_${ctx.raw.id}`
                : `evt_${event.name}`
          ),
        ];
        events.push(applyEventPipeline(event, pipeline));
        logger.debug(`Loaded event: ${event.name}`);
      } else {
        logger.warn(
          `Invalid event module at ${file}: missing required properties`
        );
      }
    } catch (error) {
      logger.error(`Failed to load event from ${file}:`, error);
    }
  }

  logger.info(`Loaded ${events.length} events`);
  return events;
}
