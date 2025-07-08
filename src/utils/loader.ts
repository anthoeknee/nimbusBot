// src/utils/loader.ts
import { opendir } from "fs/promises";
import { join } from "path";
import { Command } from "../types/command";
import type { Event } from "../types/event";
import type { Service } from "../types/service";
import type { ClientEvents } from "discord.js";
import { logger } from "./logger";

// Recursively walk a directory, yielding .js/.ts files (excluding .d.ts)
export async function* walk(dir: string): AsyncGenerator<string> {
  const dirHandle = await opendir(dir);
  for await (const entry of dirHandle) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) &&
      !entry.name.endsWith(".d.ts")
    ) {
      yield path;
    }
  }
}

// Generic module loader with error safety and only default export support
async function loadModules<T>(dir: string): Promise<T[]> {
  const modules: T[] = [];
  const fullPath = join(import.meta.dir, dir);
  for await (const file of walk(fullPath)) {
    try {
      const mod = await import(file);
      const exported = mod.default;
      if (!exported) continue;
      modules.push(exported);
    } catch (err) {
      logger.warn(`Failed to load module at ${file}:`, err);
      continue;
    }
  }
  return modules;
}

export async function loadCommands(): Promise<Map<string, Command>> {
  const commands = new Map<string, Command>();
  const commandModules = await loadModules<Command>("../commands");
  for (const command of commandModules) {
    if (!command || !command.meta) {
      logger.warn("Invalid command module:", command);
      continue;
    }
    commands.set(command.meta.name, command);
  }
  return commands;
}

export async function loadEvents(): Promise<Event<keyof ClientEvents>[]> {
  return loadModules<Event<keyof ClientEvents>>("../events");
}

export async function loadServices(): Promise<Map<string, Service>> {
  const services = new Map<string, Service>();
  const serviceModules = await loadModules<Service>("../services");
  for (const service of serviceModules) {
    if (service.initialize) {
      try {
        await service.initialize();
      } catch (err) {
        logger.warn(`Failed to initialize service ${service.name}:`, err);
        continue;
      }
    }
    services.set(service.name, service);
  }
  return services;
}
