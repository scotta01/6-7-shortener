/**
 * HTTP handlers exports
 */

export {
  handleShorten,
  type ShortenRequest,
  type ShortenResponse,
} from "./shorten";

export { handleRedirect } from "./redirect";

export {
  handleStats,
  type StatsResponse,
} from "./stats";

export {
  handleHealth,
  type HealthResponse,
} from "./health";
