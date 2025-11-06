import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorage } from "../../src/storage/memory";
import type { URLData } from "../../src/storage";

describe("MemoryStorage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  const createTestData = (shortCode: string): URLData => ({
    originalUrl: "https://example.com",
    shortCode,
    createdAt: Date.now(),
    visitCount: 0,
    customCode: false,
  });

  describe("set and get", () => {
    it("should store and retrieve URL data", async () => {
      const data = createTestData("abc123");
      await storage.set("abc123", data);

      const retrieved = await storage.get("abc123");
      expect(retrieved).toEqual(data);
    });

    it("should return null for non-existent codes", async () => {
      const retrieved = await storage.get("nonexistent");
      expect(retrieved).toBeNull();
    });

    it("should handle multiple entries", async () => {
      await storage.set("code1", createTestData("code1"));
      await storage.set("code2", createTestData("code2"));
      await storage.set("code3", createTestData("code3"));

      expect(await storage.get("code1")).toBeTruthy();
      expect(await storage.get("code2")).toBeTruthy();
      expect(await storage.get("code3")).toBeTruthy();
    });

    it("should overwrite existing entries", async () => {
      const data1 = createTestData("abc123");
      await storage.set("abc123", data1);

      const data2 = { ...data1, visitCount: 5 };
      await storage.set("abc123", data2);

      const retrieved = await storage.get("abc123");
      expect(retrieved?.visitCount).toBe(5);
    });
  });

  describe("exists", () => {
    it("should return true for existing codes", async () => {
      await storage.set("abc123", createTestData("abc123"));
      expect(await storage.exists("abc123")).toBe(true);
    });

    it("should return false for non-existent codes", async () => {
      expect(await storage.exists("nonexistent")).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete existing entries", async () => {
      await storage.set("abc123", createTestData("abc123"));
      expect(await storage.exists("abc123")).toBe(true);

      await storage.delete("abc123");
      expect(await storage.exists("abc123")).toBe(false);
    });

    it("should not throw when deleting non-existent entries", async () => {
      await expect(storage.delete("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("incrementStats", () => {
    it("should increment visit count", async () => {
      const data = createTestData("abc123");
      await storage.set("abc123", data);

      await storage.incrementStats("abc123");

      const retrieved = await storage.get("abc123");
      expect(retrieved?.visitCount).toBe(1);
    });

    it("should increment multiple times", async () => {
      const data = createTestData("abc123");
      await storage.set("abc123", data);

      await storage.incrementStats("abc123");
      await storage.incrementStats("abc123");
      await storage.incrementStats("abc123");

      const retrieved = await storage.get("abc123");
      expect(retrieved?.visitCount).toBe(3);
    });

    it("should throw when incrementing non-existent code", async () => {
      await expect(storage.incrementStats("nonexistent")).rejects.toThrow(
        "not found"
      );
    });
  });

  describe("expiration", () => {
    it("should return data that hasn't expired", async () => {
      const data = createTestData("abc123");
      data.expiresAt = Date.now() + 10000; // 10 seconds in future
      await storage.set("abc123", data);

      const retrieved = await storage.get("abc123");
      expect(retrieved).toBeTruthy();
    });

    it("should return null for expired data", async () => {
      const data = createTestData("abc123");
      data.expiresAt = Date.now() - 1000; // 1 second in past
      await storage.set("abc123", data);

      const retrieved = await storage.get("abc123");
      expect(retrieved).toBeNull();
    });

    it("should auto-delete expired data on get", async () => {
      const data = createTestData("abc123");
      data.expiresAt = Date.now() - 1000;
      await storage.set("abc123", data);

      await storage.get("abc123"); // Should trigger deletion

      expect(await storage.exists("abc123")).toBe(false);
    });

    it("should handle data without expiration", async () => {
      const data = createTestData("abc123");
      // No expiresAt set
      await storage.set("abc123", data);

      const retrieved = await storage.get("abc123");
      expect(retrieved).toBeTruthy();
    });
  });

  describe("key prefix", () => {
    it("should use custom key prefix", async () => {
      const storage = new MemoryStorage({ defaultTTL: 0, keyPrefix: "test:" });
      await storage.set("abc123", createTestData("abc123"));

      // Should be stored with prefix
      expect(await storage.exists("abc123")).toBe(true);
    });

    it("should isolate data with different prefixes", async () => {
      const storage1 = new MemoryStorage({ defaultTTL: 0, keyPrefix: "app1:" });
      const storage2 = new MemoryStorage({ defaultTTL: 0, keyPrefix: "app2:" });

      await storage1.set("abc123", createTestData("abc123"));

      expect(await storage1.exists("abc123")).toBe(true);
      expect(await storage2.exists("abc123")).toBe(false);
    });
  });

  describe("utility methods", () => {
    it("should clear all data", async () => {
      await storage.set("code1", createTestData("code1"));
      await storage.set("code2", createTestData("code2"));

      await storage.clear();

      expect(storage.size()).toBe(0);
      expect(await storage.exists("code1")).toBe(false);
      expect(await storage.exists("code2")).toBe(false);
    });

    it("should report correct size", async () => {
      expect(storage.size()).toBe(0);

      await storage.set("code1", createTestData("code1"));
      expect(storage.size()).toBe(1);

      await storage.set("code2", createTestData("code2"));
      expect(storage.size()).toBe(2);

      await storage.delete("code1");
      expect(storage.size()).toBe(1);
    });
  });

  describe("data isolation", () => {
    it("should clone data on set to prevent external mutations", async () => {
      const data = createTestData("abc123");
      await storage.set("abc123", data);

      // Mutate original
      data.visitCount = 999;

      // Retrieved should be unchanged
      const retrieved = await storage.get("abc123");
      expect(retrieved?.visitCount).toBe(0);
    });

    it("should clone data on get to prevent external mutations", async () => {
      await storage.set("abc123", createTestData("abc123"));

      const retrieved1 = await storage.get("abc123");
      if (retrieved1) retrieved1.visitCount = 999;

      const retrieved2 = await storage.get("abc123");
      expect(retrieved2?.visitCount).toBe(0);
    });
  });
});
