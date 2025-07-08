import { db } from "../client";
import { serializeEmbedding, deserializeEmbedding } from "../embeddingUtils";

export type Memory = {
  id: number;
  userId?: number | null;
  guildId?: number | null;
  content: string;
  embedding: number[];
};

/**
 * Create a new memory row with a vector embedding.
 */
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
  const row = db
    .query(
      "INSERT INTO memories (userId, guildId, content, embedding) VALUES (?, ?, ?, ?) RETURNING *"
    )
    .get(
      userId ?? null,
      guildId ?? null,
      content,
      serializeEmbedding(embedding)
    );
  return row && { ...row, embedding: deserializeEmbedding(row.embedding) };
}

/**
 * Get all memories for a user or guild, with deserialized embeddings.
 */
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
  return db
    .query(query)
    .all(...params)
    .map((row) => ({
      ...row,
      embedding: deserializeEmbedding(row.embedding),
    }));
}

/**
 * Find the most similar memories to a given embedding.
 */
export function findSimilarMemories(
  embedding: number[],
  {
    userId,
    guildId,
    topK = 5,
  }: { userId?: number; guildId?: number; topK?: number } = {}
): (Memory & { similarity: number })[] {
  const candidates = getMemories({ userId, guildId });
  const scored = candidates
    .map((row) => ({
      ...row,
      similarity: cosineSimilarity(embedding, row.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  return scored;
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}
