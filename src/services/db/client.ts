import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdir } from "fs/promises";

let db!: Database;
let isInitialized = false;

declare global {
  var __db: Database | undefined;
}

async function ensureDataDirectory(): Promise<void> {
  const dataDir = join(process.cwd(), "data");
  try {
    await mkdir(dataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
}

async function initializeDatabase(): Promise<void> {
  if (isInitialized) return;

  try {
    await ensureDataDirectory();

    if (process.env.NODE_ENV === "production") {
      db = new Database(join(process.cwd(), "data", "bot.db"));
    } else {
      if (!global.__db) {
        global.__db = new Database(join(process.cwd(), "data", "bot.db"));
      }
      db = global.__db;
    }

    const schema = Bun.file(join(import.meta.dir, "schema.sql"));
    const schemaText = await schema.text();
    db.exec(schemaText);

    // Set PRAGMAs for performance and concurrency
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA busy_timeout = 5000;");

    console.log("Database initialized successfully");
    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

// Initialize immediately
await initializeDatabase();

// Helper function to safely parse JSON
export function safeJsonParse<T>(jsonString: string | null): T | null {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
}

// Helper function to safely stringify JSON
export function safeJsonStringify<T>(value: T): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(null);
  }
}

// Add Bun's SQL template literal support for better query building
export function sql(strings: TemplateStringsArray, ...values: any[]) {
  return { strings, values };
}

// Enhanced query builder using Bun's SQL features
export function buildQuery(
  template: ReturnType<typeof sql>,
  params: any[] = []
) {
  let query = template.strings[0];
  for (let i = 0; i < template.values.length; i++) {
    query += "?" + template.strings[i + 1];
  }
  return { query, params: [...template.values, ...params] };
}

// Add connection pooling and performance optimizations
export function optimizeDatabase() {
  // Enable WAL mode for better concurrency
  db.exec("PRAGMA journal_mode = WAL;");

  // Optimize for read-heavy workloads
  db.exec("PRAGMA synchronous = NORMAL;");

  // Increase cache size for better performance
  db.exec("PRAGMA cache_size = -64000;"); // 64MB cache

  // Enable memory-mapped I/O
  db.exec("PRAGMA mmap_size = 268435456;"); // 256MB

  // Optimize for bulk operations
  db.exec("PRAGMA temp_store = MEMORY;");

  // Set busy timeout
  db.exec("PRAGMA busy_timeout = 5000;");
}

// Call this after initialization
optimizeDatabase();

// --- Query Builder (migrated from query-builder.ts) ---

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
    const placeholders = values.map(() => "?").join(", ");
    this.conditions.push(`${field} IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  orderBy(field: string, direction: "ASC" | "DESC" = "ASC"): this {
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
    const query = this.buildQuery("SELECT *");
    const stmt = db.prepare(query);
    const result = stmt.get(...this.params) as T | undefined;
    return result || null;
  }

  async findMany(): Promise<T[]> {
    const query = this.buildQuery("SELECT *");
    const stmt = db.prepare(query);
    return stmt.all(...this.params) as T[];
  }

  private buildQuery(selectClause: string): string {
    let query = `${selectClause} FROM ${this.tableName}`;

    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(" AND ")}`;
    }

    if (this.orderByClauses.length > 0) {
      query += ` ORDER BY ${this.orderByClauses.join(", ")}`;
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

export { db, initializeDatabase };
export default db;
