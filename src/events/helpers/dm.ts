import { User } from "discord.js";

/**
 * Safely send a DM to a user, catching and ignoring errors (e.g., DMs disabled).
 * @param user The Discord user to DM
 * @param content The message content
 */
export async function sendDM(user: User, content: string): Promise<void> {
  try {
    await user.send(content);
  } catch {
    // Ignore errors (user may have DMs disabled, etc.)
  }
}
