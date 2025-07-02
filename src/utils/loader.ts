// src/utils/loader.ts
import { opendir } from "fs/promises";
import { join } from "path";
import { Command } from "../types/command";
import type { Event } from "../types/event";
import type { Service } from "../types/service";
import type { ClientEvents } from "discord.js";

// Async generator for walking directories (returns .js/.ts files, skips .d.ts)
export async function* walk(dir: string): AsyncGenerator<string> {
  const dirHandle = await opendir(dir);
  for await (const entry of dirHandle) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
      !entry.name.endsWith('.d.ts')
    ) {
      yield path;
    }
  }
}

// Generic module loader
async function loadModules<T>(dir: string): Promise<T[]> {
  const modules: T[] = [];
  const fullPath = join(import.meta.dir, dir);
  for await (const file of walk(fullPath)) {
    const mod = await import(file);
    modules.push(mod.default as T);
  }
  return modules;
}

export async function loadCommands(): Promise<Map<string, Command>> {
  const commands = new Map<string, Command>();
  const commandModules = await loadModules<Command>("../commands");
  for (const command of commandModules) {
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
            await service.initialize();
        }
        services.set(service.name, service);
    }
    return services;
}
