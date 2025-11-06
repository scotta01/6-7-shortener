/**
 * Link Preview (Open Graph) Handler
 * Fetches and stores Open Graph metadata for URLs
 */

import type { URLStorage } from "../storage";
import { Errors } from "../middleware";

/**
 * Open Graph metadata
 */
export interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  url?: string;
}

/**
 * Extract Open Graph tags from HTML
 */
function extractOpenGraphTags(html: string): OpenGraphData {
  const ogData: OpenGraphData = {};

  // Match og:title
  const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                     html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["'][^>]*>/i);
  if (titleMatch) ogData.title = titleMatch[1];

  // Match og:description
  const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["'][^>]*>/i);
  if (descMatch) ogData.description = descMatch[1];

  // Match og:image
  const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                     html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["'][^>]*>/i);
  if (imageMatch) ogData.image = imageMatch[1];

  // Match og:site_name
  const siteMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:site_name["'][^>]*>/i);
  if (siteMatch) ogData.siteName = siteMatch[1];

  // Match og:type
  const typeMatch = html.match(/<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:type["'][^>]*>/i);
  if (typeMatch) ogData.type = typeMatch[1];

  // Match og:url
  const urlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                   html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:url["'][^>]*>/i);
  if (urlMatch) ogData.url = urlMatch[1];

  // Fallback to <title> tag if og:title not found
  if (!ogData.title) {
    const titleTagMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (titleTagMatch) ogData.title = titleTagMatch[1];
  }

  // Fallback to meta description if og:description not found
  if (!ogData.description) {
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                          html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
    if (metaDescMatch) ogData.description = metaDescMatch[1];
  }

  return ogData;
}

/**
 * Fetch Open Graph metadata from URL
 */
export async function fetchOpenGraphData(url: string): Promise<OpenGraphData> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "URL-Shortener-Bot/1.0 (OpenGraph metadata fetcher)",
      },
      // Only fetch the first 50KB to avoid large downloads
      cf: {
        cacheTtl: 3600,
      } as any,
    });

    if (!response.ok) {
      return {};
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return {};
    }

    // Read only first 50KB
    const reader = response.body?.getReader();
    if (!reader) return {};

    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    const maxLength = 50 * 1024; // 50KB

    while (totalLength < maxLength) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }

    reader.cancel();

    // Decode to text
    const decoder = new TextDecoder("utf-8");
    const html = decoder.decode(Buffer.concat(chunks));

    return extractOpenGraphTags(html);
  } catch (error) {
    // Silently fail - OG data is optional
    return {};
  }
}

/**
 * Handler for GET /:shortCode/preview
 * Returns preview metadata for a shortened URL
 */
export async function handlePreview(
  shortCode: string,
  storage: URLStorage
): Promise<Response> {
  // Get URL data
  const urlData = await storage.get(shortCode);
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  // Check if expired
  if (urlData.expiresAt && urlData.expiresAt < Date.now()) {
    throw Errors.gone("This URL has expired");
  }

  // Get or fetch OG data
  let ogData: OpenGraphData = {};

  if (urlData.metadata && urlData.metadata.openGraph) {
    ogData = urlData.metadata.openGraph as OpenGraphData;
  } else {
    // Fetch OG data
    ogData = await fetchOpenGraphData(urlData.originalUrl);

    // Store it for future requests
    if (Object.keys(ogData).length > 0) {
      urlData.metadata = {
        ...urlData.metadata,
        openGraph: ogData,
      };
      await storage.set(shortCode, urlData);
    }
  }

  return new Response(
    JSON.stringify({
      shortCode,
      originalUrl: urlData.originalUrl,
      openGraph: ogData,
    }, null, 2),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}

/**
 * Handler for GET /:shortCode/card
 * Returns HTML preview card
 */
export async function handlePreviewCard(
  shortCode: string,
  storage: URLStorage,
  baseUrl: string
): Promise<Response> {
  // Get URL data
  const urlData = await storage.get(shortCode);
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  // Check if expired
  if (urlData.expiresAt && urlData.expiresAt < Date.now()) {
    throw Errors.gone("This URL has expired");
  }

  // Get or fetch OG data
  let ogData: OpenGraphData = {};

  if (urlData.metadata && urlData.metadata.openGraph) {
    ogData = urlData.metadata.openGraph as OpenGraphData;
  } else {
    ogData = await fetchOpenGraphData(urlData.originalUrl);
  }

  const shortUrl = `${baseUrl}/${shortCode}`;
  const title = ogData.title || urlData.originalUrl;
  const description = ogData.description || "Click to visit the shortened URL";
  const image = ogData.image || "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(shortUrl)}" />
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
  <meta property="og:type" content="${ogData.type || 'website'}" />
  ${ogData.siteName ? `<meta property="og:site_name" content="${escapeHtml(ogData.siteName)}" />` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}

  <!-- Redirect after 2 seconds -->
  <meta http-equiv="refresh" content="2;url=${escapeHtml(urlData.originalUrl)}" />

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 20px;
    }

    .card {
      background: white;
      border-radius: 12px;
      max-width: 600px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .image {
      width: 100%;
      height: 300px;
      object-fit: cover;
      background: #f0f0f0;
    }

    .content {
      padding: 30px;
    }

    h1 {
      margin: 0 0 15px 0;
      color: #333;
      font-size: 1.8em;
    }

    p {
      margin: 0 0 20px 0;
      color: #666;
      line-height: 1.6;
    }

    .redirect {
      color: #667eea;
      font-size: 0.9em;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #667eea;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="card">
    ${image ? `<img class="image" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />` : ''}
    <div class="content">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p class="redirect">
        <span class="spinner"></span>
        Redirecting to destination...
      </p>
    </div>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Polyfill for Buffer.concat if not available
 */
const Buffer = {
  concat(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
};
