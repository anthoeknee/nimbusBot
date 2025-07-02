import { Memory, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { EntityId, VectorSearchOptions, SimilarityResult } from '../types';

export class MemoryRepository extends BaseRepository<Memory, Prisma.MemoryCreateInput, Prisma.MemoryUpdateInput> {
  protected readonly modelName = Prisma.ModelName.Memory;

  async findByUser(userId: EntityId): Promise<Memory[]> {
    return await this.findMany({ userId });
  }

  async findByGuild(guildId: EntityId): Promise<Memory[]> {
    return await this.findMany({ guildId });
  }

  async findSimilar(
    embedding: number[],
    options: VectorSearchOptions = {}
  ): Promise<SimilarityResult<Memory>[]> {
    const { userId, guildId, topK = 5 } = options;

    const where: any = {};
    if (userId) where.userId = userId;
    if (guildId) where.guildId = guildId;

    try {
      const memories = await this.findMany(where);

      const scored = memories
        .map(memory => ({
          data: memory,
          similarity: this.calculateCosineSimilarity(embedding, memory.embedding as number[]),
        }))
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
    guildId?: EntityId,
    metadata?: any
  ): Promise<Memory> {
    return await this.create({
      content,
      embedding,
      ...(userId && { user: { connect: { id: userId } } }),
      ...(guildId && { guild: { connect: { id: guildId } } }),
      ...(metadata && { metadata }),
    });
  }
}