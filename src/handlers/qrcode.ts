/**
 * QR Code Generation Handler
 * Generates QR codes for shortened URLs
 */

import type { URLStorage } from "../storage";
import { Errors } from "../middleware";

/**
 * Generate QR code SVG
 * Uses a simple algorithm to generate QR codes as SVG
 * For production, consider using a QR code API service
 */
function generateQRCodeSVG(url: string, size: number = 300): string {
  // For simplicity, we'll use the Google Charts API approach
  // In production, you might want to use a dedicated QR library
  // or implement a full QR code algorithm

  // Simple SVG QR code using data matrix
  // This is a placeholder - for real QR codes, use a proper library
  const qrSize = Math.floor(size / 10);
  const moduleSize = size / qrSize;

  // Simple hash-based pattern generation (not a real QR code algorithm)
  // For production, integrate with qrcode.js or similar
  const matrix: boolean[][] = [];
  for (let i = 0; i < qrSize; i++) {
    matrix[i] = [];
    for (let j = 0; j < qrSize; j++) {
      // Simple pattern based on URL hash and position
      const hash = (url.charCodeAt(i % url.length) + i * j) % 2;
      matrix[i][j] = hash === 1;
    }
  }

  // Generate SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;

  for (let i = 0; i < qrSize; i++) {
    for (let j = 0; j < qrSize; j++) {
      if (matrix[i][j]) {
        const x = j * moduleSize;
        const y = i * moduleSize;
        svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Use external QR code API (more reliable)
 */
async function generateQRCodeFromAPI(url: string, size: number = 300): Promise<Response> {
  // Use QR Server API (free, no API key required)
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  try {
    const response = await fetch(apiUrl);
    return new Response(response.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    throw Errors.internalError("Failed to generate QR code");
  }
}

/**
 * Handler for GET /:shortCode/qr
 * Generates QR code for a shortened URL
 */
export async function handleQRCode(
  shortCode: string,
  storage: URLStorage,
  baseUrl: string,
  format: string = "png",
  size: number = 300
): Promise<Response> {
  // Validate size
  if (size < 100 || size > 1000) {
    throw Errors.badRequest("QR code size must be between 100 and 1000 pixels");
  }

  // Check if URL exists
  const urlData = await storage.get(shortCode);
  if (!urlData) {
    throw Errors.notFound(`Short code '${shortCode}' not found`);
  }

  // Check if expired
  if (urlData.expiresAt && urlData.expiresAt < Date.now()) {
    throw Errors.gone("This URL has expired");
  }

  // Build short URL
  const shortUrl = `${baseUrl}/${shortCode}`;

  // Generate QR code
  if (format === "svg") {
    const svg = generateQRCodeSVG(shortUrl, size);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } else {
    // Use external API for PNG
    return await generateQRCodeFromAPI(shortUrl, size);
  }
}

/**
 * Handler for POST /shorten with QR code generation
 * Returns both short URL and QR code
 */
export interface ShortenWithQRResponse {
  shortCode: string;
  shortUrl: string;
  qrCodeUrl: string;
  originalUrl: string;
  createdAt: number;
  expiresAt?: number;
}
