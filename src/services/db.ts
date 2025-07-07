import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdir } from "fs/promises";
import { readFile } from "fs/promises";

// --- DB INIT ---

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "bot.db");
const SCHEMA_PATH = join(import.meta.dir, "db/schema.sql");

let db: Database;

export async function initDb() {
  await mkdir(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);

  // Run schema if tables don't exist
  const tables = db
    .query("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  if (tables.length === 0) {
    const schema = await readFile(SCHEMA_PATH, "utf8");
    db.exec(schema);
  }
}

// --- USERS ---

export function getUserById(id: number) {
  return db.query("SELECT * FROM users WHERE id = ?").get(id);
}

export function getUserByDiscordId(discordId: string) {
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
}) {
  return db
    .query(
      "INSERT INTO users (discordId, username, displayName) VALUES (?, ?, ?) RETURNING *"
    )
    .get(discordId, username, displayName);
}

export function updateUser(
  id: number,
  { username, displayName }: { username: string; displayName: string }
) {
  return db
    .query(
      "UPDATE users SET username = ?, displayName = ? WHERE id = ? RETURNING *"
    )
    .get(username, displayName, id);
}

export function deleteUser(id: number) {
  return db.query("DELETE FROM users WHERE id = ? RETURNING *").get(id);
}

// --- GUILDS ---

export function getGuildById(id: number) {
  return db.query("SELECT * FROM guilds WHERE id = ?").get(id);
}

export function getGuildByDiscordId(discordGuildId: string) {
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
}) {
  return db
    .query(
      "INSERT INTO guilds (discordGuildId, name, iconUrl) VALUES (?, ?, ?) RETURNING *"
    )
    .get(discordGuildId, name, iconUrl ?? null);
}

export function updateGuild(
  id: number,
  { name, iconUrl }: { name: string; iconUrl?: string }
) {
  return db
    .query("UPDATE guilds SET name = ?, iconUrl = ? WHERE id = ? RETURNING *")
    .get(name, iconUrl ?? null, id);
}

export function deleteGuild(id: number) {
  return db.query("DELETE FROM guilds WHERE id = ? RETURNING *").get(id);
}

// --- SETTINGS ---

export function getSetting(
  key: string,
  { userId, guildId }: { userId?: number; guildId?: number }
) {
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
) {
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
) {
  const existing = getSetting(key, { userId, guildId });
  if (!existing) return null;
  return db
    .query("DELETE FROM settings WHERE id = ? RETURNING *")
    .get(existing.id);
}

// --- MEMORIES ---

export function getMemoryById(id: number) {
  return db.query("SELECT * FROM memories WHERE id = ?").get(id);
}

export function createMemory({
  userId,
  guildId,
  content,
  embedding,
}: {
  userId?: number;
  guildId?: number;
  content: string;
  embedding: number[];
}) {
  return db
    .query(
      "INSERT INTO memories (userId, guildId, content, embedding) VALUES (?, ?, ?, ?) RETURNING *"
    )
    .get(userId ?? null, guildId ?? null, content, JSON.stringify(embedding));
}

export function getMemories({
  userId,
  guildId,
}: { userId?: number; guildId?: number } = {}) {
  let query = "SELECT * FROM memories";
  const params = [];
  if (userId) {
    query += " WHERE userId = ?";
    params.push(userId);
  } else if (guildId) {
    query += " WHERE guildId = ?";
    params.push(guildId);
  }
  return db.query(query).all(...params);
}

// --- VECTOR SEARCH (cosine similarity in JS) ---

export function findSimilarMemories(
  embedding: number[],
  {
    userId,
    guildId,
    topK = 5,
  }: { userId?: number; guildId?: number; topK?: number } = {}
) {
  const candidates = getMemories({ userId, guildId });
  const scored = candidates
    .map((row) => {
      const emb = JSON.parse(row.embedding);
      return { ...row, similarity: cosineSimilarity(embedding, emb) };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  return scored;
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

// --- EXPORT DB FOR RAW ACCESS IF NEEDED ---
export { db };

export const settings = {
  get: getSetting,
  set: setSetting,
  delete: deleteSetting,
};

export const database = {
  initDb,
  getUserById,
  getUserByDiscordId,
  createUser,
  updateUser,
  deleteUser,
  getGuildById,
  getGuildByDiscordId,
  createGuild,
  updateGuild,
  deleteGuild,
  getSetting,
  setSetting,
  deleteSetting,
  getMemoryById,
  createMemory,
  getMemories,
  // ...add all other exported functions here
};
