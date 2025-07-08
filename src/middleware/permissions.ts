import { CommandInteraction, PermissionFlagsBits } from "discord.js";

/**
 * Checks if the user has the required permissions.
 * @param requiredPerms Array of Discord permission strings.
 */
export function checkPermissions(requiredPerms: string[]) {
  return (interaction: CommandInteraction): boolean => {
    const member = interaction.member;
    if (!member || !("permissions" in member)) {
      return false;
    }
    const permissions = member.permissions;
    if (typeof permissions === "string" || !permissions.has) {
      return false;
    }
    const permissionFlags = requiredPerms
      .map((perm) => {
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
    interaction: CommandInteraction,
    onFail?: (reason: string) => void
  ): boolean => {
    if (!checkPermissions(requiredPerms)(interaction)) {
      if (onFail) onFail("You do not have permission to use this command.");
      return false;
    }
    return true;
  };
}
