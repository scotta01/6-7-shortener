/**
 * Bulk URL Shortening Handler
 * Allows creating multiple short URLs in a single request
 */

import type { URLStorage, URLData } from "../storage";
import {
  generateUniqueShortCode,
  validateCustomCode,
  assertValidUrl,
  type ShortenerConfig,
} from "../shortener";
import { Errors } from "../middleware";

/**
 * Single URL request in bulk operation
 */
export interface BulkUrlRequest {
  url: string;
  customCode?: string;
  expiresIn?: number;
}

/**
 * Request body for POST /api/bulk/shorten
 */
export interface BulkShortenRequest {
  urls: BulkUrlRequest[];
}

/**
 * Single URL result in bulk operation
 */
export interface BulkUrlResult {
  url: string;
  success: boolean;
  shortCode?: string;
  shortUrl?: string;
  error?: string;
  createdAt?: number;
  expiresAt?: number;
}

/**
 * Response body for POST /api/bulk/shorten
 */
export interface BulkShortenResponse {
  total: number;
  successful: number;
  failed: number;
  results: BulkUrlResult[];
}

/**
 * Handler for POST /api/bulk/shorten
 * Creates multiple short URLs in a single request
 *
 * @param request HTTP request
 * @param storage Storage backend
 * @param baseUrl Base URL for short links
 * @param config Shortener configuration
 * @returns HTTP response
 */
export async function handleBulkShorten(
  request: Request,
  storage: URLStorage,
  baseUrl: string,
  config: ShortenerConfig
): Promise<Response> {
  // Parse request body
  let body: BulkShortenRequest;
  try {
    body = await request.json();
  } catch (error) {
    throw Errors.badRequest("Invalid JSON in request body");
  }

  // Validate required fields
  if (!body.urls || !Array.isArray(body.urls)) {
    throw Errors.badRequest("Missing or invalid 'urls' array");
  }

  // Limit bulk operations to prevent abuse
  const maxBulkSize = 100;
  if (body.urls.length === 0) {
    throw Errors.badRequest("URLs array cannot be empty");
  }
  if (body.urls.length > maxBulkSize) {
    throw Errors.badRequest(`Bulk operation limited to ${maxBulkSize} URLs per request`);
  }

  // Process each URL
  const results: BulkUrlResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const urlRequest of body.urls) {
    try {
      // Validate URL field
      if (!urlRequest.url) {
        results.push({
          url: urlRequest.url || "",
          success: false,
          error: "Missing required field: url",
        });
        failed++;
        continue;
      }

      // Validate and sanitize URL
      let sanitizedUrl: string;
      try {
        sanitizedUrl = assertValidUrl(urlRequest.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid URL";
        results.push({
          url: urlRequest.url,
          success: false,
          error: message,
        });
        failed++;
        continue;
      }

      // Determine short code
      let shortCode: string;
      let isCustom = false;

      if (urlRequest.customCode) {
        // Use custom code if provided
        try {
          validateCustomCode(urlRequest.customCode);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid custom code";
          results.push({
            url: urlRequest.url,
            success: false,
            error: message,
          });
          failed++;
          continue;
        }

        // Check if custom code already exists
        const exists = await storage.exists(urlRequest.customCode);
        if (exists) {
          results.push({
            url: urlRequest.url,
            success: false,
            error: `Custom code '${urlRequest.customCode}' is already in use`,
          });
          failed++;
          continue;
        }

        shortCode = urlRequest.customCode;
        isCustom = true;
      } else {
        // Generate unique code
        shortCode = await generateUniqueShortCode(sanitizedUrl, storage, config);
      }

      // Calculate expiration
      const createdAt = Date.now();
      let expiresAt: number | undefined;

      if (urlRequest.expiresIn !== undefined && urlRequest.expiresIn !== 0) {
        expiresAt = createdAt + urlRequest.expiresIn * 1000;
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

      // Add to results
      results.push({
        url: sanitizedUrl,
        success: true,
        shortCode,
        shortUrl,
        createdAt,
        expiresAt,
      });
      successful++;
    } catch (error) {
      // Catch any unexpected errors
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({
        url: urlRequest.url || "",
        success: false,
        error: message,
      });
      failed++;
    }
  }

  // Build response
  const response: BulkShortenResponse = {
    total: body.urls.length,
    successful,
    failed,
    results,
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
