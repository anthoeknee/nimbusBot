// src/services/db/embeddingUtils.ts
export function serializeEmbedding(embedding: number[]): string {
  return JSON.stringify(embedding);
}

export function deserializeEmbedding(str: string): number[] {
  return JSON.parse(str);
}
