/**
 * URL Shortener module exports
 *
 * This module contains the core URL shortening algorithm and validation logic.
 * These functions are platform-agnostic and can be ported to Go.
 */

export {
  encodeBase62,
  decodeBase62,
  generateShortCode,
  generateUniqueShortCode,
  validateCustomCode,
  type ShortenerConfig,
} from "./algorithm";

export {
  validateUrl,
  assertValidUrl,
  type ValidationResult,
} from "./validator";
