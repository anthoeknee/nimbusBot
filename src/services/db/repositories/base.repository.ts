import { db } from '../client';
import { EntityId } from '../types';

export abstract class BaseRepository<TModel, TCreateInput, TUpdateInput> {
  protected readonly db = db;
  protected abstract readonly tableName: string;

  async findById(id: EntityId): Promise<TModel | null> {
    try {
      const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
      const result = stmt.get(id) as TModel | undefined;
      return result || null;
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by id: ${error}`);
    }
  }

  async findMany(where?: Record<string, any>): Promise<TModel[]> {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      if (where && Object.keys(where).length > 0) {
        const conditions = Object.keys(where).map(key => `${key} = ?`);
        query += ` WHERE ${conditions.join(' AND ')}`;
        params.push(...Object.values(where));
      }

      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as TModel[];
      return results;
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName}s: ${error}`);
    }
  }

  async create(data: TCreateInput): Promise<TModel> {
    try {
      const keys = Object.keys(data as object);
      const values = Object.values(data as object);
      const placeholders = keys.map(() => '?').join(', ');
      
      const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const stmt = this.db.prepare(query);
      const result = stmt.get(...values) as TModel;
      
      return result;
    } catch (error) {
      throw new Error(`Failed to create ${this.tableName}: ${error}`);
    }
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
}