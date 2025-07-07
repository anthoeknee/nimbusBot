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
