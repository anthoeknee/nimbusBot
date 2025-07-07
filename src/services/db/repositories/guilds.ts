import { db } from "../client";

export type Guild = {
  id: number;
  discordGuildId: string;
  name: string;
  iconUrl?: string | null;
};

export function getGuildById(id: number): Guild | undefined {
  return db.query("SELECT * FROM guilds WHERE id = ?").get(id);
}

export function getGuildByDiscordId(discordGuildId: string): Guild | undefined {
  return db
    .query("SELECT * FROM guilds WHERE discordGuildId = ?")
    .get(discordGuildId);
}

export function createGuild({
  discordGuildId,
  name,
  iconUrl,
}: {
  discordGuildId: string;
  name: string;
  iconUrl?: string;
}): Guild | undefined {
  return db
    .query(
      "INSERT INTO guilds (discordGuildId, name, iconUrl) VALUES (?, ?, ?) RETURNING *"
    )
    .get(discordGuildId, name, iconUrl ?? null);
}

export function updateGuild(
  id: number,
  { name, iconUrl }: { name: string; iconUrl?: string }
): Guild | undefined {
  return db
    .query("UPDATE guilds SET name = ?, iconUrl = ? WHERE id = ? RETURNING *")
    .get(name, iconUrl ?? null, id);
}

export function deleteGuild(id: number): Guild | undefined {
  return db.query("DELETE FROM guilds WHERE id = ? RETURNING *").get(id);
}
