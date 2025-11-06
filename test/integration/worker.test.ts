import { describe, it, expect, beforeEach } from "vitest";
import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import worker from "../../src/index";

/**
 * Integration tests for the URL shortener worker
 * These tests run against the actual worker code using Miniflare
 */

describe("URL Shortener Worker", () => {
  beforeEach(async () => {
    // Clear KV store before each test
    // Note: In the test environment, KV operations are mocked
    const keys = await env.URL_STORE.list();
    for (const key of keys.keys) {
      await env.URL_STORE.delete(key.name);
    }
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const request = new Request("http://localhost/health");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty("status", "ok");
      expect(body).toHaveProperty("version");
      expect(body).toHaveProperty("timestamp");
    });
  });

  describe("POST /shorten", () => {
    it("should create a short URL", async () => {
      const request = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/very/long/path",
        }),
      });

      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(201);

      const body: any = await response.json();
      expect(body).toHaveProperty("shortCode");
      expect(body).toHaveProperty("shortUrl");
      expect(body).toHaveProperty("originalUrl", "https://example.com/very/long/path");
      expect(body.shortCode).toMatch(/^[0-9a-zA-Z]+$/);
      expect(body.shortUrl).toContain(body.shortCode);
    });

    it("should create a short URL with custom code", async () => {
      const request = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com",
          customCode: "my-link",
        }),
      });

      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(201);

      const body: any = await response.json();
      expect(body.shortCode).toBe("my-link");
    });

    it("should create a short URL with expiration", async () => {
      const request = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com",
          expiresIn: 3600, // 1 hour
        }),
      });

      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(201);

      const body: any = await response.json();
      expect(body).toHaveProperty("expiresAt");
      expect(body.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should reject invalid URLs", async () => {
      const request = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "not a url",
        }),
      });

      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);

      const body: any = await response.json();
      expect(body).toHaveProperty("error");
    });

    it("should reject localhost URLs", async () => {
      const request = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "http://localhost:3000",
        }),
      });

      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
    });

    it("should reject duplicate custom codes", async () => {
      // Create first URL
      const request1 = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com",
          customCode: "duplicate",
        }),
      });

      const ctx1 = createExecutionContext();
      await worker.fetch(request1, env, ctx1);
      await waitOnExecutionContext(ctx1);

      // Try to create second URL with same code
      const request2 = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://different.com",
          customCode: "duplicate",
        }),
      });

      const ctx2 = createExecutionContext();
      const response2 = await worker.fetch(request2, env, ctx2);
      await waitOnExecutionContext(ctx2);

      expect(response2.status).toBe(400);
      const body: any = await response2.json();
      expect(body.message).toContain("already in use");
    });

    it("should reject reserved custom codes", async () => {
      const request = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com",
          customCode: "api",
        }),
      });

      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const body: any = await response.json();
      expect(body.message).toContain("reserved");
    });

    it("should reject missing URL field", async () => {
      const request = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
    });

    it("should reject invalid JSON", async () => {
      const request = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });

      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /:shortCode", () => {
    it("should redirect to original URL", async () => {
      // First create a short URL
      const createRequest = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/target",
          customCode: "test123",
        }),
      });

      const createCtx = createExecutionContext();
      await worker.fetch(createRequest, env, createCtx);
      await waitOnExecutionContext(createCtx);

      // Then redirect
      const redirectRequest = new Request("http://localhost/test123");
      const redirectCtx = createExecutionContext();
      const response = await worker.fetch(redirectRequest, env, redirectCtx);
      await waitOnExecutionContext(redirectCtx);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://example.com/target");
    });

    it("should return 404 for non-existent codes", async () => {
      const request = new Request("http://localhost/nonexistent");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
    });

    it("should return 410 for expired URLs", async () => {
      // Create URL with very short expiration
      const createRequest = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com",
          customCode: "expired",
          expiresIn: -1, // Already expired
        }),
      });

      const createCtx = createExecutionContext();
      await worker.fetch(createRequest, env, createCtx);
      await waitOnExecutionContext(createCtx);

      // Try to redirect
      const redirectRequest = new Request("http://localhost/expired");
      const redirectCtx = createExecutionContext();
      const response = await worker.fetch(redirectRequest, env, redirectCtx);
      await waitOnExecutionContext(redirectCtx);

      expect(response.status).toBe(410);
    });
  });

  describe("GET /api/stats/:shortCode", () => {
    it("should return stats for a short URL", async () => {
      // Create URL
      const createRequest = new Request("http://localhost/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com",
          customCode: "stats-test",
        }),
      });

      const createCtx = createExecutionContext();
      await worker.fetch(createRequest, env, createCtx);
      await waitOnExecutionContext(createCtx);

      // Get stats
      const statsRequest = new Request("http://localhost/api/stats/stats-test");
      const statsCtx = createExecutionContext();
      const response = await worker.fetch(statsRequest, env, statsCtx);
      await waitOnExecutionContext(statsCtx);

      expect(response.status).toBe(200);

      const body: any = await response.json();
      expect(body).toHaveProperty("shortCode", "stats-test");
      expect(body).toHaveProperty("originalUrl", "https://example.com/");
      expect(body).toHaveProperty("visitCount", 0);
      expect(body).toHaveProperty("createdAt");
      expect(body).toHaveProperty("customCode", true);
    });

    it("should return 404 for non-existent codes", async () => {
      const request = new Request("http://localhost/api/stats/nonexistent");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
    });
  });

  describe("404 handling", () => {
    it("should return 404 for unknown routes", async () => {
      const request = new Request("http://localhost/unknown/route");
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);

      const body: any = await response.json();
      expect(body).toHaveProperty("error", "Not Found");
      expect(body).toHaveProperty("availableRoutes");
    });
  });
});
