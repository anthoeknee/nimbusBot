import { db } from './client';
import { sql } from './client';

export class QueryBuilder<T> {
  private tableName: string;
  private conditions: string[] = [];
  private params: any[] = [];
  private orderByClauses: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  where(field: string, value: any): this {
    this.conditions.push(`${field} = ?`);
    this.params.push(value);
    return this;
  }

  whereIn(field: string, values: any[]): this {
    const placeholders = values.map(() => '?').join(', ');
    this.conditions.push(`${field} IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClauses.push(`${field} ${direction}`);
    return this;
  }

  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  async findOne(): Promise<T | null> {
    const query = this.buildQuery('SELECT *');
    const stmt = db.prepare(query);
    const result = stmt.get(...this.params) as T | undefined;
    return result || null;
  }

  async findMany(): Promise<T[]> {
    const query = this.buildQuery('SELECT *');
    const stmt = db.prepare(query);
    return stmt.all(...this.params) as T[];
  }

  private buildQuery(selectClause: string): string {
    let query = `${selectClause} FROM ${this.tableName}`;
    
    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }
    
    if (this.orderByClauses.length > 0) {
      query += ` ORDER BY ${this.orderByClauses.join(', ')}`;
    }
    
    if (this.limitValue) {
      query += ` LIMIT ${this.limitValue}`;
    }
    
    if (this.offsetValue) {
      query += ` OFFSET ${this.offsetValue}`;
    }
    
    return query;
  }
}

// Convenience function
export function query<T>(tableName: string): QueryBuilder<T> {
  return new QueryBuilder<T>(tableName);
}