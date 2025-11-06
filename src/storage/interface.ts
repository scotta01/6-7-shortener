/**
 * URL Data structure stored in the database
 * This structure is portable and can be implemented in Go with the same fields
 */
export interface URLData {
  /** Original long URL */
  originalUrl: string;

  /** Short code identifier */
  shortCode: string;

  /** Creation timestamp (Unix milliseconds) */
  createdAt: number;

  /** Expiration timestamp (Unix milliseconds), undefined means no expiration */
  expiresAt?: number;

  /** Number of times this URL has been visited */
  visitCount: number;

  /** Whether this was a custom user-provided code */
  customCode: boolean;

  /** Metadata for future extensibility */
  metadata?: Record<string, unknown>;
}

/**
 * Storage interface contract
 * Any storage backend (KV, Redis, SQL, etc.) must implement this interface
 *
 * Go equivalent would be:
 * type URLStorage interface {
 *   Set(ctx context.Context, shortCode string, data *URLData) error
 *   Get(ctx context.Context, shortCode string) (*URLData, error)
 *   Exists(ctx context.Context, shortCode string) (bool, error)
 *   Delete(ctx context.Context, shortCode string) error
 *   IncrementStats(ctx context.Context, shortCode string) error
 * }
 */
export interface URLStorage {
  /**
   * Store a URL mapping
   * @param shortCode The short code identifier
   * @param data The URL data to store
   * @throws Error if storage operation fails
   */
  set(shortCode: string, data: URLData): Promise<void>;

  /**
   * Retrieve a URL mapping
   * @param shortCode The short code identifier
   * @returns URLData if found, null if not found or expired
   * @throws Error if storage operation fails
   */
  get(shortCode: string): Promise<URLData | null>;

  /**
   * Check if a short code exists
   * Used for collision detection during code generation
   * @param shortCode The short code to check
   * @returns true if exists, false otherwise
   * @throws Error if storage operation fails
   */
  exists(shortCode: string): Promise<boolean>;

  /**
   * Delete a URL mapping
   * Used for manual deletion or cleanup of expired URLs
   * @param shortCode The short code to delete
   * @throws Error if storage operation fails
   */
  delete(shortCode: string): Promise<void>;

  /**
   * Increment the visit counter for a URL
   * Called on each redirect
   * @param shortCode The short code to increment stats for
   * @throws Error if storage operation fails
   */
  incrementStats(shortCode: string): Promise<void>;
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  /** Default TTL for URLs in seconds (0 = no expiration) */
  defaultTTL: number;

  /** Key prefix for namespacing (useful for multi-tenant setups) */
  keyPrefix?: string;
}
