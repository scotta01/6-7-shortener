import type { URLData, URLStorage, StorageConfig } from "./interface";

/**
 * Cloudflare KV implementation of URLStorage
 *
 * This adapter provides a bridge between the storage interface and Cloudflare KV.
 * When migrating to Go+Redis, a similar adapter will be created for Redis.
 *
 * Key structure: {prefix}url:{shortCode}
 * Value: JSON-serialized URLData
 */
export class KVStorage implements URLStorage {
  private kv: KVNamespace;
  private config: StorageConfig;
  private keyPrefix: string;

  constructor(kv: KVNamespace, config: StorageConfig = { defaultTTL: 0 }) {
    this.kv = kv;
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

    // Calculate KV expiration TTL (KV uses seconds from now)
    let expirationTtl: number | undefined;
    if (data.expiresAt) {
      const ttlSeconds = Math.floor((data.expiresAt - Date.now()) / 1000);
      expirationTtl = ttlSeconds > 0 ? ttlSeconds : undefined;
    }

    // Store in KV with optional expiration
    await this.kv.put(key, JSON.stringify(data), {
      expirationTtl,
    });
  }

  async get(shortCode: string): Promise<URLData | null> {
    const key = this.getKey(shortCode);
    const value = await this.kv.get(key, "text");

    if (!value) {
      return null;
    }

    try {
      const data: URLData = JSON.parse(value);

      // Double-check expiration (KV should auto-delete, but be defensive)
      if (this.isExpired(data)) {
        await this.delete(shortCode);
        return null;
      }

      return data;
    } catch (error) {
      console.error(`Failed to parse URLData for ${shortCode}:`, error);
      return null;
    }
  }

  async exists(shortCode: string): Promise<boolean> {
    const key = this.getKey(shortCode);
    const value = await this.kv.get(key);
    return value !== null;
  }

  async delete(shortCode: string): Promise<void> {
    const key = this.getKey(shortCode);
    await this.kv.delete(key);
  }

  async incrementStats(shortCode: string): Promise<void> {
    // KV doesn't support atomic increment, so we need to read-modify-write
    // This has a race condition, but for visit counts it's acceptable
    // In Go+Redis, we can use INCR for atomic increment

    const data = await this.get(shortCode);
    if (!data) {
      throw new Error(`Short code ${shortCode} not found`);
    }

    data.visitCount += 1;

    // Update with new visit count
    await this.set(shortCode, data);
  }
}
