// src/events/ready.ts
import { Event } from "../types/event";
import { Client } from "discord.js";

// Event handler for the Discord client's ready event
const event: Event<"ready"> = {
  name: "ready",
  once: true,
  execute: async (client: Client) => {
    console.log(`Logged in as ${client.user?.tag}!`);
  },
};

export default event;
