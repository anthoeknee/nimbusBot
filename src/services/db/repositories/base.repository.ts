import { db } from '../client';
import { EntityId } from '../types';
import { query } from '../query-builder';

export abstract class BaseRepository<TModel, TCreateInput, TUpdateInput> {
  protected readonly db = db;
  protected abstract readonly tableName: string;

  // Use Bun's prepared statements more efficiently
  protected getPreparedStatement(sql: string) {
    return this.db.prepare(sql);
  }

  // Enhanced findById with better error handling
  async findById(id: EntityId): Promise<TModel | null> {
    try {
      const stmt = this.getPreparedStatement(`SELECT * FROM ${this.tableName} WHERE id = ?`);
      const result = stmt.get(id) as TModel | undefined;
      return result || null;
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by id: ${error}`);
    }
  }

  // Use the new query builder
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

  // Enhanced create with better validation
  async create(data: TCreateInput): Promise<TModel> {
    try {
      const keys = Object.keys(data as object);
      const values = Object.values(data as object);
      const placeholders = keys.map(() => '?').join(', ');
      
      const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const stmt = this.getPreparedStatement(query);
      const result = stmt.get(...values) as TModel;
      
      return result;
    } catch (error) {
      throw new Error(`Failed to create ${this.tableName}: ${error}`);
    }
  }

  // Enhanced bulk operations using Bun's transactions
  async createMany(data: TCreateInput[]): Promise<TModel[]> {
    if (!data || data.length === 0) return [];

    try {
      const keys = Object.keys(data[0] as object);
      const placeholders = keys.map(() => '?').join(', ');
      const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      
      const insertStmt = this.getPreparedStatement(query);

      // Use Bun's transaction for better performance
      const insertManyTx = this.db.transaction(items => {
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

  // Add pagination support
  async findWithPagination(
    page: number = 1, 
    limit: number = 10, 
    where?: Record<string, any>
  ): Promise<{ data: TModel[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    const qb = query<TModel>(this.tableName);
    
    if (where) {
      Object.entries(where).forEach(([key, value]) => {
        qb.where(key, value);
      });
    }
    
    const [data, total] = await Promise.all([
      qb.limit(limit).offset(offset).findMany(),
      this.count(where)
    ]);
    
    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async update(id: EntityId, data: TUpdateInput): Promise<TModel> {
    try {
      const keys = Object.keys(data as object);
      const values = Object.values(data as object);
      const setClause = keys.map(key => `${key} = ?`).join(', ');
      
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
        const conditions = Object.keys(where).map(key => `${key} = ?`);
        query += ` WHERE ${conditions.join(' AND ')}`;
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
      const placeholders = keys.map(() => '?').join(', ');
      const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
      
      const insertStmt = this.db.prepare(query);

      const insertManyTx = this.db.transaction(items => {
        for (const item of items) {
          const values = Object.values(item as object);
          insertStmt.run(...values);
        }
      });

      insertManyTx(data);
    } catch (error) {
      throw new Error(`Failed to bulk create (no return) ${this.tableName}: ${error}`);
    }
  }
}