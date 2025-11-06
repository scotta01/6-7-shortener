/**
 * Geographic Routing Handler
 * Routes users to different URLs based on their geographic location
 */

import type { URLStorage, URLData } from "../storage";
import { Errors } from "../middleware";

/**
 * Geographic route configuration
 */
export interface GeoRoute {
  country?: string; // ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "JP")
  continent?: string; // Continent code (e.g., "NA", "EU", "AS")
  region?: string; // Region/state code
  url: string;
  name?: string;
  visitCount?: number;
}

/**
 * Geographic routing configuration
 */
export interface GeoRoutingConfig {
  enabled: boolean;
  routes: GeoRoute[];
  defaultUrl: string; // Fallback URL if no route matches
  totalVisits?: number;
}

/**
 * Extended URLData with geographic routing support
 */
export interface URLDataWithGeoRouting extends URLData {
  geoRouting?: GeoRoutingConfig;
}

/**
 * Geographic information from request
 * Cloudflare Workers provides this via request.cf
 */
export interface GeoInfo {
  country?: string;
  continent?: string;
  region?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
}

/**
 * Extract geographic information from Cloudflare request
 */
export function extractGeoInfo(request: Request): GeoInfo {
  // Cloudflare Workers adds geographic data to request.cf
  const cf = (request as any).cf;

  if (!cf) {
    return {};
  }

  return {
    country: cf.country,
    continent: cf.continent,
    region: cf.region,
    city: cf.city,
    latitude: cf.latitude,
    longitude: cf.longitude,
    timezone: cf.timezone,
  };
}

/**
 * Find matching route based on geographic information
 */
function findMatchingRoute(geoInfo: GeoInfo, routes: GeoRoute[]): GeoRoute | null {
  // Try exact match first (country + region)
  if (geoInfo.country && geoInfo.region) {
    const match = routes.find(
      r => r.country === geoInfo.country && r.region === geoInfo.region
    );
    if (match) return match;
  }

  // Try country match
  if (geoInfo.country) {
    const match = routes.find(r => r.country === geoInfo.country && !r.region);
    if (match) return match;
  }

  // Try continent match
  if (geoInfo.continent) {
    const match = routes.find(r => r.continent === geoInfo.continent);
    if (match) return match;
  }

  return null;
}

/**
 * Handler for POST /api/georoute/:shortCode
 * Configures geographic routing for a short URL
 */
