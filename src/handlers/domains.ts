/**
 * Custom Domains Handler
 * Allows users to configure custom domains for their shortened URLs
 */

import type { URLData } from "../storage";
import { Errors } from "../middleware";

/**
 * Domain configuration
 */
export interface DomainConfig {
  domain: string;
  userId: string;
  createdAt: number;
  verified: boolean;
  sslEnabled: boolean;
}

/**
 * Domain storage interface
 */
export interface DomainStorage {
  setDomain(domain: string, config: DomainConfig): Promise<void>;
  getDomain(domain: string): Promise<DomainConfig | null>;
  listDomains(userId: string): Promise<DomainConfig[]>;
  deleteDomain(domain: string): Promise<void>;
}

/**
 * KV-based domain storage
 */
export class KVDomainStorage implements DomainStorage {
  constructor(private kv: KVNamespace) {}

  private getDomainKey(domain: string): string {
    return `domain:${domain}`;
  }

  async setDomain(domain: string, config: DomainConfig): Promise<void> {
    await this.kv.put(this.getDomainKey(domain), JSON.stringify(config));
  }

  async getDomain(domain: string): Promise<DomainConfig | null> {
    const data = await this.kv.get(this.getDomainKey(domain), "json");
    return data as DomainConfig | null;
  }

  async listDomains(_userId: string): Promise<DomainConfig[]> {
    // Note: KV doesn't support efficient listing
    // For production, consider using Durable Objects or external DB
    return [];
  }

  async deleteDomain(domain: string): Promise<void> {
    await this.kv.delete(this.getDomainKey(domain));
  }
}

/**
 * Extended URLData with custom domain support
 */
export interface URLDataWithDomain extends URLData {
  customDomain?: string;
}

/**
 * Handler for POST /api/domains
 * Registers a custom domain
 */
export async function handleRegisterDomain(
  request: Request,
  storage: DomainStorage,
  userId: string
): Promise<Response> {
  // Parse request body
  let body: { domain: string };
  try {
    body = await request.json();
  } catch (error) {
    throw Errors.badRequest("Invalid JSON in request body");
  }

  if (!body.domain) {
    throw Errors.badRequest("Missing required field: domain");
  }

  // Validate domain format
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  if (!domainRegex.test(body.domain)) {
    throw Errors.badRequest("Invalid domain format");
  }

  // Check if domain already exists
  const existing = await storage.getDomain(body.domain);
  if (existing) {
    throw Errors.badRequest("Domain is already registered");
  }

  // Create domain configuration
  const config: DomainConfig = {
    domain: body.domain,
    userId,
    createdAt: Date.now(),
    verified: false,
    sslEnabled: false,
  };

  await storage.setDomain(body.domain, config);

  return new Response(
    JSON.stringify({
      domain: body.domain,
      verified: false,
      message: "Domain registered. Add a CNAME record pointing to your worker domain to verify.",
      verificationRecord: {
        type: "CNAME",
        name: body.domain,
        value: "your-worker.workers.dev",
      },
    }, null, 2),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Handler for GET /api/domains
 * Lists user's custom domains
 */
export async function handleListDomains(
  storage: DomainStorage,
  userId: string
): Promise<Response> {
  const domains = await storage.listDomains(userId);

  return new Response(
    JSON.stringify({
      domains,
    }, null, 2),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Handler for POST /api/domains/:domain/verify
 * Verifies domain ownership via DNS check
 */
export async function handleVerifyDomain(
  domain: string,
  storage: DomainStorage
): Promise<Response> {
  const config = await storage.getDomain(domain);
  if (!config) {
    throw Errors.notFound("Domain not found");
  }

  // In a real implementation, you would:
  // 1. Check DNS records to verify CNAME is pointing to your worker
  // 2. Check SSL certificate status
  // 3. Update verification status

  // For this demo, we'll simulate verification
  config.verified = true;
  config.sslEnabled = true;
  await storage.setDomain(domain, config);

  return new Response(
    JSON.stringify({
      domain,
      verified: true,
      sslEnabled: true,
      message: "Domain verified successfully",
    }, null, 2),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Handler for DELETE /api/domains/:domain
 * Removes a custom domain
 */
export async function handleDeleteDomain(
  domain: string,
  storage: DomainStorage,
  userId: string
): Promise<Response> {
  const config = await storage.getDomain(domain);
  if (!config) {
    throw Errors.notFound("Domain not found");
  }

  // Check ownership
  if (config.userId !== userId) {
    throw Errors.forbidden("You don't own this domain");
  }

  await storage.deleteDomain(domain);

  return new Response(
    JSON.stringify({
      message: "Domain deleted successfully",
    }, null, 2),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Handler for POST /shorten with custom domain
 * Creates a short URL with a custom domain
 */
export async function createShortUrlWithDomain(
  urlData: URLData,
  customDomain: string,
  domainStorage: DomainStorage
): Promise<string> {
  // Verify domain exists and is verified
  const domainConfig = await domainStorage.getDomain(customDomain);
  if (!domainConfig) {
    throw Errors.badRequest("Custom domain not found");
  }

  if (!domainConfig.verified) {
    throw Errors.badRequest("Custom domain is not verified");
  }

  // Add custom domain to URL data
  if (!urlData.metadata) {
    urlData.metadata = {};
  }
  urlData.metadata.customDomain = customDomain;

  // Build short URL with custom domain
  const protocol = domainConfig.sslEnabled ? "https" : "http";
  return `${protocol}://${customDomain}/${urlData.shortCode}`;
}

/**
 * Resolve custom domain from request
 * Checks if the request is coming from a custom domain
 */
export function resolveCustomDomain(request: Request): string | null {
  const url = new URL(request.url);
  const host = url.hostname;

  // Check if it's not the default worker domain
  if (!host.endsWith(".workers.dev")) {
    return host;
  }

  return null;
}
