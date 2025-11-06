import type { URLStorage } from "../storage";
import { Errors } from "../middleware";

/**
 * Handler for GET /:shortCode
 * Redirects to the original URL
 *
 * @param shortCode Short code from URL path
 * @param storage Storage backend
 * @returns HTTP response (redirect or error)
 */
export async function handleRedirect(
  shortCode: string,
  storage: URLStorage
): Promise<Response> {
  // Retrieve URL data
  const urlData = await storage.get(shortCode);

  if (!urlData) {
    throw Errors.notFound(`Short URL '${shortCode}' not found`);
  }

  // Check if expired
  if (urlData.expiresAt && Date.now() > urlData.expiresAt) {
    // Clean up expired URL
    await storage.delete(shortCode);
    throw Errors.gone(`Short URL '${shortCode}' has expired`);
  }

  // Increment visit counter
  // We await this to ensure consistency and test compatibility
  // In production, this is fast enough (<5ms) to not impact UX
  try {
    await storage.incrementStats(shortCode);
  } catch (error) {
    // Log but don't fail the redirect if stats update fails
    console.error(`Failed to increment stats for ${shortCode}:`, error);
  }

  // Redirect to original URL
  return new Response(null, {
    status: 302,
    headers: {
      Location: urlData.originalUrl,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
