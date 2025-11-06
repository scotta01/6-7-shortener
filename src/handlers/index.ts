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

export {
  handleDashboard,
  handleDashboardData,
} from "./dashboard";

export {
  handleQRCode,
  type ShortenWithQRResponse,
} from "./qrcode";

export {
  handlePreview,
  handlePreviewCard,
  fetchOpenGraphData,
  type OpenGraphData,
} from "./preview";

export {
  handleBulkShorten,
  type BulkShortenRequest,
  type BulkShortenResponse,
  type BulkUrlRequest,
  type BulkUrlResult,
} from "./bulk";

export {
  handleRegisterDomain,
  handleListDomains,
  handleVerifyDomain,
  handleDeleteDomain,
  createShortUrlWithDomain,
  resolveCustomDomain,
  KVDomainStorage,
  type DomainConfig,
  type DomainStorage,
  type URLDataWithDomain,
} from "./domains";

export {
  handleConfigureABTest,
  handleGetABTest,
  handleABTestRedirect,
  handleDisableABTest,
  type ABTestVariant,
  type ABTestConfig,
  type URLDataWithABTest,
} from "./abtest";

export {
  handleConfigureGeoRouting,
  handleGetGeoRouting,
  handleGeoRoutedRedirect,
  handleDisableGeoRouting,
  extractGeoInfo,
  type GeoRoute,
  type GeoRoutingConfig,
  type URLDataWithGeoRouting,
  type GeoInfo,
} from "./georoute";
