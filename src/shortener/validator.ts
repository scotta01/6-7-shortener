/**
 * URL validation with security checks
 *
 * This module provides comprehensive URL validation to prevent:
 * - SSRF attacks (Server-Side Request Forgery)
 * - Malicious redirects
 * - Invalid URLs
 */

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

/**
 * Blocked hosts to prevent SSRF and abuse
 */
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::]",
  "[::1]",
];

/**
 * Private IP ranges to block (CIDR notation patterns)
 */
const PRIVATE_IP_PATTERNS = [
  /^10\./,                    // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./,              // 192.168.0.0/16
  /^169\.254\./,              // 169.254.0.0/16 (link-local)
  /^fc00:/i,                  // fc00::/7 (IPv6 private)
  /^fe80:/i,                  // fe80::/10 (IPv6 link-local)
];

/**
 * Maximum URL length to prevent abuse
 */
const MAX_URL_LENGTH = 2048;

/**
 * Check if a hostname is a private or local IP
 *
 * @param hostname Hostname to check
 * @returns true if private/local
 */
function isPrivateOrLocalIP(hostname: string): boolean {
  // Check exact matches
  if (BLOCKED_HOSTS.includes(hostname.toLowerCase())) {
    return true;
  }

  // Check private IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate and sanitize a URL
 *
 * @param url URL to validate
 * @returns ValidationResult with valid flag and sanitized URL or error
 */
export function validateUrl(url: string): ValidationResult {
  // Check length
  if (url.length > MAX_URL_LENGTH) {
    return {
      valid: false,
      error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`,
    };
  }

  // Check if empty
  if (!url || url.trim().length === 0) {
    return {
      valid: false,
      error: "URL cannot be empty",
    };
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    return {
      valid: false,
      error: "Invalid URL format",
    };
  }

  // Only allow HTTP and HTTPS
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      valid: false,
      error: "Only HTTP and HTTPS protocols are allowed",
    };
  }

  // Check for private/local IPs to prevent SSRF
  if (isPrivateOrLocalIP(parsedUrl.hostname)) {
    return {
      valid: false,
      error: "URLs pointing to private or local addresses are not allowed",
    };
  }

  // Check for username:password in URL (security risk)
  if (parsedUrl.username || parsedUrl.password) {
    return {
      valid: false,
      error: "URLs with embedded credentials are not allowed",
    };
  }

  // Sanitize: ensure consistent formatting
  const sanitizedUrl = parsedUrl.toString();

  return {
    valid: true,
    sanitizedUrl,
  };
}

/**
 * Quick check if URL is valid (throws on invalid)
 * Convenience wrapper for validateUrl
 *
 * @param url URL to validate
 * @returns Sanitized URL
 * @throws Error if URL is invalid
 */
export function assertValidUrl(url: string): string {
  const result = validateUrl(url);

  if (!result.valid) {
    throw new Error(result.error || "Invalid URL");
  }

  return result.sanitizedUrl!;
}
