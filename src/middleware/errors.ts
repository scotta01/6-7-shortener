/**
 * Error handling utilities for the URL shortener
 */

/**
 * HTTP error with status code
 */
export class HTTPError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "HTTPError";
  }
}

/**
 * Error response body
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

/**
 * Create a JSON error response
 *
 * @param error Error object or message
 * @param statusCode HTTP status code
 * @returns Response object
 */
export function createErrorResponse(
  error: Error | string,
  statusCode: number = 500
): Response {
  const message = error instanceof Error ? error.message : error;
  const errorType = statusCode >= 500 ? "Internal Server Error" : "Bad Request";

  const body: ErrorResponse = {
    error: errorType,
    message,
    statusCode,
  };

  // Add details if HTTPError
  if (error instanceof HTTPError && error.details) {
    body.details = error.details;
  }

  return new Response(JSON.stringify(body, null, 2), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Handle errors and convert to appropriate HTTP response
 *
 * @param error Error object
 * @returns Response object
 */
export function handleError(error: unknown): Response {
  console.error("Error:", error);

  if (error instanceof HTTPError) {
    return createErrorResponse(error, error.statusCode);
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes("not found")) {
      return createErrorResponse(error, 404);
    }

    if (
      error.message.includes("invalid") ||
      error.message.includes("validation")
    ) {
      return createErrorResponse(error, 400);
    }

    // Default to 500
    return createErrorResponse(error, 500);
  }

  // Unknown error type
  return createErrorResponse("An unexpected error occurred", 500);
}

/**
 * Common HTTP errors (factory functions)
 */
export const Errors = {
  badRequest: (message: string, details?: unknown) =>
    new HTTPError(400, message, details),

  unauthorized: (message: string = "Unauthorized") =>
    new HTTPError(401, message),

  forbidden: (message: string = "Forbidden") =>
    new HTTPError(403, message),

  notFound: (message: string = "Resource not found") =>
    new HTTPError(404, message),

  gone: (message: string = "Resource no longer available") =>
    new HTTPError(410, message),

  tooManyRequests: (message: string = "Rate limit exceeded") =>
    new HTTPError(429, message),

  internalServerError: (message: string = "Internal server error") =>
    new HTTPError(500, message),

  internalError: (message: string = "Internal server error") =>
    new HTTPError(500, message),
};
