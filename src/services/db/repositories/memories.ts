import { db } from "../client";

export type Memory = {
  id: number;
  userId?: number | null;
  guildId?: number | null;
  content: string;
  embedding: string; // stored as JSON string
};

export function getMemoryById(id: number): Memory | undefined {
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
}): Memory | undefined {
  return db
    .query(
      "INSERT INTO memories (userId, guildId, content, embedding) VALUES (?, ?, ?, ?) RETURNING *"
    )
    .get(userId ?? null, guildId ?? null, content, JSON.stringify(embedding));
}

export function getMemories({
  userId,
  guildId,
}: { userId?: number; guildId?: number } = {}): Memory[] {
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
