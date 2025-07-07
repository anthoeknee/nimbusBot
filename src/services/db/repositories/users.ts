import type { Database } from "bun:sqlite";
import { db } from "../client";

export type User = {
  id: number;
  discordId: string;
  username: string;
  displayName: string;
};

export function getUserById(id: number): User | undefined {
  return db.query("SELECT * FROM users WHERE id = ?").get(id);
}

export function getUserByDiscordId(discordId: string): User | undefined {
  return db.query("SELECT * FROM users WHERE discordId = ?").get(discordId);
}

export function createUser({
  discordId,
  username,
  displayName,
}: {
  discordId: string;
  username: string;
  displayName: string;
}): User | undefined {
  return db
    .query(
      "INSERT INTO users (discordId, username, displayName) VALUES (?, ?, ?) RETURNING *"
    )
    .get(discordId, username, displayName);
}

export function updateUser(
  id: number,
  { username, displayName }: { username: string; displayName: string }
): User | undefined {
  return db
    .query(
      "UPDATE users SET username = ?, displayName = ? WHERE id = ? RETURNING *"
    )
    .get(username, displayName, id);
}

export function deleteUser(id: number): User | undefined {
  return db.query("DELETE FROM users WHERE id = ? RETURNING *").get(id);
}
