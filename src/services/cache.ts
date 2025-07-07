import { Service } from "../types/service";
import { logger } from "../utils/logger";
import { users as userRepo } from "./db";

/**
 * Interface for a single entry in the store.
 */
interface StoreEntry<T> {
  value: T;
  expiresAt: number | null;
}

interface StoreStats {
  totalEntries: number;
  expiredEntries: number;
  totalMemoryUsage: number;
  cleanupRuns: number;
  lastCleanup: number;
}

interface MemoryStoreConfig {
  cleanupInterval?: number;
  maxEntries?: number;
  enableStats?: boolean;
  enableDetailedMemoryStats?: boolean;
}

export class MemoryStore implements Service {
  public readonly name = "MemoryStore";
  public readonly moduleType: "single" = "single";

  private store = new Map<string, StoreEntry<any>>();
  private cleanupInterval: Timer | null = null;
  private stats: StoreStats = {
    totalEntries: 0,
    expiredEntries: 0,
    totalMemoryUsage: 0,
    cleanupRuns: 0,
    lastCleanup: 0,
  };

  private readonly config: Required<MemoryStoreConfig>;

  constructor(config?: MemoryStoreConfig) {
    this.config = {
      cleanupInterval: config?.cleanupInterval ?? 60000,
      maxEntries: config?.maxEntries ?? 10000,
      enableStats: config?.enableStats ?? true,
      enableDetailedMemoryStats: config?.enableDetailedMemoryStats ?? false,
    };
    logger.debug(
      `MemoryStore initialized with config: ${JSON.stringify(this.config)}`
    );
  }

