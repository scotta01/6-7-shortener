/**
 * A/B Testing for Redirects
 * Allows splitting traffic between multiple destination URLs
 */

import type { URLStorage, URLData } from "../storage";
import { Errors } from "../middleware";

/**
 * A/B test variant
 */
export interface ABTestVariant {
  url: string;
  weight: number; // 0-100, percentage of traffic
  name?: string;
  visitCount?: number;
}

/**
 * A/B test configuration
 */
export interface ABTestConfig {
  enabled: boolean;
  variants: ABTestVariant[];
  totalVisits?: number;
}

/**
 * Extended URLData with A/B testing support
 */
export interface URLDataWithABTest extends URLData {
  abTest?: ABTestConfig;
}

/**
 * Select a variant based on weights
 */
function selectVariant(variants: ABTestVariant[]): ABTestVariant {
  // Calculate total weight
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

  // Generate random number 0-100
  const random = Math.random() * totalWeight;

  // Select variant based on cumulative weights
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (random <= cumulative) {
      return variant;
    }
  }

  // Fallback to first variant
  return variants[0];
}

/**
 * Handler for POST /api/abtest/:shortCode
 * Configures A/B testing for a short URL
 */
export async function handleConfigureABTest(
  shortCode: string,
  request: Request,
  storage: URLStorage
): Promise<Response> {
  // Get existing URL data
  const urlData = await storage.get(shortCode) as URLDataWithABTest | null;
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  // Parse request body
  let body: { enabled: boolean; variants?: ABTestVariant[] };
  try {
    body = await request.json();
  } catch (error) {
    throw Errors.badRequest("Invalid JSON in request body");
  }

  // Validate variants if provided
  if (body.variants) {
    if (!Array.isArray(body.variants) || body.variants.length < 2) {
      throw Errors.badRequest("At least 2 variants are required for A/B testing");
    }

    if (body.variants.length > 10) {
      throw Errors.badRequest("Maximum 10 variants allowed");
    }

    // Validate each variant
    for (const variant of body.variants) {
      if (!variant.url) {
        throw Errors.badRequest("Each variant must have a URL");
      }
      if (typeof variant.weight !== "number" || variant.weight < 0 || variant.weight > 100) {
        throw Errors.badRequest("Variant weight must be a number between 0 and 100");
      }
    }

    // Validate total weight
    const totalWeight = body.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw Errors.badRequest(`Total weight must equal 100 (current: ${totalWeight})`);
    }

    // Initialize visit counts
    body.variants.forEach(v => {
      if (v.visitCount === undefined) {
        v.visitCount = 0;
      }
    });
  }

  // Update A/B test configuration
  if (!urlData.metadata) {
    urlData.metadata = {};
  }

  urlData.abTest = {
    enabled: body.enabled,
    variants: body.variants || urlData.abTest?.variants || [],
    totalVisits: urlData.abTest?.totalVisits || 0,
  };

  // Save updated URL data
  await storage.set(shortCode, urlData);

  return new Response(
    JSON.stringify({
      shortCode,
      abTest: urlData.abTest,
      message: "A/B test configured successfully",
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
 * Handler for GET /api/abtest/:shortCode
 * Gets A/B testing configuration and statistics
 */
export async function handleGetABTest(
  shortCode: string,
  storage: URLStorage
): Promise<Response> {
  const urlData = await storage.get(shortCode) as URLDataWithABTest | null;
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  const abTest = urlData.abTest || {
    enabled: false,
    variants: [],
  };

  // Calculate statistics
  const stats = {
    enabled: abTest.enabled,
    totalVisits: abTest.totalVisits || 0,
    variants: abTest.variants.map(v => ({
      name: v.name || "Unnamed",
      url: v.url,
      weight: v.weight,
      visits: v.visitCount || 0,
      percentage: abTest.totalVisits ? ((v.visitCount || 0) / abTest.totalVisits * 100).toFixed(2) : "0.00",
    })),
  };

  return new Response(
    JSON.stringify({
      shortCode,
      abTest: stats,
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
 * Handle redirect with A/B testing
 * Called from the redirect handler when A/B testing is enabled
 */
export async function handleABTestRedirect(
  shortCode: string,
  storage: URLStorage
): Promise<Response> {
  const urlData = await storage.get(shortCode) as URLDataWithABTest | null;
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  // Check if expired
  if (urlData.expiresAt && urlData.expiresAt < Date.now()) {
    throw Errors.gone("This URL has expired");
  }

  // Check if A/B testing is enabled
  if (!urlData.abTest || !urlData.abTest.enabled || urlData.abTest.variants.length === 0) {
    // Fall back to original URL
    await storage.incrementStats(shortCode);
    return new Response(null, {
      status: 302,
      headers: {
        Location: urlData.originalUrl,
      },
    });
  }

  // Select variant
  const selectedVariant = selectVariant(urlData.abTest.variants);

  // Update statistics (async, don't wait)
  updateABTestStats(shortCode, selectedVariant, storage).catch(() => {
    // Ignore errors in stats update
  });

  // Redirect to selected variant
  return new Response(null, {
    status: 302,
    headers: {
      Location: selectedVariant.url,
      "X-AB-Variant": selectedVariant.name || "unnamed",
    },
  });
}

/**
 * Update A/B test statistics
 */
async function updateABTestStats(
  shortCode: string,
  selectedVariant: ABTestVariant,
  storage: URLStorage
): Promise<void> {
  const urlData = await storage.get(shortCode) as URLDataWithABTest | null;
  if (!urlData || !urlData.abTest) return;

  // Increment total visit count
  urlData.visitCount++;
  if (!urlData.abTest.totalVisits) {
    urlData.abTest.totalVisits = 0;
  }
  urlData.abTest.totalVisits++;

  // Increment variant visit count
  const variant = urlData.abTest.variants.find(v => v.url === selectedVariant.url);
  if (variant) {
    if (!variant.visitCount) {
      variant.visitCount = 0;
    }
    variant.visitCount++;
  }

  // Save updated data
  await storage.set(shortCode, urlData);
}

/**
 * Handler for DELETE /api/abtest/:shortCode
 * Disables A/B testing for a short URL
 */
export async function handleDisableABTest(
  shortCode: string,
  storage: URLStorage
): Promise<Response> {
  const urlData = await storage.get(shortCode) as URLDataWithABTest | null;
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  if (urlData.abTest) {
    urlData.abTest.enabled = false;
  }

  await storage.set(shortCode, urlData);

  return new Response(
    JSON.stringify({
      message: "A/B testing disabled",
    }, null, 2),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
