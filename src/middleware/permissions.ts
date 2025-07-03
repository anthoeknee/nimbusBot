import { CommandInteraction, Message, PermissionFlagsBits } from "discord.js";

/**
 * Checks if the user has the required permissions.
 * @param requiredPerms Array of Discord permission strings.
 */
export function checkPermissions(requiredPerms: string[]) {
  return (interactionOrMessage: CommandInteraction | Message): boolean => {
    const member = interactionOrMessage.member;
    if (!member || !("permissions" in member)) {
      return false;
    }

    // Ensure permissions is a PermissionsBitField
    const permissions = member.permissions;
    if (typeof permissions === 'string' || !permissions.has) {
      return false;
    }

    // Convert string permissions to PermissionFlagsBits
    const permissionFlags = requiredPerms.map(perm => {
      // Handle both string names and PermissionFlagsBits
      if (typeof perm === 'string') {
        return PermissionFlagsBits[perm as keyof typeof PermissionFlagsBits];
      }
      return perm;
    }).filter(Boolean);

    return permissionFlags.every(flag => permissions.has(flag));
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