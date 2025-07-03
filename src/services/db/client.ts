import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdir } from 'fs/promises';

let db!: Database;
let isInitialized = false;

declare global {
  var __db: Database | undefined;
}

async function ensureDataDirectory(): Promise<void> {
  const dataDir = join(process.cwd(), 'data');
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
    
    if (process.env.NODE_ENV === 'production') {
      db = new Database(join(process.cwd(), 'data', 'bot.db'));
    } else {
      if (!global.__db) {
        global.__db = new Database(join(process.cwd(), 'data', 'bot.db'));
      }
      db = global.__db;
    }

    const schema = Bun.file(join(import.meta.dir, 'schema.sql'));
    const schemaText = await schema.text();
    db.exec(schemaText);
    console.log('Database initialized successfully');
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
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

export { db, initializeDatabase };
export default db;