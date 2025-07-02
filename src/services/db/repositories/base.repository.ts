import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../client';
import { EntityId } from '../types';

export abstract class BaseRepository<TModel, TCreateInput, TUpdateInput> {
  protected readonly prisma: PrismaClient;
  protected abstract readonly modelName: Prisma.ModelName;

  constructor() {
    this.prisma = prisma;
  }

  protected get model() {
    return (this.prisma as any)[this.modelName.toLowerCase()];
  }

  async findById(id: EntityId): Promise<TModel | null> {
    try {
      return await this.model.findUnique({ where: { id } });
    } catch (error) {
      throw new Error(`Failed to find ${this.modelName} by id: ${error}`);
    }
  }

  async findMany(where?: any): Promise<TModel[]> {
    try {
      return await this.model.findMany({ where });
    } catch (error) {
      throw new Error(`Failed to find ${this.modelName}s: ${error}`);
    }
  }

  async create(data: TCreateInput): Promise<TModel> {
    try {
      return await this.model.create({ data });
    } catch (error) {
      throw new Error(`Failed to create ${this.modelName}: ${error}`);
    }
  }

  async update(id: EntityId, data: TUpdateInput): Promise<TModel> {
    try {
      return await this.model.update({ where: { id }, data });
    } catch (error) {
      throw new Error(`Failed to update ${this.modelName}: ${error}`);
    }
  }

  async delete(id: EntityId): Promise<TModel> {
    try {
      return await this.model.delete({ where: { id } });
    } catch (error) {
      throw new Error(`Failed to delete ${this.modelName}: ${error}`);
    }
  }

  async upsert(where: any, create: TCreateInput, update: TUpdateInput): Promise<TModel> {
    try {
      return await this.model.upsert({ where, create, update });
    } catch (error) {
      throw new Error(`Failed to upsert ${this.modelName}: ${error}`);
    }
  }

  async count(where?: any): Promise<number> {
    try {
      return await this.model.count({ where });
    } catch (error) {
      throw new Error(`Failed to count ${this.modelName}s: ${error}`);
    }
  }

  async exists(where: any): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }
}