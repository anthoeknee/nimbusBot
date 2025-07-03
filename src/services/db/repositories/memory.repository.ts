import { BaseRepository } from './base.repository';
import { 
  MemoryRow, 
  CreateMemoryInput, 
  UpdateMemoryInput, 
  EntityId, 
  VectorSearchOptions, 
  SimilarityResult 
} from '../types';
import { safeJsonParse, safeJsonStringify } from '../client';

export class MemoryRepository extends BaseRepository<MemoryRow, CreateMemoryInput, UpdateMemoryInput> {
  protected readonly tableName = 'memories';

  async findByUser(userId: EntityId): Promise<MemoryRow[]> {
    return await this.findMany({ userId });
  }

  async findByGuild(guildId: EntityId): Promise<MemoryRow[]> {
    return await this.findMany({ guildId });
  }

  async findSimilar(
    embedding: number[],
    options: VectorSearchOptions = {}
  ): Promise<SimilarityResult<MemoryRow>[]> {
    const { userId, guildId, topK = 5 } = options;

    try {
      let query = 'SELECT * FROM memories';
      const params: any[] = [];
      const conditions: string[] = [];

      if (userId) {
        conditions.push('userId = ?');
        params.push(userId);
      }
      if (guildId) {
        conditions.push('guildId = ?');
        params.push(guildId);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      const stmt = this.db.prepare(query);
      const memories = stmt.all(...params) as MemoryRow[];

      // Calculate cosine similarity for each memory
      const scored = memories
        .map(memory => {
          const memoryEmbedding = safeJsonParse<number[]>(memory.embedding);
          if (!memoryEmbedding) return null;
          
          return {
            data: memory,
            similarity: this.calculateCosineSimilarity(embedding, memoryEmbedding),
          };
        })
        .filter((item): item is SimilarityResult<MemoryRow> => item !== null)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      return scored;
    } catch (error) {
      throw new Error(`Failed to find similar memories: ${error}`);
    }
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embedding vectors must have the same length');
    }

    const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));

    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }

  async createWithEmbedding(
    content: string,
    embedding: number[],
    userId?: EntityId,
    guildId?: EntityId
  ): Promise<MemoryRow> {
    const createData: CreateMemoryInput = {
      content,
      embedding,
      userId,
      guildId,
    };
    return await this.create(createData);
  }

  // Override create to handle embedding serialization
  async create(data: CreateMemoryInput): Promise<MemoryRow> {
    const serializedData = {
      ...data,
      embedding: safeJsonStringify(data.embedding),
    } as any; // Type assertion to bypass type checking
    return await super.create(serializedData);
  }

  // Override update to handle embedding serialization
  async update(id: EntityId, data: UpdateMemoryInput): Promise<MemoryRow> {
    const serializedData = {
      ...data,
      ...(data.embedding && { embedding: safeJsonStringify(data.embedding) }),
    } as any; // Type assertion to bypass type checking
    return await super.update(id, serializedData);
  }
}