export async function handleConfigureGeoRouting(
  shortCode: string,
  request: Request,
  storage: URLStorage
): Promise<Response> {
  // Get existing URL data
  const urlData = await storage.get(shortCode) as URLDataWithGeoRouting | null;
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  // Parse request body
  let body: { enabled: boolean; routes?: GeoRoute[]; defaultUrl?: string };
  try {
    body = await request.json();
  } catch (error) {
    throw Errors.badRequest("Invalid JSON in request body");
  }

  // Validate routes if provided
  if (body.routes) {
    if (!Array.isArray(body.routes)) {
      throw Errors.badRequest("Routes must be an array");
    }

    if (body.routes.length > 50) {
      throw Errors.badRequest("Maximum 50 geographic routes allowed");
    }

    // Validate each route
    for (const route of body.routes) {
      if (!route.url) {
        throw Errors.badRequest("Each route must have a URL");
      }

      // Validate country code format (ISO 3166-1 alpha-2)
      if (route.country && !/^[A-Z]{2}$/.test(route.country)) {
        throw Errors.badRequest(`Invalid country code: ${route.country}. Must be ISO 3166-1 alpha-2 (e.g., US, GB, JP)`);
      }

      // Validate continent code
      if (route.continent && !/^(AF|AN|AS|EU|NA|OC|SA)$/.test(route.continent)) {
        throw Errors.badRequest(`Invalid continent code: ${route.continent}. Must be one of: AF, AN, AS, EU, NA, OC, SA`);
      }

      // Initialize visit count
      if (route.visitCount === undefined) {
        route.visitCount = 0;
      }
    }
  }

  // Update geographic routing configuration
  if (!urlData.metadata) {
    urlData.metadata = {};
  }

  urlData.geoRouting = {
    enabled: body.enabled,
    routes: body.routes || urlData.geoRouting?.routes || [],
    defaultUrl: body.defaultUrl || urlData.originalUrl,
    totalVisits: urlData.geoRouting?.totalVisits || 0,
  };

  // Save updated URL data
  await storage.set(shortCode, urlData);

  return new Response(
    JSON.stringify({
      shortCode,
      geoRouting: urlData.geoRouting,
      message: "Geographic routing configured successfully",
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
 * Handler for GET /api/georoute/:shortCode
 * Gets geographic routing configuration and statistics
 */
export async function handleGetGeoRouting(
  shortCode: string,
  storage: URLStorage
): Promise<Response> {
  const urlData = await storage.get(shortCode) as URLDataWithGeoRouting | null;
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  const geoRouting = urlData.geoRouting || {
    enabled: false,
    routes: [],
    defaultUrl: urlData.originalUrl,
  };

  // Calculate statistics
  const stats = {
    enabled: geoRouting.enabled,
    totalVisits: geoRouting.totalVisits || 0,
    defaultUrl: geoRouting.defaultUrl,
    routes: geoRouting.routes.map(r => ({
      name: r.name || "Unnamed",
      country: r.country,
      continent: r.continent,
      region: r.region,
      url: r.url,
      visits: r.visitCount || 0,
      percentage: geoRouting.totalVisits ? ((r.visitCount || 0) / geoRouting.totalVisits * 100).toFixed(2) : "0.00",
    })),
  };

  return new Response(
    JSON.stringify({
      shortCode,
      geoRouting: stats,
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
 * Handle redirect with geographic routing
 * Called from the redirect handler when geographic routing is enabled
 */
export async function handleGeoRoutedRedirect(
  shortCode: string,
  request: Request,
  storage: URLStorage
): Promise<Response> {
  const urlData = await storage.get(shortCode) as URLDataWithGeoRouting | null;
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  // Check if expired
  if (urlData.expiresAt && urlData.expiresAt < Date.now()) {
    throw Errors.gone("This URL has expired");
  }

  // Check if geographic routing is enabled
  if (!urlData.geoRouting || !urlData.geoRouting.enabled || urlData.geoRouting.routes.length === 0) {
    // Fall back to original URL
    await storage.incrementStats(shortCode);
    return new Response(null, {
      status: 302,
      headers: {
        Location: urlData.originalUrl,
      },
    });
  }

  // Extract geographic information
  const geoInfo = extractGeoInfo(request);

  // Find matching route
  const matchedRoute = findMatchingRoute(geoInfo, urlData.geoRouting.routes);
  const targetUrl = matchedRoute ? matchedRoute.url : urlData.geoRouting.defaultUrl;

  // Update statistics (async, don't wait)
  updateGeoRoutingStats(shortCode, matchedRoute, geoInfo, storage).catch(() => {
    // Ignore errors in stats update
  });

  // Redirect to target URL
  return new Response(null, {
    status: 302,
    headers: {
      Location: targetUrl,
      "X-Geo-Country": geoInfo.country || "unknown",
      "X-Geo-Matched": matchedRoute ? "true" : "false",
    },
  });
}

/**
 * Update geographic routing statistics
 */
async function updateGeoRoutingStats(
  shortCode: string,
  matchedRoute: GeoRoute | null,
  _geoInfo: GeoInfo,
  storage: URLStorage
): Promise<void> {
  const urlData = await storage.get(shortCode) as URLDataWithGeoRouting | null;
  if (!urlData || !urlData.geoRouting) return;

  // Increment total visit count
  urlData.visitCount++;
  if (!urlData.geoRouting.totalVisits) {
    urlData.geoRouting.totalVisits = 0;
  }
  urlData.geoRouting.totalVisits++;

  // Increment route visit count
  if (matchedRoute) {
    const route = urlData.geoRouting.routes.find(r =>
      r.country === matchedRoute.country &&
      r.continent === matchedRoute.continent &&
      r.region === matchedRoute.region &&
      r.url === matchedRoute.url
    );
    if (route) {
      if (!route.visitCount) {
        route.visitCount = 0;
      }
      route.visitCount++;
    }
  }

  // Save updated data
  await storage.set(shortCode, urlData);
}

/**
 * Handler for DELETE /api/georoute/:shortCode
 * Disables geographic routing for a short URL
 */
export async function handleDisableGeoRouting(
  shortCode: string,
  storage: URLStorage
): Promise<Response> {
  const urlData = await storage.get(shortCode) as URLDataWithGeoRouting | null;
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  if (urlData.geoRouting) {
    urlData.geoRouting.enabled = false;
  }

  await storage.set(shortCode, urlData);

  return new Response(
    JSON.stringify({
      message: "Geographic routing disabled",
    }, null, 2),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
