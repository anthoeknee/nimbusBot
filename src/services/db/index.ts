import db from "./client";
// Import repositories from consolidated exports (repositories are now in separate files)
import {
  UserRepository,
  GuildRepository,
  SettingRepository,
  EnhancedMemoryRepository,
} from "./repositories";

// Create repository instances
export const users = new UserRepository();
export const guilds = new GuildRepository();
export const settings = new SettingRepository();
export const memories = new EnhancedMemoryRepository();

// Export database client
export { db };

// Export types
export * from "./types";
export * from "../../types/memory";
export * from "./repositories";

// Simple database object for backward compatibility
export const database = {
  users,
  guilds,
  settings,
  memories,
  db,

  // Initialize database connection
  initialize() {
    // Database is initialized automatically in client.ts
    console.log("Database repositories initialized");
  },

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await users.count();
      return true;
    } catch {
      return false;
    }
  },
};

// Default export
export default database;
