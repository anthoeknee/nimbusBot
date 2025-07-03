// src/types/client.ts
import { Client, Collection } from "discord.js";
import { Command } from "./command";

export interface MyCustomClient extends Client {
  commands: Collection<string, Command>;
}