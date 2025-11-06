import type { URLStorage } from "../storage";
import { Errors } from "../middleware";

/**
 * Response body for GET /api/stats/:shortCode
 */
export interface StatsResponse {
  shortCode: string;
  originalUrl: string;
  visitCount: number;
  createdAt: number;
  expiresAt?: number;
  customCode: boolean;
  isExpired: boolean;
}

/**
 * Handler for GET /api/stats/:shortCode
 * Returns analytics/statistics for a short URL
 *
 * @param shortCode Short code from URL path
 * @param storage Storage backend
 * @returns HTTP response with stats
 */
export async function handleStats(
  shortCode: string,
  storage: URLStorage
): Promise<Response> {
  // Retrieve URL data
  const urlData = await storage.get(shortCode);

  if (!urlData) {
    throw Errors.notFound(`Short URL '${shortCode}' not found`);
  }

  // Check if expired
  const isExpired = urlData.expiresAt ? Date.now() > urlData.expiresAt : false;

  // Build response
  const response: StatsResponse = {
    shortCode: urlData.shortCode,
    originalUrl: urlData.originalUrl,
    visitCount: urlData.visitCount,
    createdAt: urlData.createdAt,
    expiresAt: urlData.expiresAt,
    customCode: urlData.customCode,
    isExpired,
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}
