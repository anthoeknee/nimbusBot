import { Message, Client, ClientEvents } from "discord.js";
import { Event } from "../types/event";
import { Command } from "../types/command";

const PREFIX = "g$";

const event: Event<"messageCreate"> = {
  name: "messageCreate",
  async execute(message: Message) {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check for prefix
    if (!message.content.startsWith(PREFIX)) return;

    // Extract command name and arguments
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    // Access the commands map attached to the client
    // @ts-ignore
    const commands: Map<string, Command> = message.client.commands;
    const command = commands?.get(commandName);
    if (!command) return;

    try {
      // You may want to pass a context object or just the message and args
      // Here, we call the run method with the client and a custom context
      await command.run(message.client as Client, {
        message,
        args,
        client: message.client
      });
    } catch (err) {
      console.error(`Error executing command ${commandName}:`, err);
      await message.reply("There was an error executing that command.");
    }
  }
};

export default event;