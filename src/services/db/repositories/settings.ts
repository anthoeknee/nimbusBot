import { db } from "../client";

export type Setting = {
  id: number;
  targetType: "user" | "guild";
  userId?: number | null;
  guildId?: number | null;
  key: string;
  value: string;
};

export function getSetting(
  key: string,
  { userId, guildId }: { userId?: number; guildId?: number }
): Setting | undefined {
  let query = "SELECT * FROM settings WHERE key = ?";
  const params = [key];
  if (userId) {
    query += " AND userId = ?";
    params.push(userId);
  } else if (guildId) {
    query += " AND guildId = ?";
    params.push(guildId);
  }
  return db.query(query).get(...params);
}

export function setSetting(
  key: string,
  value: any,
  { userId, guildId }: { userId?: number; guildId?: number }
): Setting | undefined {
  const existing = getSetting(key, { userId, guildId });
  const valueStr = JSON.stringify(value);
  if (existing) {
    return db
      .query("UPDATE settings SET value = ? WHERE id = ? RETURNING *")
      .get(valueStr, existing.id);
  } else {
    return db
      .query(
        "INSERT INTO settings (targetType, userId, guildId, key, value) VALUES (?, ?, ?, ?, ?) RETURNING *"
      )
      .get(
        userId ? "user" : "guild",
        userId ?? null,
        guildId ?? null,
        key,
        valueStr
      );
  }
}

export function deleteSetting(
  key: string,
  { userId, guildId }: { userId?: number; guildId?: number }
): Setting | undefined | null {
  const existing = getSetting(key, { userId, guildId });
  if (!existing) return null;
  return db
    .query("DELETE FROM settings WHERE id = ? RETURNING *")
    .get(existing.id);
}

/**
 * Returns a fluent API for guild-scoped settings.
 */
export function forGuild(guildId: number) {
  return {
    /**
     * Get a setting value for a guild, type-safe.
     */
    get: <T>(key: string): T | null => {
      const row = getSetting(key, { guildId });
      return row ? (JSON.parse(row.value) as T) : null;
    },
    /**
     * Set a setting value for a guild.
     */
    set: <T>(key: string, value: T) => setSetting(key, value, { guildId }),
    /**
     * Delete a setting for a guild.
     */
    delete: (key: string) => deleteSetting(key, { guildId }),
  };
}

/**
 * Returns a fluent API for user-scoped settings.
 */
export function forUser(userId: number) {
  return {
    /**
     * Get a setting value for a user, type-safe.
     */
    get: <T>(key: string): T | null => {
      const row = getSetting(key, { userId });
      return row ? (JSON.parse(row.value) as T) : null;
    },
    /**
     * Set a setting value for a user.
     */
    set: <T>(key: string, value: T) => setSetting(key, value, { userId }),
    /**
     * Delete a setting for a user.
     */
    delete: (key: string) => deleteSetting(key, { userId }),
  };
}

export const settings = {
  get: getSetting,
  set: setSetting,
  delete: deleteSetting,
};