  async initialize(): Promise<void> {
    logger.info(`Initializing ${this.name} service`);
    this.startCleanupProcess();
    logger.info(`${this.name} service initialized successfully`);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    if (!key || typeof key !== "string") {
      throw new Error("Key must be a non-empty string");
    }
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.config.maxEntries) {
      this.evictOldestEntry();
    }
    const now = Date.now();
    const expiresAt = ttlSeconds ? now + ttlSeconds * 1000 : null;
    const entry: StoreEntry<T> = { value, expiresAt };
    this.store.set(key, entry);
    if (this.config.enableStats) {
      this.stats.totalEntries = this.store.size;
    }
    logger.debug(
      `Stored key "${key}" with TTL: ${ttlSeconds ? `${ttlSeconds}s` : "no expiration"}`
    );
  }

  setBulk<T>(entries: Array<[string, T, number?]>): void {
    const uniqueNewKeys = new Set(
      entries.map(([key]) => key).filter((key) => !this.store.has(key))
    );
    const spaceNeeded = uniqueNewKeys.size;
    const currentSize = this.store.size;
    const overflow = currentSize + spaceNeeded - this.config.maxEntries;
    if (overflow > 0) {
      this.evictMultipleEntries(overflow);
    }
    const now = Date.now();
    for (const [key, value, ttlSeconds] of entries) {
      if (!key || typeof key !== "string") continue;
      if (this.store.has(key)) {
        this.store.delete(key);
      }
      const expiresAt = ttlSeconds ? now + ttlSeconds * 1000 : null;
      const entry: StoreEntry<T> = { value, expiresAt };
      this.store.set(key, entry);
    }
    if (this.config.enableStats) {
      this.stats.totalEntries = this.store.size;
    }
    logger.debug(`Bulk stored ${entries.length} entries`);
  }

  get<T>(key: string): T | undefined {
    if (!key || typeof key !== "string") {
      return undefined;
    }
    const entry = this.store.get(key) as StoreEntry<T> | undefined;
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      if (this.config.enableStats) {
        this.stats.expiredEntries++;
        this.stats.totalEntries = this.store.size;
      }
      logger.debug(`Key "${key}" has expired and was removed`);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  getBulk<T>(keys: string[]): Map<string, T | undefined> {
    const results = new Map<string, T | undefined>();
    const now = Date.now();
    const keysToDelete: string[] = [];
    const entriesToUpdate: Array<[string, StoreEntry<T>]> = [];
    for (const key of keys) {
      const entry = this.store.get(key) as StoreEntry<T> | undefined;
      if (!entry) {
        results.set(key, undefined);
        continue;
      }
      if (entry.expiresAt && now > entry.expiresAt) {
        keysToDelete.push(key);
        results.set(key, undefined);
      } else {
        results.set(key, entry.value);
        entriesToUpdate.push([key, entry]);
      }
    }
    if (keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        this.store.delete(key);
      }
      if (this.config.enableStats) {
        this.stats.expiredEntries += keysToDelete.length;
      }
    }
    if (entriesToUpdate.length > 0) {
      for (const [key, entry] of entriesToUpdate) {
        this.store.delete(key);
        this.store.set(key, entry);
      }
    }
    if (this.config.enableStats) {
      this.stats.totalEntries = this.store.size;
    }
    return results;
  }

  has(key: string): boolean {
    if (!key || typeof key !== "string") {
      return false;
    }
    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      if (this.config.enableStats) {
        this.stats.expiredEntries++;
        this.stats.totalEntries = this.store.size;
      }
      return false;
    }
    return true;
  }

  hasBulk(keys: string[]): Map<string, boolean> {
    const results = new Map<string, boolean>();
    const now = Date.now();
    const keysToDelete: string[] = [];
    for (const key of keys) {
      if (!key || typeof key !== "string") {
        results.set(key, false);
        continue;
      }
      const entry = this.store.get(key);
      if (!entry) {
        results.set(key, false);
        continue;
      }
      if (entry.expiresAt && now > entry.expiresAt) {
        keysToDelete.push(key);
        results.set(key, false);
      } else {
        results.set(key, true);
      }
    }
    if (keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        this.store.delete(key);
      }
      if (this.config.enableStats) {
        this.stats.expiredEntries += keysToDelete.length;
        this.stats.totalEntries = this.store.size;
      }
    }
    return results;
  }

  delete(key: string): boolean {
    if (!key || typeof key !== "string") {
      return false;
    }
    const wasDeleted = this.store.delete(key);
    if (wasDeleted) {
      if (this.config.enableStats) {
        this.stats.totalEntries = this.store.size;
      }
      logger.debug(`Deleted key "${key}"`);
    }
    return wasDeleted;
  }

  deleteBulk(keys: string[]): number {
    let deletedCount = 0;
    for (const key of keys) {
      if (key && typeof key === "string" && this.store.delete(key)) {
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      if (this.config.enableStats) {
        this.stats.totalEntries = this.store.size;
      }
      logger.debug(`Bulk deleted ${deletedCount} entries`);
    }
    return deletedCount;
  }

  clear(): void {
    const size = this.store.size;
    this.store.clear();
    if (this.config.enableStats) {
      this.resetStats();
    }
    logger.info(`Cleared all ${size} entries from memory store`);
  }

  size(): number {
    return this.store.size;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  values<T>(): T[] {
    const values: T[] = [];
    const now = Date.now();
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (!entry.expiresAt || now <= entry.expiresAt) {
        values.push(entry.value);
      } else {
        keysToDelete.push(key);
      }
    }
    if (keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        this.store.delete(key);
      }
      if (this.config.enableStats) {
        this.stats.expiredEntries += keysToDelete.length;
        this.stats.totalEntries = this.store.size;
      }
    }
    return values;
  }

  entries<T>(): Array<[string, T]> {
    const entries: Array<[string, T]> = [];
    const now = Date.now();
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (!entry.expiresAt || now <= entry.expiresAt) {
        entries.push([key, entry.value]);
      } else {
        keysToDelete.push(key);
      }
    }
    if (keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        this.store.delete(key);
      }
      if (this.config.enableStats) {
        this.stats.expiredEntries += keysToDelete.length;
        this.stats.totalEntries = this.store.size;
      }
    }
    return entries;
  }

  getStats(): StoreStats {
    if (this.config.enableDetailedMemoryStats) {
      this.updateDetailedStats();
    }
    return { ...this.stats };
  }

  cleanupExpiredEntries(): number {
    const now = Date.now();
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.store.delete(key);
    }
    const cleanedCount = keysToDelete.length;
    if (cleanedCount > 0) {
      if (this.config.enableStats) {
        this.stats.cleanupRuns++;
        this.stats.lastCleanup = now;
        this.stats.expiredEntries += cleanedCount;
        this.stats.totalEntries = this.store.size;
      }
      logger.debug(`Cleanup removed ${cleanedCount} expired entries`);
    }
    return cleanedCount;
  }

  private startCleanupProcess(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
    logger.debug(
      `Started background cleanup process (interval: ${this.config.cleanupInterval}ms)`
    );
  }

  stopCleanupProcess(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.debug("Stopped background cleanup process");
    }
  }

  private evictMultipleEntries(count: number): void {
    if (count <= 0) return;
    const keysIterator = this.store.keys();
    const keysToDelete = [];
    for (let i = 0; i < count; i++) {
      const next = keysIterator.next();
      if (next.done) break;
      keysToDelete.push(next.value);
    }
    for (const key of keysToDelete) {
      this.store.delete(key);
    }
    logger.debug(
      `Evicted ${keysToDelete.length} oldest entries due to capacity limit`
    );
  }

  private evictOldestEntry(): void {
    const oldestKey = this.store.keys().next().value;
    if (oldestKey) {
      this.store.delete(oldestKey);
      logger.debug(
        `Evicted oldest entry: "${oldestKey}" due to capacity limit`
      );
    }
  }

  private updateDetailedStats(): void {
    let totalSize = 0;
    for (const [key, entry] of this.store.entries()) {
      totalSize += key.length;
      totalSize += this.estimateSize(entry.value);
    }
    this.stats.totalMemoryUsage = totalSize;
  }

  private estimateSize(value: any): number {
    if (value === null || value === undefined) return 4;
    switch (typeof value) {
      case "string":
        return value.length * 2;
      case "number":
        return 8;
      case "boolean":
        return 4;
      case "object":
        if (Array.isArray(value)) {
          return value.reduce((sum, item) => sum + this.estimateSize(item), 16);
        }
        return Object.keys(value).reduce(
          (sum, key) => sum + key.length * 2 + this.estimateSize(value[key]),
          32
        );
      default:
        return 50;
    }
  }

  private resetStats(): void {
    this.stats = {
      totalEntries: 0,
      expiredEntries: 0,
      totalMemoryUsage: 0,
      cleanupRuns: this.stats.cleanupRuns,
      lastCleanup: this.stats.lastCleanup,
    };
  }

  async shutdown(): Promise<void> {
    this.stopCleanupProcess();
    this.clear();
    logger.info(`${this.name} service shutdown complete`);
  }
}

// Export a default instance with default configuration for convenience
export const memoryStore = new MemoryStore();

// User cache logic (previously in userCache.ts)
export const userCache = {
  async getOrFetch(discordId: string) {
    let user = memoryStore.get(`user:${discordId}`);
    if (!user) {
      user = await userRepo.findByDiscordId(discordId);
      if (user) memoryStore.set(`user:${discordId}`, user, 3600);
    }
    return user;
  },
  async setAndPersist(discordId: string, userData: any) {
    memoryStore.set(`user:${discordId}`, userData, 3600);
    return userRepo.updateByDiscordId(discordId, userData);
  },
  async deleteEverywhere(discordId: string) {
    memoryStore.delete(`user:${discordId}`);
    // Optionally delete from DB as well
    // await userRepo.deleteByDiscordId(discordId);
  },
  // ... more methods as needed
};
