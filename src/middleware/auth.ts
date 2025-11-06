/**
 * API Key Authentication Middleware
 * Provides authentication for API endpoints
 */

import { Errors } from "./errors";

/**
 * API Key storage interface
 */
export interface APIKeyStorage {
  validateKey(apiKey: string): Promise<APIKeyData | null>;
  createKey(name: string, permissions: string[]): Promise<APIKeyData>;
  revokeKey(apiKey: string): Promise<void>;
  listKeys(): Promise<APIKeyData[]>;
}

/**
 * API Key data
 */
export interface APIKeyData {
  key: string;
  name: string;
  permissions: string[];
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
  revoked: boolean;
}

/**
 * KV-based API key storage
 */
export class KVAPIKeyStorage implements APIKeyStorage {
  constructor(private kv: KVNamespace) {}

  private getKeyName(apiKey: string): string {
    return `apikey:${apiKey}`;
  }

  async validateKey(apiKey: string): Promise<APIKeyData | null> {
    const key = await this.kv.get(this.getKeyName(apiKey), "json");
    if (!key) return null;

    const keyData = key as APIKeyData;

    // Check if revoked
    if (keyData.revoked) {
      return null;
    }

    // Check if expired
    if (keyData.expiresAt && keyData.expiresAt < Date.now()) {
      return null;
    }

    // Update last used timestamp
    keyData.lastUsedAt = Date.now();
    await this.kv.put(this.getKeyName(apiKey), JSON.stringify(keyData));

    return keyData;
  }

  async createKey(name: string, permissions: string[]): Promise<APIKeyData> {
    // Generate a secure random API key
    const apiKey = generateAPIKey();

    const keyData: APIKeyData = {
      key: apiKey,
      name,
      permissions,
      createdAt: Date.now(),
      revoked: false,
    };

    await this.kv.put(this.getKeyName(apiKey), JSON.stringify(keyData));

    return keyData;
  }

  async revokeKey(apiKey: string): Promise<void> {
    const keyData = await this.kv.get(this.getKeyName(apiKey), "json");
    if (keyData) {
      (keyData as APIKeyData).revoked = true;
      await this.kv.put(this.getKeyName(apiKey), JSON.stringify(keyData));
    }
  }

  async listKeys(): Promise<APIKeyData[]> {
    // Note: KV doesn't support efficient listing
    // For production, consider using Durable Objects or external DB
    return [];
  }
}

/**
 * Generate a secure API key
 */
function generateAPIKey(): string {
  const prefix = "sk";
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const randomString = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${randomString}`;
}

/**
 * Authentication middleware
 * Validates API key from Authorization header or query parameter
 *
 * @param request HTTP request
 * @param storage API key storage
 * @param requiredPermissions Required permissions for this endpoint
 * @returns null if authenticated, Response if authentication failed
 */
export async function authenticate(
  request: Request,
  storage: APIKeyStorage,
  requiredPermissions: string[] = []
): Promise<{ authenticated: true; keyData: APIKeyData } | { authenticated: false; response: Response }> {
  // Extract API key from Authorization header or query parameter
  let apiKey: string | null = null;

  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      apiKey = match[1];
    }
  }

  // Try X-API-Key header
  if (!apiKey) {
    apiKey = request.headers.get("X-API-Key");
  }

  // Try query parameter (less secure, but convenient for testing)
  if (!apiKey) {
    const url = new URL(request.url);
    apiKey = url.searchParams.get("api_key");
  }

  // No API key provided
  if (!apiKey) {
    return {
      authenticated: false,
      response: new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "API key required. Provide via Authorization header, X-API-Key header, or api_key query parameter.",
          statusCode: 401,
        }, null, 2),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": "Bearer",
          },
        }
      ),
    };
  }

  // Validate API key
  const keyData = await storage.validateKey(apiKey);
  if (!keyData) {
    return {
      authenticated: false,
      response: new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or expired API key",
          statusCode: 401,
        }, null, 2),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      ),
    };
  }

  // Check permissions
  if (requiredPermissions.length > 0) {
    const hasPermission = requiredPermissions.every(
      perm => keyData.permissions.includes(perm) || keyData.permissions.includes("*")
    );

    if (!hasPermission) {
      return {
        authenticated: false,
        response: new Response(
          JSON.stringify({
            error: "Forbidden",
            message: `Insufficient permissions. Required: ${requiredPermissions.join(", ")}`,
            statusCode: 403,
          }, null, 2),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
            },
          }
        ),
      };
    }
  }

  return {
    authenticated: true,
    keyData,
  };
}

/**
 * Handler for POST /api/keys
 * Creates a new API key
 */
export async function handleCreateAPIKey(
  request: Request,
  storage: APIKeyStorage,
  masterKey: string
): Promise<Response> {
  // Verify master key
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${masterKey}`) {
    throw Errors.unauthorized("Invalid master key");
  }

  // Parse request body
  let body: { name: string; permissions?: string[]; expiresIn?: number };
  try {
    body = await request.json();
  } catch (error) {
    throw Errors.badRequest("Invalid JSON in request body");
  }

  if (!body.name) {
    throw Errors.badRequest("Missing required field: name");
  }

  const permissions = body.permissions || ["shorten", "stats"];
  const keyData = await storage.createKey(body.name, permissions);

  // Apply expiration if specified
  if (body.expiresIn) {
    keyData.expiresAt = Date.now() + body.expiresIn * 1000;
  }

  return new Response(
    JSON.stringify({
      apiKey: keyData.key,
      name: keyData.name,
      permissions: keyData.permissions,
      createdAt: keyData.createdAt,
      expiresAt: keyData.expiresAt,
      message: "Store this API key securely. It will not be shown again.",
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
 * Handler for DELETE /api/keys/:key
 * Revokes an API key
 */
export async function handleRevokeAPIKey(
  apiKey: string,
  storage: APIKeyStorage,
  masterKey: string,
  request: Request
): Promise<Response> {
  // Verify master key
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${masterKey}`) {
    throw Errors.unauthorized("Invalid master key");
  }

  await storage.revokeKey(apiKey);

  return new Response(
    JSON.stringify({
      message: "API key revoked successfully",
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
 * Handler for GET /api/keys
 * Lists all API keys (without revealing the keys)
 */
export async function handleListAPIKeys(
  storage: APIKeyStorage,
  masterKey: string,
  request: Request
): Promise<Response> {
  // Verify master key
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${masterKey}`) {
    throw Errors.unauthorized("Invalid master key");
  }

  const keys = await storage.listKeys();

  // Mask the actual keys
  const maskedKeys = keys.map(k => ({
    name: k.name,
    keyPreview: k.key.substring(0, 10) + "...",
    permissions: k.permissions,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    revoked: k.revoked,
  }));

  return new Response(
    JSON.stringify({
      keys: maskedKeys,
    }, null, 2),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
