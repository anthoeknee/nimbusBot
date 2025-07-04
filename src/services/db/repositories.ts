// --- Combined Repositories ---

// BaseRepository
import { db, query, safeJsonParse, safeJsonStringify } from "./client";
import {
  EntityId,
  UserRow,
  CreateUserInput,
  UpdateUserInput,
  GuildRow,
  CreateGuildInput,
  UpdateGuildInput,
  SettingRow,
  CreateSettingInput,
  UpdateSettingInput,
  MemoryRow,
  CreateMemoryInput,
  UpdateMemoryInput,
  VectorSearchOptions,
  SimilarityResult,
} from "./types";

export abstract class BaseRepository<TModel, TCreateInput, TUpdateInput> {
  protected readonly db = db;
  protected abstract readonly tableName: string;

  protected getPreparedStatement(sql: string) {
    return this.db.prepare(sql);
  }

  async findById(id: EntityId): Promise<TModel | null> {
    try {
      const stmt = this.getPreparedStatement(
        `SELECT * FROM ${this.tableName} WHERE id = ?`
      );
      const result = stmt.get(id) as TModel | undefined;
      return result || null;
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by id: ${error}`);
    }
  }

  async findMany(where?: Record<string, any>): Promise<TModel[]> {
    const qb = query<TModel>(this.tableName);
    if (where) {
      Object.entries(where).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          qb.whereIn(key, value);
        } else {
          qb.where(key, value);
        }
      });
    }
    return await qb.findMany();
  }

  async create(data: TCreateInput): Promise<TModel> {
    try {
      const keys = Object.keys(data as object);
      const values = Object.values(data as object);
      const placeholders = keys.map(() => "?").join(", ");
      const query = `INSERT INTO ${this.tableName} (${keys.join(
        ", "
      )}) VALUES (${placeholders}) RETURNING *`;
      const stmt = this.getPreparedStatement(query);
      const result = stmt.get(...values) as TModel;
      return result;
    } catch (error) {
      throw new Error(`Failed to create ${this.tableName}: ${error}`);
    }
  }

  async createMany(data: TCreateInput[]): Promise<TModel[]> {
    if (!data || data.length === 0) return [];
    try {
      const keys = Object.keys(data[0] as object);
      const placeholders = keys.map(() => "?").join(", ");
      const query = `INSERT INTO ${this.tableName} (${keys.join(
        ", "
      )}) VALUES (${placeholders}) RETURNING *`;
      const insertStmt = this.getPreparedStatement(query);
      const insertManyTx = this.db.transaction((items) => {
        const results: TModel[] = [];
        for (const item of items) {
          const values = Object.values(item as object);
          results.push(insertStmt.get(...values) as TModel);
        }
        return results;
      });
      return insertManyTx(data);
    } catch (error) {
      throw new Error(`Failed to bulk create ${this.tableName}: ${error}`);
    }
  }

  async findWithPagination(
    page: number = 1,
    limit: number = 10,
    where?: Record<string, any>
  ): Promise<{
    data: TModel[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    const qb = query<TModel>(this.tableName);
    if (where) {
      Object.entries(where).forEach(([key, value]) => {
        qb.where(key, value);
      });
    }
    const [data, total] = await Promise.all([
      qb.limit(limit).offset(offset).findMany(),
      this.count(where),
    ]);
    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: EntityId, data: TUpdateInput): Promise<TModel> {
    try {
      const keys = Object.keys(data as object);
      const values = Object.values(data as object);
      const setClause = keys.map((key) => `${key} = ?`).join(", ");
      const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ? RETURNING *`;
      const stmt = this.db.prepare(query);
      const result = stmt.get(...values, id) as TModel;
      return result;
    } catch (error) {
      throw new Error(`Failed to update ${this.tableName}: ${error}`);
    }
  }

