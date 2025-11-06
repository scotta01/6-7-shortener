/**
 * Storage module exports
 *
 * This module provides a storage abstraction layer that allows
 * switching between different storage backends without changing
 * the business logic.
 */

export type { URLData, URLStorage, StorageConfig } from "./interface";
export { KVStorage } from "./kv";
export { MemoryStorage } from "./memory";
