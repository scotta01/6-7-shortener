import { describe, it, expect, beforeEach } from "vitest";
import {
  encodeBase62,
  decodeBase62,
  generateShortCode,
  generateUniqueShortCode,
  validateCustomCode,
} from "../../src/shortener/algorithm";
import { MemoryStorage } from "../../src/storage/memory";

describe("Base62 Encoding", () => {
  it("should encode 0 correctly", () => {
    expect(encodeBase62(0)).toBe("0");
  });

  it("should encode small numbers correctly", () => {
    expect(encodeBase62(1)).toBe("1");
    expect(encodeBase62(10)).toBe("a");
    expect(encodeBase62(35)).toBe("z");
    expect(encodeBase62(36)).toBe("A");
    expect(encodeBase62(61)).toBe("Z");
  });

  it("should encode large numbers correctly", () => {
    expect(encodeBase62(62)).toBe("10");
    expect(encodeBase62(123)).toBe("1Z");
    expect(encodeBase62(3844)).toBe("100");
  });

  it("should encode and decode symmetrically", () => {
    const testValues = [0, 1, 62, 123, 999, 12345, 999999];
    for (const value of testValues) {
      const encoded = encodeBase62(value);
      const decoded = decodeBase62(encoded);
      expect(decoded).toBe(value);
    }
  });
});

describe("Base62 Decoding", () => {
  it("should decode single characters correctly", () => {
    expect(decodeBase62("0")).toBe(0);
    expect(decodeBase62("1")).toBe(1);
    expect(decodeBase62("a")).toBe(10);
    expect(decodeBase62("Z")).toBe(61);
  });

  it("should decode multi-character strings correctly", () => {
    expect(decodeBase62("10")).toBe(62);
    expect(decodeBase62("1Z")).toBe(123);
    expect(decodeBase62("100")).toBe(3844);
  });

  it("should throw on invalid characters", () => {
    expect(() => decodeBase62("@")).toThrow("Invalid base62 character");
    expect(() => decodeBase62("abc$")).toThrow("Invalid base62 character");
  });
});

describe("generateShortCode", () => {
  it("should generate a code of specified length", () => {
    const code = generateShortCode("https://example.com", 0, 6);
    expect(code).toHaveLength(6);
  });

  it("should generate different codes for different URLs", () => {
    const code1 = generateShortCode("https://example.com", 0, 6);
    const code2 = generateShortCode("https://different.com", 0, 6);
    expect(code1).not.toBe(code2);
  });

  it("should generate different codes with different counters", () => {
    const url = "https://example.com";
    const code1 = generateShortCode(url, 0, 6);
    const code2 = generateShortCode(url, 1, 6);
    expect(code1).not.toBe(code2);
  });

  it("should only contain base62 characters", () => {
    const code = generateShortCode("https://example.com", 0, 8);
    expect(code).toMatch(/^[0-9a-zA-Z]+$/);
  });

  it("should handle custom lengths", () => {
    expect(generateShortCode("https://example.com", 0, 4)).toHaveLength(4);
    expect(generateShortCode("https://example.com", 0, 10)).toHaveLength(10);
  });
});

describe("generateUniqueShortCode", () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage();
  });

  it("should generate a unique code", async () => {
    const code = await generateUniqueShortCode(
      "https://example.com",
      storage,
      { codeLength: 6, maxRetries: 5 }
    );

    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[0-9a-zA-Z]+$/);
  });

  it("should retry on collision", async () => {
    // Pre-populate storage to force collision
    const url = "https://example.com";
    const firstCode = generateShortCode(url, 0, 6);

    await storage.set(firstCode, {
      originalUrl: "https://other.com",
      shortCode: firstCode,
      createdAt: Date.now(),
      visitCount: 0,
      customCode: false,
    });

    // Should generate different code on collision
    const uniqueCode = await generateUniqueShortCode(url, storage, {
      codeLength: 6,
      maxRetries: 5,
    });

    expect(uniqueCode).not.toBe(firstCode);
  });

  it("should throw after max retries exceeded", async () => {
    // Fill storage with all possible codes (simulate worst case)
    // For testing, we use a very small code length to make this feasible
    const url = "https://example.com";

    // Populate storage with codes
    for (let i = 0; i < 10; i++) {
      const code = generateShortCode(url, i, 4);
      await storage.set(code, {
        originalUrl: "https://taken.com",
        shortCode: code,
        createdAt: Date.now(),
        visitCount: 0,
        customCode: false,
      });
    }

    // Should throw after retries
    await expect(
      generateUniqueShortCode(url, storage, { codeLength: 4, maxRetries: 2 })
    ).rejects.toThrow("Failed to generate unique short code");
  });
});

describe("validateCustomCode", () => {
  it("should accept valid custom codes", () => {
    expect(validateCustomCode("abc123")).toBe(true);
    expect(validateCustomCode("my-link")).toBe(true);
    expect(validateCustomCode("my_link")).toBe(true);
    expect(validateCustomCode("ABC")).toBe(true);
  });

  it("should reject codes that are too short", () => {
    expect(() => validateCustomCode("ab")).toThrow(
      "Custom code must be between 3 and 20 characters"
    );
  });

  it("should reject codes that are too long", () => {
    expect(() => validateCustomCode("a".repeat(21))).toThrow(
      "Custom code must be between 3 and 20 characters"
    );
  });

  it("should reject codes with invalid characters", () => {
    expect(() => validateCustomCode("abc@123")).toThrow(
      "Custom code can only contain"
    );
    expect(() => validateCustomCode("abc 123")).toThrow(
      "Custom code can only contain"
    );
    expect(() => validateCustomCode("abc.123")).toThrow(
      "Custom code can only contain"
    );
  });

  it("should reject reserved keywords", () => {
    expect(() => validateCustomCode("api")).toThrow("is reserved");
    expect(() => validateCustomCode("health")).toThrow("is reserved");
    expect(() => validateCustomCode("admin")).toThrow("is reserved");
    expect(() => validateCustomCode("API")).toThrow("is reserved"); // Case insensitive
  });

  it("should allow codes similar to reserved words", () => {
    expect(validateCustomCode("api1")).toBe(true);
    expect(validateCustomCode("my-api")).toBe(true);
    expect(validateCustomCode("healthy")).toBe(true);
  });
});
