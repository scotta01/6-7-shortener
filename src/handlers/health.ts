/**
 * Health check response
 */
export interface HealthResponse {
  status: "ok" | "error";
  timestamp: number;
  version: string;
  environment: string;
}

/**
 * Handler for GET /health
 * Returns health status of the service
 *
 * @param version Service version
 * @param environment Environment name
 * @returns HTTP response
 */
export async function handleHealth(
  version: string = "1.0.0",
  environment: string = "development"
): Promise<Response> {
  const response: HealthResponse = {
    status: "ok",
    timestamp: Date.now(),
    version,
    environment,
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}
