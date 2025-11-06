import type { URLStorage } from "../storage";

/**
 * Base62 character set (0-9, a-z, A-Z)
 * This is portable and can be used in Go as well
 */
const BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Configuration for the URL shortener algorithm
 */
export interface ShortenerConfig {
  /** Length of generated short codes */
  codeLength: number;

  /** Maximum retry attempts for collision resolution */
  maxRetries: number;
}

/**
 * Encode a number to base62 string
 * Portable algorithm that can be implemented in Go
 *
 * @param num The number to encode
 * @returns Base62 encoded string
 */
export function encodeBase62(num: number): string {
  if (num === 0) return BASE62_CHARS[0];

  let encoded = "";
  while (num > 0) {
    encoded = BASE62_CHARS[num % 62] + encoded;
    num = Math.floor(num / 62);
  }

  return encoded;
}

/**
 * Decode a base62 string to number
 * Useful for analytics or debugging
 *
 * @param str The base62 string to decode
 * @returns Decoded number
 */
export function decodeBase62(str: string): number {
  let decoded = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = BASE62_CHARS.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid base62 character: ${char}`);
    }
    decoded = decoded * 62 + value;
  }
  return decoded;
}

/**
 * Generate a hash from a string
 * Uses simple FNV-1a hash algorithm (portable to Go)
 *
 * @param input String to hash
 * @returns 32-bit hash value
 */
function hashString(input: string): number {
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  return hash >>> 0; // Convert to unsigned 32-bit
}

/**
 * Generate a short code from a URL
 * This algorithm is deterministic for the same URL+counter+timestamp combination
 *
 * @param url Original URL
 * @param counter Collision counter (0 for first attempt)
 * @param codeLength Desired length of short code
 * @returns Generated short code
 */
export function generateShortCode(
  url: string,
  counter: number = 0,
  codeLength: number = 6
): string {
  // Combine URL, timestamp, and counter for uniqueness
  const timestamp = Date.now();
  const seed = `${url}:${timestamp}:${counter}`;

  // Generate hash
  const hash = hashString(seed);

  // Encode to base62
  let code = encodeBase62(hash);

  // Pad or truncate to desired length
  if (code.length < codeLength) {
    // Pad with random characters
    while (code.length < codeLength) {
      const randomIdx = Math.floor(Math.random() * 62);
      code += BASE62_CHARS[randomIdx];
    }
  } else if (code.length > codeLength) {
    // Truncate
    code = code.substring(0, codeLength);
  }

  return code;
}

/**
 * Generate a unique short code with collision detection
 * Retries with an incremented counter if collision occurs
 *
 * @param url Original URL
 * @param storage Storage backend to check for collisions
 * @param config Shortener configuration
 * @returns Promise resolving to unique short code
 * @throws Error if max retries exceeded
 */
export async function generateUniqueShortCode(
  url: string,
  storage: URLStorage,
  config: ShortenerConfig = { codeLength: 6, maxRetries: 5 }
): Promise<string> {
  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    const shortCode = generateShortCode(url, attempt, config.codeLength);

    // Check if this code already exists
    const exists = await storage.exists(shortCode);

    if (!exists) {
      return shortCode;
    }

    // Log collision (in production, you might want structured logging)
    console.warn(`Collision detected for ${shortCode}, retrying... (attempt ${attempt + 1})`);
  }

  throw new Error(
    `Failed to generate unique short code after ${config.maxRetries} attempts`
  );
}

/**
 * Validate a custom short code
 * Ensures it meets security and format requirements
 *
 * @param customCode User-provided custom code
 * @returns true if valid
 * @throws Error with validation message if invalid
 */
export function validateCustomCode(customCode: string): boolean {
  // Length requirements
  if (customCode.length < 3 || customCode.length > 20) {
    throw new Error("Custom code must be between 3 and 20 characters");
  }

  // Only allow alphanumeric characters, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(customCode)) {
    throw new Error("Custom code can only contain letters, numbers, hyphens, and underscores");
  }

  // Prevent reserved keywords
  const reserved = ["api", "health", "admin", "stats", "shorten", "new", "create"];
  if (reserved.includes(customCode.toLowerCase())) {
    throw new Error(`Custom code '${customCode}' is reserved`);
  }

  return true;
}
