import { CommandInteraction, Message } from "discord.js";

/**
 * Checks if the user has the required permissions.
 * @param requiredPerms Array of Discord permission strings.
 */
export function checkPermissions(requiredPerms: string[]) {
  return (interactionOrMessage: CommandInteraction | Message): boolean => {
    const member = interactionOrMessage.member;
    if (
      !member ||
      !("permissions" in member) ||
      typeof member.permissions !== "object" ||
      member.permissions === null ||
      typeof (member.permissions as any).has !== "function"
    ) {
      return false;
    }
    return requiredPerms.every(perm => (member.permissions as any).has(perm));
  };
}
 /*
 * Middleware to enforce permissions on commands.
 * Usage: permissions(["Administrator"])(interaction) -> boolean
 */
export function permissions(requiredPerms: string[]) {
  return (interactionOrMessage: CommandInteraction | Message, onFail?: (reason: string) => void): boolean => {
    if (!checkPermissions(requiredPerms)(interactionOrMessage)) {
      if (onFail) onFail("You do not have permission to use this command.");
      return false;
    }
    return true;
  };
}