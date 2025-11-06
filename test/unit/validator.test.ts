import { describe, it, expect } from "vitest";
import { validateUrl, assertValidUrl } from "../../src/shortener/validator";

describe("validateUrl", () => {
  it("should accept valid HTTP URLs", () => {
    const result = validateUrl("http://example.com");
    expect(result.valid).toBe(true);
    expect(result.sanitizedUrl).toBe("http://example.com/");
  });

  it("should accept valid HTTPS URLs", () => {
    const result = validateUrl("https://example.com/path?query=value");
    expect(result.valid).toBe(true);
    expect(result.sanitizedUrl).toContain("https://example.com");
  });

  it("should normalize URLs", () => {
    const result = validateUrl("https://example.com");
    expect(result.sanitizedUrl).toBe("https://example.com/");
  });

  it("should reject empty URLs", () => {
    const result = validateUrl("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("cannot be empty");
  });

  it("should reject URLs that are too long", () => {
    const longUrl = "https://example.com/" + "a".repeat(2050);
    const result = validateUrl(longUrl);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds maximum length");
  });

  it("should reject invalid URL formats", () => {
    const result = validateUrl("not a url");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid URL format");
  });

  it("should reject non-HTTP protocols", () => {
    expect(validateUrl("ftp://example.com").valid).toBe(false);
    expect(validateUrl("file:///etc/passwd").valid).toBe(false);
    expect(validateUrl("javascript:alert(1)").valid).toBe(false);
  });

  it("should reject localhost URLs", () => {
    expect(validateUrl("http://localhost:3000").valid).toBe(false);
    expect(validateUrl("https://localhost").valid).toBe(false);
  });

  it("should reject 127.0.0.1 URLs", () => {
    const result = validateUrl("http://127.0.0.1");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("private or local");
  });

  it("should reject private IP ranges", () => {
    expect(validateUrl("http://10.0.0.1").valid).toBe(false);
    expect(validateUrl("http://192.168.1.1").valid).toBe(false);
    expect(validateUrl("http://172.16.0.1").valid).toBe(false);
    expect(validateUrl("http://169.254.1.1").valid).toBe(false);
  });

  it("should reject URLs with embedded credentials", () => {
    const result = validateUrl("https://user:pass@example.com");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("embedded credentials");
  });

  it("should accept URLs with ports", () => {
    const result = validateUrl("https://example.com:8080");
    expect(result.valid).toBe(true);
  });

  it("should accept URLs with fragments", () => {
    const result = validateUrl("https://example.com/page#section");
    expect(result.valid).toBe(true);
  });

  it("should accept URLs with query parameters", () => {
    const result = validateUrl("https://example.com/search?q=test&lang=en");
    expect(result.valid).toBe(true);
  });

  it("should accept URLs with subdomains", () => {
    const result = validateUrl("https://subdomain.example.com");
    expect(result.valid).toBe(true);
  });

  it("should accept URLs with hyphens in domain", () => {
    const result = validateUrl("https://my-example.com");
    expect(result.valid).toBe(true);
  });
});

describe("assertValidUrl", () => {
  it("should return sanitized URL for valid URLs", () => {
    const sanitized = assertValidUrl("https://example.com");
    expect(sanitized).toBe("https://example.com/");
  });

  it("should throw for invalid URLs", () => {
    expect(() => assertValidUrl("not a url")).toThrow("Invalid URL");
    expect(() => assertValidUrl("http://localhost")).toThrow();
    expect(() => assertValidUrl("ftp://example.com")).toThrow();
  });

  it("should throw with specific error message", () => {
    expect(() => assertValidUrl("")).toThrow("cannot be empty");
    expect(() => assertValidUrl("http://127.0.0.1")).toThrow(
      "private or local"
    );
  });
});
