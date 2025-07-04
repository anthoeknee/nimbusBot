import { UserRepository, GuildRepository, SettingRepository, MemoryRepository } from './repositories';
import { initializeDatabase } from './client';

export class DatabaseService {
  public readonly users: UserRepository;
  public readonly guilds: GuildRepository;
  public readonly settings: SettingRepository;
  public readonly memories: MemoryRepository;

  constructor() {
    this.users = new UserRepository();
    this.guilds = new GuildRepository();
    this.settings = new SettingRepository();
    this.memories = new MemoryRepository();
  }

  // Initialize database on first use
  initialize(): void {
    initializeDatabase();
  }

  // Add convenience methods for common operations
  async getUserOrCreate(discordId: string, userData?: any) {
    return await this.users.findOrCreateByDiscordId(discordId, userData);
  }

  async getGuildOrCreate(discordGuildId: string, guildData?: any) {
    return await this.guilds.findOrCreateByDiscordId(discordGuildId, guildData);
  }

  async getSetting(key: string, userId?: number, guildId?: number) {
    return await this.settings.getSettingValue(key, userId, guildId);
  }

  async setSetting(key: string, value: any, userId?: number, guildId?: number) {
    return await this.settings.setSetting(key, value, userId, guildId);
  }

  // Add transaction support for complex operations
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const { db } = await import('./client');
    return db.transaction(fn)();
  }

  // Add health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.users.count();
      return true;
    } catch {
      return false;
    }
  }

  // Legacy compatibility methods
  get db() {
    return {
      // User methods
      getUserById: (id: number) => this.users.findById(id),
      getUserByDiscordId: (discordId: string) => this.users.findByDiscordId(discordId),
      createUser: (data: any) => this.users.create(data),
      updateUser: (id: number, data: any) => this.users.update(id, data),
      deleteUser: (id: number) => this.users.delete(id),

      // Guild methods
      getGuildById: (id: number) => this.guilds.findById(id),
      getGuildByDiscordId: (discordGuildId: string) => this.guilds.findByDiscordId(discordGuildId),
      createGuild: (data: any) => this.guilds.create(data),
      updateGuild: (id: number, data: any) => this.guilds.update(id, data),
      deleteGuild: (id: number) => this.guilds.delete(id),

      // Setting methods
      getSettingsForUser: (userId: number) => this.settings.findByUser(userId),
      getSettingsForGuild: (guildId: number) => this.settings.findByGuild(guildId),
      setSetting: (data: any) => this.settings.create(data),
      updateSetting: (id: number, data: any) => this.settings.update(id, data),
      deleteSetting: (id: number) => this.settings.delete(id),

      // Memory methods
      getMemoriesForUser: (userId: number) => this.memories.findByUser(userId),
      getMemoriesForGuild: (guildId: number) => this.memories.findByGuild(guildId),
      createMemory: (data: any) => this.memories.create(data),
      updateMemory: (id: number, data: any) => this.memories.update(id, data),
      deleteMemory: (id: number) => this.memories.delete(id),
      findSimilarMemories: (embedding: number[], options: any) => this.memories.findSimilar(embedding, options),
    };
  }
}

// Export singleton instance
export const database = new DatabaseService();

// Export individual repositories for direct access
export const { users, guilds, settings, memories } = database;

// Export types
export * from './types';
export * from './repositories';

// Default export for convenience
export default database;