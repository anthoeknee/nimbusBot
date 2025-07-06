import { CommandInteraction, Message, PermissionFlagsBits } from "discord.js";
import { config } from "../config";

/**
 * Checks if the user has the required permissions.
 * @param requiredPerms Array of Discord permission strings.
 */
export function checkPermissions(requiredPerms: string[]) {
  return (interactionOrMessage: CommandInteraction | Message): boolean => {
    // --- Owner bypass ---
    let userId: string | undefined;
    if ("user" in interactionOrMessage && interactionOrMessage.user) {
      userId = interactionOrMessage.user.id;
    } else if (
      "author" in interactionOrMessage &&
      interactionOrMessage.author
    ) {
      userId = interactionOrMessage.author.id;
    }
    if (userId && config.ownerId && userId === config.ownerId) {
      return true;
    }

    const member = interactionOrMessage.member;
    if (!member || !("permissions" in member)) {
      return false;
    }

    // Ensure permissions is a PermissionsBitField
    const permissions = member.permissions;
    if (typeof permissions === "string" || !permissions.has) {
      return false;
    }

    // Convert string permissions to PermissionFlagsBits
    const permissionFlags = requiredPerms
      .map((perm) => {
        // Handle both string names and PermissionFlagsBits
        if (typeof perm === "string") {
          return PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits];
        }
        return perm;
      })
      .filter(Boolean);

    return permissionFlags.every((flag) => permissions.has(flag));
  };
}

/*
 * Middleware to enforce permissions on commands.
 * Usage: permissions(["Administrator"])(interaction) -> boolean
 */
export function permissions(requiredPerms: string[]) {
  return (
    interactionOrMessage: CommandInteraction | Message,
    onFail?: (reason: string) => void
  ): boolean => {
    if (!checkPermissions(requiredPerms)(interactionOrMessage)) {
      const error = new Error(
        "You do not have permission to use this command."
      );
      error.name = "PermissionDenied";
      if (onFail) onFail(error.message);
      throw error;
    }
    return true;
  };
}
