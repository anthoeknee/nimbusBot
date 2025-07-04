import { Service } from "../types/service";
import { logger } from "../utils/logger";

/**
 * Interface for a single entry in the store.
 * Simplified by removing `createdAt` and `lastAccessed` as per analysis,
 * since LRU logic relies on Map's insertion order, and these fields
 * are not explicitly used for any current functional requirements (e.g., LFU, specific debugging exports).
 */
interface StoreEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * Interface for the store's operational statistics.
 */
interface StoreStats {
  totalEntries: number;
  expiredEntries: number;
  totalMemoryUsage: number;
  cleanupRuns: number;
  lastCleanup: number;
}

/**
 * Configuration options for the MemoryStore.
 * Allows customization during instantiation.
 */
interface MemoryStoreConfig {
  cleanupInterval?: number;          // Interval for background cleanup in milliseconds (default: 60000ms)
  maxEntries?: number;               // Maximum number of entries the store can hold (default: 10000)
  enableStats?: boolean;             // Whether to track basic stats (default: true)
  enableDetailedMemoryStats?: boolean; // Whether to calculate detailed memory usage (expensive, default: false)
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
    lastCleanup: 0
  };

  // Configuration options, made accessible via a constructor
  private readonly config: Required<MemoryStoreConfig>;

  /**
   * Initializes the MemoryStore with optional configuration.
   * @param config Configuration options for the store.
   */
  constructor(config?: MemoryStoreConfig) {
    this.config = {
      cleanupInterval: config?.cleanupInterval ?? 60000,
      maxEntries: config?.maxEntries ?? 10000,
      enableStats: config?.enableStats ?? true,
      enableDetailedMemoryStats: config?.enableDetailedMemoryStats ?? false,
    };
    logger.debug(`MemoryStore initialized with config: ${JSON.stringify(this.config)}`);
  }

  async initialize(): Promise<void> {
    logger.info(`Initializing ${this.name} service`);
    this.startCleanupProcess();
    logger.info(`${this.name} service initialized successfully`);
  }

  /**
   * Sets a key-value pair in the store.
   * If the key already exists, it will be updated and moved to the end of the LRU order.
   * If the store is full, the least recently used entry will be evicted.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string');
    }

    // Maintain LRU order: If the key exists, delete it first to ensure
    // it's placed at the end of the Map's insertion order (most recently used).
    if (this.store.has(key)) {
        this.store.delete(key);
    }
    // If the store is at max capacity and we're adding a *new* key, evict the oldest.
    // This check is 'else if' because if the key already exists, we're replacing, not adding.
    else if (this.store.size >= this.config.maxEntries) { // Use config.maxEntries
        this.evictOldestEntry();
    }

    const now = Date.now();
    const expiresAt = ttlSeconds ? now + (ttlSeconds * 1000) : null;

    const entry: StoreEntry<T> = {
      value,
      expiresAt,
    };

    this.store.set(key, entry);
    // Update totalEntries stat explicitly as it's a direct reflection of map size
    if (this.config.enableStats) {
      this.stats.totalEntries = this.store.size;
    }
    
    logger.debug(`Stored key "${key}" with TTL: ${ttlSeconds ? `${ttlSeconds}s` : 'no expiration'}`);
  }

  /**
   * Sets multiple key-value pairs in the store.
   * Efficiently handles capacity limits and updates LRU order.
   */
  setBulk<T>(entries: Array<[string, T, number?]>): void {
    // Pre-calculate how many *new* keys will be added to determine eviction needs.
    const uniqueNewKeys = new Set(entries.map(([key]) => key).filter(key => !this.store.has(key)));
    const spaceNeeded = uniqueNewKeys.size;
    const currentSize = this.store.size;
    const overflow = (currentSize + spaceNeeded) - this.config.maxEntries; // Use config.maxEntries

    if (overflow > 0) {
      this.evictMultipleEntries(overflow);
    }
    
    const now = Date.now();
    for (const [key, value, ttlSeconds] of entries) {
      if (!key || typeof key !== 'string') continue;
      
      // If the key exists, delete it to ensure it's moved to the end on re-insertion.
      if (this.store.has(key)) {
        this.store.delete(key);
      }

      const expiresAt = ttlSeconds ? now + (ttlSeconds * 1000) : null;
      const entry: StoreEntry<T> = {
        value,
        expiresAt,
      };
      
      this.store.set(key, entry);
    }
    
    if (this.config.enableStats) {
      this.stats.totalEntries = this.store.size;
    }
    logger.debug(`Bulk stored ${entries.length} entries`);
  }

  /**
   * Gets a value by key. If the key is accessed, it's moved to the end of the LRU order.
   * Checks for and removes expired entries.
   */
  get<T>(key: string): T | undefined {
    if (!key || typeof key !== 'string') {
      return undefined;
    }

    const entry = this.store.get(key) as StoreEntry<T> | undefined;
    
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      if (this.config.enableStats) {
        this.stats.expiredEntries++;
        this.stats.totalEntries = this.store.size;
      }
      logger.debug(`Key "${key}" has expired and was removed`);
      return undefined;
    }

    // Maintain LRU order on access: delete and re-set the entry to move it to the end.
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value;
  }

  /**
   * Gets multiple values by keys. Moves accessed keys to the end of the LRU order.
   * Checks for and removes expired entries.
   */
  getBulk<T>(keys: string[]): Map<string, T | undefined> {
    const results = new Map<string, T | undefined>();
    const now = Date.now();
    const keysToDelete: string[] = [];
    // Collect entries to update for efficient LRU reordering.
    const entriesToUpdate: Array<[string, StoreEntry<T>]> = [];

    for (const key of keys) {
      const entry = this.store.get(key) as StoreEntry<T> | undefined;
      
      if (!entry) {
        results.set(key, undefined);
        continue;
      }

      // Check expiration
      if (entry.expiresAt && now > entry.expiresAt) {
        keysToDelete.push(key);
        results.set(key, undefined);
      } else {
        results.set(key, entry.value);
        entriesToUpdate.push([key, entry]); // Collect for LRU update
      }
    }

    // Batch delete expired entries
    if (keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        this.store.delete(key);
      }
      if (this.config.enableStats) {
        this.stats.expiredEntries += keysToDelete.length;
      }
    }

    // Apply all LRU updates in one go (delete then re-insert to move to end)
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

  /**
   * Checks if a key exists. Does NOT update LRU order.
   * Checks for and removes expired entries.
   */
  has(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    const entry = this.store.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
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

  /**
   * Checks if multiple keys exist. Does NOT update LRU order.
   * Checks for and removes expired entries.
   */
  hasBulk(keys: string[]): Map<string, boolean> {
    const results = new Map<string, boolean>();
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const key of keys) {
      if (!key || typeof key !== 'string') {
        results.set(key, false);
        continue;
      }

      const entry = this.store.get(key);
      if (!entry) {
        results.set(key, false);
        continue;
      }

      // Check expiration
      if (entry.expiresAt && now > entry.expiresAt) {
        keysToDelete.push(key);
        results.set(key, false);
      } else {
        results.set(key, true);
      }
    }

    // Batch delete expired entries
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

  /**
   * Deletes a key from the store.
   */
  delete(key: string): boolean {
    if (!key || typeof key !== 'string') {
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

  /**
   * Deletes multiple keys from the store.
   */
  deleteBulk(keys: string[]): number {
    let deletedCount = 0;
    
    for (const key of keys) {
      if (key && typeof key === 'string' && this.store.delete(key)) {
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

  /**
   * Clears all entries from the store.
   */
  clear(): void {
    const size = this.store.size;
    this.store.clear();
    if (this.config.enableStats) { // Only reset stats if enabled
      this.resetStats();
    }
    logger.info(`Cleared all ${size} entries from memory store`);
  }

  /**
   * Returns the current number of entries in the store.
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Returns an array of all keys in the store.
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Returns an array of all values in the store.
   * Removes expired entries found during iteration.
   */
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

    // Clean up expired entries found during iteration
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

  /**
   * Returns an array of [key, value] pairs in the store.
   * Removes expired entries found during iteration.
   */
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

    // Clean up expired entries found during iteration
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

  /**
   * Returns the current statistics of the store.
   * Detailed memory usage is only calculated if enableDetailedMemoryStats is true.
   */
  getStats(): StoreStats {
    if (this.config.enableDetailedMemoryStats) { // Use config property
      this.updateDetailedStats();
    }
    // Return a copy to prevent external modification of internal stats object
    return { ...this.stats }; 
  }

  /**
   * Performs cleanup of expired entries. This method is called periodically by the background process.
   * It iterates through the store and removes any entries that have expired.
   * Returns the number of entries cleaned up.
   */
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

  /**
   * Starts the background process to periodically clean up expired entries.
   */
  private startCleanupProcess(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval); // Use config property

    logger.debug(`Started background cleanup process (interval: ${this.config.cleanupInterval}ms)`);
  }

  /**
   * Stops the background cleanup process.
   */
  stopCleanupProcess(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.debug('Stopped background cleanup process');
    }
  }

  /**
   * Evicts multiple entries using the O(k) LRU strategy.
   * Leverages the Map's insertion order and simply takes the first `count` keys.
   */
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

    logger.debug(`Evicted ${keysToDelete.length} oldest entries due to capacity limit`);
  }

  /**
   * Evicts the single oldest entry in O(1) time.
   * Leverages the Map's iterator to get the first (oldest) key.
   */
  private evictOldestEntry(): void {
    const oldestKey = this.store.keys().next().value;
    if (oldestKey) {
      this.store.delete(oldestKey);
      logger.debug(`Evicted oldest entry: "${oldestKey}" due to capacity limit`);
    }
  }

  /**
   * Calculates detailed memory usage. This is an expensive O(N) operation
   * and should only be called when `enableDetailedMemoryStats` is true.
   */
  private updateDetailedStats(): void {
    let totalSize = 0;
    for (const [key, entry] of this.store.entries()) {
      totalSize += key.length; 
      totalSize += this.estimateSize(entry.value);
    }
    this.stats.totalMemoryUsage = totalSize;
  }

  /**
   * Fast size estimation of a value without JSON.stringify.
   * This is a rough estimate and can be improved for specific data types.
   */
  private estimateSize(value: any): number {
    if (value === null || value === undefined) return 4; 
    
    switch (typeof value) {
      case 'string': return value.length * 2; // UTF-16 encoding
      case 'number': return 8; // JavaScript numbers are 64-bit floats
      case 'boolean': return 4; 
      case 'object':
        if (Array.isArray(value)) {
          // Rough estimate: fixed overhead + size per element
          return value.reduce((sum, item) => sum + this.estimateSize(item), 16); 
        }
        // Rough estimate for object: fixed overhead + sum of property key/value sizes.
        return Object.keys(value).reduce((sum, key) => sum + key.length * 2 + this.estimateSize(value[key]), 32); 
      default: return 50; // Default size for other types like functions, symbols etc.
    }
  }

  /**
   * Resets the statistics, preserving `cleanupRuns` and `lastCleanup`.
   */
  private resetStats(): void {
    this.stats = {
      totalEntries: 0,
      expiredEntries: 0,
      totalMemoryUsage: 0,
      cleanupRuns: this.stats.cleanupRuns, // Preserve historical stats for long-running service
      lastCleanup: this.stats.lastCleanup
    };
  }

  /**
   * Shuts down the service, stopping the cleanup process and clearing the store.
   */
  async shutdown(): Promise<void> {
    this.stopCleanupProcess();
    this.clear(); // Clear all data on shutdown
    logger.info(`${this.name} service shutdown complete`);
  }
}

// Export a default instance with default configuration for convenience
export const memoryStore = new MemoryStore();
export default memoryStore;