  async delete(id: EntityId): Promise<TModel> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE id = ? RETURNING *`;
      const stmt = this.db.prepare(query);
      const result = stmt.get(id) as TModel;
      return result;
    } catch (error) {
      throw new Error(`Failed to delete ${this.tableName}: ${error}`);
    }
  }

  async count(where?: Record<string, any>): Promise<number> {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];
      if (where && Object.keys(where).length > 0) {
        const conditions = Object.keys(where).map((key) => `${key} = ?`);
        query += ` WHERE ${conditions.join(" AND ")}`;
        params.push(...Object.values(where));
      }
      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      return result.count;
    } catch (error) {
      throw new Error(`Failed to count ${this.tableName}s: ${error}`);
    }
  }

  async exists(where: Record<string, any>): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  async createManyNoReturn(data: TCreateInput[]): Promise<void> {
    if (!data || data.length === 0) {
      return;
    }
    try {
      const keys = Object.keys(data[0] as object);
      const placeholders = keys.map(() => "?").join(", ");
      const query = `INSERT INTO ${this.tableName} (${keys.join(
        ", "
      )}) VALUES (${placeholders})`;
      const insertStmt = this.db.prepare(query);
      const insertManyTx = this.db.transaction((items) => {
        for (const item of items) {
          const values = Object.values(item as object);
          insertStmt.run(...values);
        }
      });
      insertManyTx(data);
    } catch (error) {
      throw new Error(
        `Failed to bulk create (no return) ${this.tableName}: ${error}`
      );
    }
  }
}

// UserRepository
export class UserRepository extends BaseRepository<
  UserRow,
  CreateUserInput,
  UpdateUserInput
> {
  protected readonly tableName = "users";
  async findByDiscordId(discordId: string): Promise<UserRow | null> {
    try {
      const stmt = this.db.prepare("SELECT * FROM users WHERE discordId = ?");
      const result = stmt.get(discordId) as UserRow | undefined;
      return result || null;
    } catch (error) {
      throw new Error(`Failed to find user by Discord ID: ${error}`);
    }
  }
  async findOrCreateByDiscordId(
    discordId: string,
    userData?: Partial<CreateUserInput>
  ): Promise<UserRow> {
    const existingUser = await this.findByDiscordId(discordId);
    if (existingUser) return existingUser;
    const createData: CreateUserInput = {
      discordId,
      username: userData?.username ?? "",
      displayName: userData?.displayName ?? "",
    };
    return await this.create(createData);
  }
  async updateByDiscordId(
    discordId: string,
    data: UpdateUserInput
  ): Promise<UserRow> {
    try {
      const keys = Object.keys(data as object);
      const values = Object.values(data as object);
      const setClause = keys.map((key) => `${key} = ?`).join(", ");
      const query = `UPDATE users SET ${setClause} WHERE discordId = ? RETURNING *`;
      const stmt = this.db.prepare(query);
      const result = stmt.get(...values, discordId) as UserRow;
      return result;
    } catch (error) {
      throw new Error(`Failed to update user by Discord ID: ${error}`);
    }
  }
}

// GuildRepository
export class GuildRepository extends BaseRepository<
  GuildRow,
  CreateGuildInput,
  UpdateGuildInput
> {
  protected readonly tableName = "guilds";
  async findByDiscordId(discordGuildId: string): Promise<GuildRow | null> {
    try {
      const stmt = this.db.prepare(
        "SELECT * FROM guilds WHERE discordGuildId = ?"
      );
      const result = stmt.get(discordGuildId) as GuildRow | undefined;
      return result || null;
    } catch (error) {
      throw new Error(`Failed to find guild by Discord ID: ${error}`);
    }
  }
  async findOrCreateByDiscordId(
    discordGuildId: string,
    guildData?: Partial<CreateGuildInput>
  ): Promise<GuildRow> {
    const existingGuild = await this.findByDiscordId(discordGuildId);
    if (existingGuild) return existingGuild;
    const createData: CreateGuildInput = {
      discordGuildId,
      name: guildData?.name ?? "",
      iconUrl: guildData?.iconUrl,
    };
    return await this.create(createData);
  }
  async updateByDiscordId(
    discordGuildId: string,
    data: UpdateGuildInput
  ): Promise<GuildRow> {
    try {
      const keys = Object.keys(data as object);
      const values = Object.values(data as object);
      const setClause = keys.map((key) => `${key} = ?`).join(", ");
      const query = `UPDATE guilds SET ${setClause} WHERE discordGuildId = ? RETURNING *`;
      const stmt = this.db.prepare(query);
      const result = stmt.get(...values, discordGuildId) as GuildRow;
      return result;
    } catch (error) {
      throw new Error(`Failed to update guild by Discord ID: ${error}`);
    }
  }
}

// SettingRepository
export class SettingRepository extends BaseRepository<
  SettingRow,
  CreateSettingInput,
  UpdateSettingInput
> {
  protected readonly tableName = "settings";
  async findByUser(userId: EntityId): Promise<SettingRow[]> {
    return await this.findMany({ userId });
  }
  async findByGuild(guildId: EntityId): Promise<SettingRow[]> {
    return await this.findMany({ guildId });
  }
  async findByKey(
    key: string,
    userId?: EntityId,
    guildId?: EntityId
  ): Promise<SettingRow | null> {
    try {
      let query = "SELECT * FROM settings WHERE key = ?";
      const params: any[] = [key];
      if (userId) {
        query += " AND userId = ?";
        params.push(userId);
      } else if (guildId) {
        query += " AND guildId = ?";
        params.push(guildId);
      }
      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as SettingRow | undefined;
      return result || null;
    } catch (error) {
      throw new Error(`Failed to find setting by key: ${error}`);
    }
  }
  async setSetting(
    key: string,
    value: any,
    userId?: EntityId,
    guildId?: EntityId
  ): Promise<SettingRow> {
    const existingSetting = await this.findByKey(key, userId, guildId);
    if (existingSetting) {
      return await this.update(existingSetting.id, {
        value: safeJsonStringify(value),
      });
    } else {
      const createData: CreateSettingInput = {
        targetType: userId ? "user" : "guild",
        userId,
        guildId,
        key,
        value: safeJsonStringify(value),
      };
      return await this.create(createData);
    }
  }
  async deleteBySetting(
    key: string,
    userId?: EntityId,
    guildId?: EntityId
  ): Promise<SettingRow | null> {
    const setting = await this.findByKey(key, userId, guildId);
    if (!setting) return null;
    return await this.delete(setting.id);
  }
  async create(data: CreateSettingInput): Promise<SettingRow> {
    const serializedData = {
      ...data,
      value: safeJsonStringify(data.value),
    };
    return await super.create(serializedData);
  }
  async createMany(data: CreateSettingInput[]): Promise<SettingRow[]> {
    const serializedData = data.map((item) => ({
      ...item,
      value: safeJsonStringify(item.value),
    }));
    return await super.createMany(serializedData);
  }
  async getSettingValue<T = any>(
    key: string,
    userId?: EntityId,
    guildId?: EntityId
  ): Promise<T | null> {
    const setting = await this.findByKey(key, userId, guildId);
    if (!setting) return null;
    return safeJsonParse<T>(setting.value);
  }
}

// MemoryRepository
export class MemoryRepository extends BaseRepository<
  MemoryRow,
  CreateMemoryInput,
  UpdateMemoryInput
> {
  protected readonly tableName = "memories";
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
      let query = "SELECT * FROM memories";
      const params: any[] = [];
      const conditions: string[] = [];
      if (userId) {
        conditions.push("userId = ?");
        params.push(userId);
      }
      if (guildId) {
        conditions.push("guildId = ?");
        params.push(guildId);
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }
      const stmt = this.db.prepare(query);
      const memories = stmt.all(...params) as MemoryRow[];
      const scored = memories
        .map((memory) => {
          const memoryEmbedding = safeJsonParse<number[]>(memory.embedding);
          if (!memoryEmbedding) return null;
          return {
            data: memory,
            similarity: this.calculateCosineSimilarity(
              embedding,
              memoryEmbedding
            ),
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
      throw new Error("Embedding vectors must have the same length");
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
  async create(data: CreateMemoryInput): Promise<MemoryRow> {
    const serializedData = {
      ...data,
      embedding: safeJsonStringify(data.embedding),
    } as any;
    return await super.create(serializedData);
  }
  async update(id: EntityId, data: UpdateMemoryInput): Promise<MemoryRow> {
    const serializedData = {
      ...data,
      ...(data.embedding && { embedding: safeJsonStringify(data.embedding) }),
    } as any;
    return await super.update(id, serializedData);
  }
  async createMany(data: CreateMemoryInput[]): Promise<MemoryRow[]> {
    const serializedData = data.map((item) => ({
      ...item,
      embedding: safeJsonStringify(item.embedding),
    })) as any[];
    return await super.createMany(serializedData);
  }
}
