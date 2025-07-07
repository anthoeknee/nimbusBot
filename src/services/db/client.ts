import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdir } from "fs/promises";
import { readFile } from "fs/promises";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "bot.db");
const SCHEMA_PATH = join(import.meta.dir, "./schema.sql");

let db: Database;

export async function initDb() {
  await mkdir(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);

  // Run schema if tables don't exist
  const tables = db
    .query("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  if (tables.length === 0) {
    const schema = await readFile(SCHEMA_PATH, "utf8");
    db.exec(schema);
  }
}

export { db };
