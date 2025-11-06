/**
 * URL Shortener - Cloudflare Workers Entry Point
 *
 * This is the main entry point for the Cloudflare Workers deployment.
 * The architecture is designed to be portable to Go + Docker in the future.
 */

import { KVStorage } from "./storage";
import { handleShorten, handleRedirect, handleStats, handleHealth, handleDashboard, handleDashboardData, handleQRCode, handlePreview, handlePreviewCard, handleBulkShorten, handleRegisterDomain, handleListDomains, handleVerifyDomain, handleDeleteDomain, KVDomainStorage, handleConfigureABTest, handleGetABTest, handleABTestRedirect, handleDisableABTest, handleConfigureGeoRouting, handleGetGeoRouting, handleGeoRoutedRedirect, handleDisableGeoRouting } from "./handlers";
import { handleError, rateLimit, KVRateLimitStorage, authenticate, KVAPIKeyStorage, handleCreateAPIKey, handleRevokeAPIKey, handleListAPIKeys } from "./middleware";
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
  MASTER_API_KEY?: string; // For managing API keys
  REQUIRE_AUTH?: string; // "true" to require authentication for shorten endpoint
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
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx?: ExecutionContext): Promise<Response> {
    try {
      // Parse configuration
      const config = parseConfig(env);

      // Initialize storage
      const storage = new KVStorage(env.URL_STORE, {
        defaultTTL: parseInt(env.DEFAULT_TTL || "0", 10),
      });

      // Initialize API key storage
      const apiKeyStorage = new KVAPIKeyStorage(env.URL_STORE);

      // Initialize domain storage
      const domainStorage = new KVDomainStorage(env.URL_STORE);

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

      // Route: GET /dashboard
      if (request.method === "GET" && path === "/dashboard") {
        return await handleDashboard();
      }

      // Route: GET /api/dashboard/urls
      if (request.method === "GET" && path === "/api/dashboard/urls") {
        return await handleDashboardData(storage);
      }

      // Route: POST /api/keys - Create API key
      if (request.method === "POST" && path === "/api/keys") {
        const masterKey = env.MASTER_API_KEY || "";
        return await handleCreateAPIKey(request, apiKeyStorage, masterKey);
      }

      // Route: GET /api/keys - List API keys
      if (request.method === "GET" && path === "/api/keys") {
        const masterKey = env.MASTER_API_KEY || "";
        return await handleListAPIKeys(apiKeyStorage, masterKey, request);
      }

      // Route: DELETE /api/keys/:key - Revoke API key
      const revokeMatch = path.match(/^\/api\/keys\/(.+)$/);
      if (request.method === "DELETE" && revokeMatch) {
        const keyToRevoke = revokeMatch[1];
        const masterKey = env.MASTER_API_KEY || "";
        return await handleRevokeAPIKey(keyToRevoke, apiKeyStorage, masterKey, request);
      }

      // Route: POST /api/domains - Register custom domain
      if (request.method === "POST" && path === "/api/domains") {
        // For demo, using "demo-user" as userId
        // In production, extract from authenticated API key
        const authResult = await authenticate(request, apiKeyStorage, ["domains"]);
        const userId = authResult.authenticated ? authResult.keyData.name : "demo-user";
        return await handleRegisterDomain(request, domainStorage, userId);
      }

      // Route: GET /api/domains - List custom domains
      if (request.method === "GET" && path === "/api/domains") {
        const authResult = await authenticate(request, apiKeyStorage, ["domains"]);
        const userId = authResult.authenticated ? authResult.keyData.name : "demo-user";
        return await handleListDomains(domainStorage, userId);
      }

      // Route: POST /api/domains/:domain/verify - Verify domain
      const verifyMatch = path.match(/^\/api\/domains\/([^\/]+)\/verify$/);
      if (request.method === "POST" && verifyMatch) {
        const domain = decodeURIComponent(verifyMatch[1]);
        return await handleVerifyDomain(domain, domainStorage);
      }

      // Route: DELETE /api/domains/:domain - Delete domain
      const deleteDomainMatch = path.match(/^\/api\/domains\/([^\/]+)$/);
      if (request.method === "DELETE" && deleteDomainMatch) {
        const domain = decodeURIComponent(deleteDomainMatch[1]);
        const authResult = await authenticate(request, apiKeyStorage, ["domains"]);
        const userId = authResult.authenticated ? authResult.keyData.name : "demo-user";
        return await handleDeleteDomain(domain, domainStorage, userId);
      }

      // Route: POST /api/abtest/:shortCode - Configure A/B test
      const configABMatch = path.match(/^\/api\/abtest\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "POST" && configABMatch) {
        const shortCode = configABMatch[1];
        return await handleConfigureABTest(shortCode, request, storage);
      }

      // Route: GET /api/abtest/:shortCode - Get A/B test stats
      const getABMatch = path.match(/^\/api\/abtest\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "GET" && getABMatch) {
        const shortCode = getABMatch[1];
        return await handleGetABTest(shortCode, storage);
      }

      // Route: DELETE /api/abtest/:shortCode - Disable A/B test
      const disableABMatch = path.match(/^\/api\/abtest\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "DELETE" && disableABMatch) {
        const shortCode = disableABMatch[1];
        return await handleDisableABTest(shortCode, storage);
      }

      // Route: POST /api/georoute/:shortCode - Configure geographic routing
      const configGeoMatch = path.match(/^\/api\/georoute\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "POST" && configGeoMatch) {
        const shortCode = configGeoMatch[1];
        return await handleConfigureGeoRouting(shortCode, request, storage);
      }

      // Route: GET /api/georoute/:shortCode - Get geographic routing stats
      const getGeoMatch = path.match(/^\/api\/georoute\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "GET" && getGeoMatch) {
        const shortCode = getGeoMatch[1];
        return await handleGetGeoRouting(shortCode, storage);
      }

      // Route: DELETE /api/georoute/:shortCode - Disable geographic routing
      const disableGeoMatch = path.match(/^\/api\/georoute\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "DELETE" && disableGeoMatch) {
        const shortCode = disableGeoMatch[1];
        return await handleDisableGeoRouting(shortCode, storage);
      }

      // Route: POST /api/bulk/shorten
      if (request.method === "POST" && path === "/api/bulk/shorten") {
        return await handleBulkShorten(
          request,
          storage,
          config.baseUrl,
          config.shortenerConfig
        );
      }

      // Route: POST /shorten or POST /api/shorten
      if (
        request.method === "POST" &&
        (path === "/shorten" || path === "/api/shorten")
      ) {
        // Optional authentication
        if (env.REQUIRE_AUTH === "true") {
          const authResult = await authenticate(request, apiKeyStorage, ["shorten"]);
          if (!authResult.authenticated) {
            return authResult.response;
          }
        }

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

      // Route: GET /:shortCode/preview
      const previewMatch = path.match(/^\/([a-zA-Z0-9_-]+)\/preview$/);
      if (request.method === "GET" && previewMatch) {
        const shortCode = previewMatch[1];
        return await handlePreview(shortCode, storage);
      }

      // Route: GET /:shortCode/card
      const cardMatch = path.match(/^\/([a-zA-Z0-9_-]+)\/card$/);
      if (request.method === "GET" && cardMatch) {
        const shortCode = cardMatch[1];
        return await handlePreviewCard(shortCode, storage, config.baseUrl);
      }

      // Route: GET /:shortCode/qr
      const qrMatch = path.match(/^\/([a-zA-Z0-9_-]+)\/qr$/);
      if (request.method === "GET" && qrMatch) {
        const shortCode = qrMatch[1];
        const format = url.searchParams.get("format") || "png";
        const size = parseInt(url.searchParams.get("size") || "300", 10);
        return await handleQRCode(shortCode, storage, config.baseUrl, format, size);
      }

      // Route: GET /:shortCode (redirect)
      // Must be last to avoid catching other routes
      const redirectMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/);
      if (request.method === "GET" && redirectMatch) {
        const shortCode = redirectMatch[1];

        // Check if geographic routing is enabled
        const urlData = await storage.get(shortCode);
        if (urlData && urlData.metadata && (urlData.metadata as any).geoRouting?.enabled) {
          return await handleGeoRoutedRedirect(shortCode, request, storage);
        }

        // Check if A/B testing is enabled
        if (urlData && urlData.metadata && (urlData.metadata as any).abTest?.enabled) {
          return await handleABTestRedirect(shortCode, storage);
        }

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
            "POST /api/bulk/shorten - Create multiple short URLs (max 100)",
            "GET /:shortCode - Redirect to original URL",
            "GET /:shortCode/qr - Generate QR code (params: format=png|svg, size=100-1000)",
            "GET /:shortCode/preview - Get Open Graph metadata",
            "GET /:shortCode/card - Preview card with auto-redirect",
            "GET /api/stats/:shortCode - Get URL statistics",
            "POST /api/abtest/:shortCode - Configure A/B testing",
            "GET /api/abtest/:shortCode - Get A/B test statistics",
            "DELETE /api/abtest/:shortCode - Disable A/B testing",
            "POST /api/georoute/:shortCode - Configure geographic routing",
            "GET /api/georoute/:shortCode - Get geographic routing statistics",
            "DELETE /api/georoute/:shortCode - Disable geographic routing",
            "GET /dashboard - Analytics dashboard",
            "POST /api/keys - Create API key (requires master key)",
            "GET /api/keys - List API keys (requires master key)",
            "DELETE /api/keys/:key - Revoke API key (requires master key)",
            "POST /api/domains - Register custom domain",
            "GET /api/domains - List custom domains",
            "POST /api/domains/:domain/verify - Verify domain ownership",
            "DELETE /api/domains/:domain - Delete custom domain",
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
