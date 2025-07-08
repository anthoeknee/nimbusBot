// src/events/ready.ts
import { Event } from "../types/event";
import { Client } from "discord.js";

const event: Event<"ready"> = {
  name: "ready",
  once: true,
  execute: async (client: Client) => {
    console.log(`Logged in as ${client.user?.tag}!`);
  },
};

export default event;
