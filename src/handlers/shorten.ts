import type { URLStorage, URLData } from "../storage";
import {
  generateUniqueShortCode,
  validateCustomCode,
  assertValidUrl,
  type ShortenerConfig,
} from "../shortener";
import { Errors } from "../middleware";

/**
 * Request body for POST /shorten
 */
export interface ShortenRequest {
  url: string;
  customCode?: string;
  expiresIn?: number; // Seconds from now
}

/**
 * Response body for POST /shorten
 */
export interface ShortenResponse {
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  createdAt: number;
  expiresAt?: number;
}

/**
 * Handler for POST /shorten
 * Creates a new short URL
 *
 * @param request HTTP request
 * @param storage Storage backend
 * @param baseUrl Base URL for short links
 * @param config Shortener configuration
 * @returns HTTP response
 */
export async function handleShorten(
  request: Request,
  storage: URLStorage,
  baseUrl: string,
  config: ShortenerConfig
): Promise<Response> {
  // Parse request body
  let body: ShortenRequest;
  try {
    body = await request.json();
  } catch (error) {
    throw Errors.badRequest("Invalid JSON in request body");
  }

  // Validate required fields
  if (!body.url) {
    throw Errors.badRequest("Missing required field: url");
  }

  // Validate and sanitize URL
  const sanitizedUrl = assertValidUrl(body.url);

  // Determine short code
  let shortCode: string;
  let isCustom = false;

  if (body.customCode) {
    // Use custom code if provided
    validateCustomCode(body.customCode);

    // Check if custom code already exists
    const exists = await storage.exists(body.customCode);
    if (exists) {
      throw Errors.badRequest(`Custom code '${body.customCode}' is already in use`);
    }

    shortCode = body.customCode;
    isCustom = true;
  } else {
    // Generate unique code
    shortCode = await generateUniqueShortCode(sanitizedUrl, storage, config);
  }

  // Calculate expiration
  const createdAt = Date.now();
  let expiresAt: number | undefined;

  if (body.expiresIn && body.expiresIn > 0) {
    expiresAt = createdAt + body.expiresIn * 1000;
  }

  // Create URL data
  const urlData: URLData = {
    originalUrl: sanitizedUrl,
    shortCode,
    createdAt,
    expiresAt,
    visitCount: 0,
    customCode: isCustom,
  };

  // Store in database
  await storage.set(shortCode, urlData);

  // Build short URL
  const shortUrl = `${baseUrl}/${shortCode}`;

  // Build response
  const response: ShortenResponse = {
    shortCode,
    shortUrl,
    originalUrl: sanitizedUrl,
    createdAt,
    expiresAt,
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
