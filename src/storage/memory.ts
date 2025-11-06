import type { URLData, URLStorage, StorageConfig } from "./interface";

/**
 * In-memory implementation of URLStorage
 *
 * This is useful for:
 * 1. Unit testing without needing KV
 * 2. Local development
 * 3. Demonstrating the storage interface abstraction
 *
 * Note: This implementation is not suitable for production as data
 * is lost when the worker instance restarts
 */
export class MemoryStorage implements URLStorage {
  private store: Map<string, URLData>;
  private config: StorageConfig;
  private keyPrefix: string;

  constructor(config: StorageConfig = { defaultTTL: 0 }) {
    this.store = new Map();
    this.config = config;
    this.keyPrefix = config.keyPrefix || "url:";
  }

  /**
   * Generate the full key for a short code
   */
  private getKey(shortCode: string): string {
    return `${this.keyPrefix}${shortCode}`;
  }

  /**
   * Check if a URL has expired
   */
  private isExpired(data: URLData): boolean {
    if (!data.expiresAt) return false;
    return Date.now() > data.expiresAt;
  }

  async set(shortCode: string, data: URLData): Promise<void> {
    const key = this.getKey(shortCode);
    this.store.set(key, { ...data }); // Clone to prevent external mutations
  }

  async get(shortCode: string): Promise<URLData | null> {
    const key = this.getKey(shortCode);
    const data = this.store.get(key);

    if (!data) {
      return null;
    }

    // Check expiration
    if (this.isExpired(data)) {
      await this.delete(shortCode);
      return null;
    }

    return { ...data }; // Clone to prevent external mutations
  }

  async exists(shortCode: string): Promise<boolean> {
    const key = this.getKey(shortCode);
    return this.store.has(key);
  }

  async delete(shortCode: string): Promise<void> {
    const key = this.getKey(shortCode);
    this.store.delete(key);
  }

  async incrementStats(shortCode: string): Promise<void> {
    const data = await this.get(shortCode);
    if (!data) {
      throw new Error(`Short code ${shortCode} not found`);
    }

    data.visitCount += 1;
    await this.set(shortCode, data);
  }

  /**
   * Clear all data (useful for tests)
   */
  async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Get the size of the store (useful for tests)
   */
  size(): number {
    return this.store.size;
  }
}
