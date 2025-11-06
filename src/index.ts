/**
 * URL Shortener - Cloudflare Workers Entry Point
 *
 * This is the main entry point for the Cloudflare Workers deployment.
 * The architecture is designed to be portable to Go + Docker in the future.
 */

import { KVStorage } from "./storage";
import { handleShorten, handleRedirect, handleStats, handleHealth } from "./handlers";
import { handleError, rateLimit, KVRateLimitStorage } from "./middleware";
import type { ShortenerConfig } from "./shortener";

/**
 * Environment bindings
 * These are defined in wrangler.toml
 */
export interface Env {
  URL_STORE: KVNamespace;
  BASE_URL: string;
  DEFAULT_TTL: string;
  CODE_LENGTH: string;
  RATE_LIMIT: string;
  ENVIRONMENT: string;
}

/**
 * Parse environment variables with defaults
 */
function parseConfig(env: Env): {
  baseUrl: string;
  shortenerConfig: ShortenerConfig;
  rateLimitPerMinute: number;
  environment: string;
} {
  return {
    baseUrl: env.BASE_URL || "http://localhost:8787",
    shortenerConfig: {
      codeLength: parseInt(env.CODE_LENGTH || "6", 10),
      maxRetries: 5,
    },
    rateLimitPerMinute: parseInt(env.RATE_LIMIT || "100", 10),
    environment: env.ENVIRONMENT || "development",
  };
}

/**
 * Router - matches URL patterns to handlers
 */
interface Route {
  method: string;
  pattern: RegExp;
  handler: (
    request: Request,
    match: RegExpMatchArray,
    env: Env
  ) => Promise<Response>;
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Parse configuration
      const config = parseConfig(env);

      // Initialize storage
      const storage = new KVStorage(env.URL_STORE, {
        defaultTTL: parseInt(env.DEFAULT_TTL || "0", 10),
      });

      // Rate limiting
      const rateLimitStorage = new KVRateLimitStorage(env.URL_STORE);
      const rateLimitResponse = await rateLimit(
        request,
        rateLimitStorage,
        {
          limit: config.rateLimitPerMinute,
          windowSeconds: 60,
        }
      );

      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      // Parse request URL
      const url = new URL(request.url);
      const path = url.pathname;

      // Route: GET /health
      if (request.method === "GET" && path === "/health") {
        return await handleHealth("1.0.0", config.environment);
      }

      // Route: POST /shorten or POST /api/shorten
      if (
        request.method === "POST" &&
        (path === "/shorten" || path === "/api/shorten")
      ) {
        return await handleShorten(
          request,
          storage,
          config.baseUrl,
          config.shortenerConfig
        );
      }

      // Route: GET /api/stats/:shortCode
      const statsMatch = path.match(/^\/api\/stats\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "GET" && statsMatch) {
        const shortCode = statsMatch[1];
        return await handleStats(shortCode, storage);
      }

      // Route: GET /:shortCode (redirect)
      // Must be last to avoid catching other routes
      const redirectMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "GET" && redirectMatch) {
        const shortCode = redirectMatch[1];
        return await handleRedirect(shortCode, storage);
      }

      // No route matched
      return new Response(
        JSON.stringify({
          error: "Not Found",
          message: `No route matches ${request.method} ${path}`,
          statusCode: 404,
          availableRoutes: [
            "POST /shorten - Create a short URL",
            "GET /:shortCode - Redirect to original URL",
            "GET /api/stats/:shortCode - Get URL statistics",
            "GET /health - Health check",
          ],
        }, null, 2),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      // Global error handler
      return handleError(error);
    }
  },
};
