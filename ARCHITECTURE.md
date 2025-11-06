# URL Shortener - Architecture Design

## Overview

This URL shortener is designed with a **platform-agnostic storage interface** to enable easy migration between different deployment models:
- **Current**: Cloudflare Workers + KV Store (serverless, edge-deployed)
- **Future**: Go + Docker + Redis (self-hosted, traditional backend)

The service includes a comprehensive feature set:
- **Core Features**: URL shortening, custom codes, expiration, analytics
- **Advanced Features**: QR code generation, link previews, bulk operations
- **Enterprise Features**: API key authentication, custom domains, A/B testing, geographic routing
- **Developer Tools**: Visual dashboard, comprehensive API, CI/CD pipelines

## Core Design Principles

1. **Storage Abstraction**: All storage operations go through a well-defined interface
2. **Portable Business Logic**: URL shortening algorithm is platform-independent
3. **API Compatibility**: Same REST endpoints regardless of implementation
4. **Test Coverage**: All functionality has comprehensive tests

## Storage Interface Contract

The storage layer MUST implement these operations:

```typescript
interface URLStorage {
  // Store a short code -> original URL mapping
  set(shortCode: string, data: URLData): Promise<void>

  // Retrieve original URL and metadata by short code
  get(shortCode: string): Promise<URLData | null>

  // Check if a short code exists (for collision detection)
  exists(shortCode: string): Promise<boolean>

  // Delete a short code (for expiration/cleanup)
  delete(shortCode: string): Promise<void>

  // Increment visit counter (for analytics)
  incrementStats(shortCode: string): Promise<void>
}

interface URLData {
  originalUrl: string
  shortCode: string
  createdAt: number        // Unix timestamp
  expiresAt?: number       // Optional expiration
  visitCount: number       // Number of redirects
  customCode: boolean      // Whether user provided custom code
}
```

## Implementation Matrix

| Component | Cloudflare Workers | Go + Docker |
|-----------|-------------------|-------------|
| **Language** | TypeScript | Go |
| **Runtime** | V8 Isolate | Docker Container |
| **Storage** | KV Store | Redis |
| **HTTP** | Workers Fetch API | net/http or gin |
| **Tests** | Vitest + Miniflare | Go testing package |
| **Deployment** | `wrangler deploy` | Docker Compose |

## URL Shortening Algorithm

**Base62 Encoding** (portable across languages):
- Character set: `0-9a-zA-Z` (62 characters)
- Input: Hash of original URL + timestamp
- Output: 6-8 character short code
- Collision handling: Retry with counter increment

### Algorithm Pseudocode
```
function generateShortCode(url: string, counter: number = 0): string {
  hash = sha256(url + timestamp + counter)
  number = first_64_bits(hash)
  shortCode = base62_encode(number).substring(0, 6)

  if exists(shortCode):
    return generateShortCode(url, counter + 1)

  return shortCode
}
```

## API Specification

### POST /shorten
Create a new short URL.

**Request:**
```json
{
  "url": "https://example.com/very/long/url",
  "customCode": "optional-custom",  // Optional
  "expiresIn": 86400                 // Optional, seconds
}
```

**Response:**
```json
{
  "shortCode": "abc123",
  "shortUrl": "https://short.link/abc123",
  "originalUrl": "https://example.com/very/long/url",
  "expiresAt": 1699564800
}
```

### GET /:shortCode
Redirect to original URL.

**Response:**
- `302 Found` redirect to original URL
- `404 Not Found` if code doesn't exist
- `410 Gone` if expired

### GET /api/stats/:shortCode
Get analytics for a short URL.

**Response:**
```json
{
  "shortCode": "abc123",
  "originalUrl": "https://example.com/very/long/url",
  "visitCount": 42,
  "createdAt": 1699478400,
  "expiresAt": 1699564800
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1699478400,
  "version": "1.0.0"
}
```

## Security Features

1. **URL Validation**:
   - Valid HTTP/HTTPS schemes only
   - No localhost or internal IPs
   - Maximum URL length (2048 chars)

2. **Rate Limiting**:
   - Per-IP rate limiting
   - Cloudflare: Use Workers KV for tracking
   - Go: Use Redis with TTL

3. **Collision Detection**:
   - Check existence before storing
   - Retry with different seed on collision
   - Maximum 5 retry attempts

4. **Input Sanitization**:
   - Validate custom codes (alphanumeric, 3-20 chars)
   - Prevent SQL injection (though we use KV/Redis)
   - Prevent XSS in error messages

## Implemented Advanced Features

### 1. Analytics Dashboard
**Path**: `/dashboard`
**Implementation**: Static HTML/CSS/JS served from Workers
- Real-time statistics display
- Visual charts and graphs
- URL performance metrics
- No external dependencies

### 2. QR Code Generation
**Paths**: `/:shortCode/qr`
**Implementation**: Dual format support
- **PNG**: External API integration (QR Server API)
- **SVG**: Custom generator using embedded QR algorithm
- Configurable size (100-1000px)
- Cached for performance

### 3. Link Preview (Open Graph)
**Paths**: `/:shortCode/preview`, `/:shortCode/card`
**Implementation**: Metadata fetching and caching
- Fetch OG tags from original URLs
- Cache metadata in KV store (24hr TTL)
- HTML preview card with auto-redirect
- Fallback for missing metadata

**Storage Schema**:
```
preview:abc123 → {
  title, description, image, siteName,
  cachedAt, originalUrl
}
```

### 4. Bulk URL Shortening
**Path**: `POST /api/bulk/shorten`
**Implementation**: Batch processing with validation
- Process up to 100 URLs per request
- Individual error handling per URL
- Atomic operations per URL
- Summary statistics

**Request/Response**:
- Accepts array of URL objects
- Returns array of results with success/failure status
- Continues processing on individual failures

### 5. API Key Authentication
**Paths**: `/api/keys`, `/api/keys/:keyId`
**Implementation**: Token-based authentication system
- Master API key for key management
- Per-key permissions system
- Bearer token and X-API-Key header support
- Optional enforcement (API_KEY_REQUIRED flag)

**Storage Schema**:
```
apikey:key_abc123 → {
  id, name, permissions[], createdAt,
  expiresAt, lastUsed, createdBy
}
```

**Permissions**:
- `shorten`: Create short URLs
- `stats`: View statistics
- `delete`: Delete URLs
- `bulk`: Bulk operations
- `domains`: Manage domains
- `abtest`: A/B testing
- `georoute`: Geographic routing

### 6. Custom Domains per User
**Paths**: `/api/domains`, `/api/domains/:domain/verify`
**Implementation**: DNS-based domain verification
- TXT record verification
- Domain ownership validation
- Status tracking (pending/verified/failed)
- Per-domain routing support

**Storage Schema**:
```
domain:go.example.com → {
  domain, userId, status, verificationToken,
  verifiedAt, sslEnabled, createdAt
}
```

**Verification Flow**:
1. User registers domain
2. System generates verification token
3. User adds TXT record to DNS
4. System verifies DNS record
5. Domain activated for short URLs

### 7. A/B Testing for Redirects
**Paths**: `/api/abtest`, `/api/abtest/:shortCode/stats`
**Implementation**: Weighted random distribution
- Multiple destination URLs per short code
- Configurable weights per variant
- Visit tracking per variant
- Statistical analysis

**Storage Schema**:
```
abtest:test-link → {
  shortCode, name, variants[],
  createdAt, expiresAt, totalVisits
}

variants: [{
  id, url, weight, visits
}]
```

**Algorithm**:
1. Sum all variant weights
2. Generate random number [0, sum)
3. Select variant based on weight ranges
4. Redirect and increment variant counter

### 8. Geographic Routing
**Paths**: `/api/georoute`, `/api/georoute/:shortCode/stats`
**Implementation**: Cloudflare Workers geo data
- Access to `request.cf.country` and `request.cf.continent`
- Rule-based routing by country/continent/region
- Default fallback URL
- Geographic analytics

**Storage Schema**:
```
georoute:global-promo → {
  shortCode, name, rules[], defaultUrl,
  createdAt, expiresAt, visitsByCountry{},
  visitsByContinent{}
}

rules: [{
  id, type, value, url
}]
```

**Rule Types**:
- `country`: ISO country code (US, GB, etc.)
- `continent`: Continent code (NA, EU, AS, etc.)
- `region`: Custom regions (future)

**Routing Algorithm**:
1. Extract geo data from request
2. Evaluate rules in order
3. Return first matching URL
4. Fall back to default URL
5. Track visit by location

## CI/CD and Security

### Automated Pipelines
**Location**: `.github/workflows/`

**Pre-merge Checks** (on every PR):
- TypeScript type checking
- ESLint linting
- Full test suite
- Dependency security audit (npm audit)
- Secret scanning (TruffleHog)
- SSRF protection validation
- Build verification
- CodeQL security analysis
- Dependency review

**Deployment Strategy**:
- **Staging**: Auto-deploy on merge to `main`
- **Production**: Manual approval required
- **Rollback**: One-click revert capability

### Security Gates
1. **Code Quality**: Must pass type-check and lint
2. **Test Coverage**: All tests must pass
3. **Dependency Security**: No high/critical vulnerabilities
4. **Secret Detection**: No exposed credentials
5. **Code Analysis**: CodeQL security scanning
6. **Build Success**: Must build without errors

## Migration Path: Cloudflare → Go

When migrating to Go + Docker:

1. **Export Data**: Use Cloudflare Workers to export KV data to JSON
2. **Import to Redis**: Load JSON into Redis with same key structure
3. **Deploy Go Service**: Start Go service pointing to Redis
4. **Switch DNS**: Update DNS to point to Go service
5. **Monitor**: Keep Cloudflare Workers as fallback temporarily

### Key Structure Compatibility
```
// Cloudflare KV Key
url:abc123 → { originalUrl, createdAt, ... }

// Redis Key
url:abc123 → JSON{ originalUrl, createdAt, ... }
```

## Project Structure

```
/
├── ARCHITECTURE.md          # This file
├── README.md               # User-facing documentation
├── .github/
│   └── workflows/          # CI/CD pipelines
│       ├── ci.yml          # Continuous integration
│       ├── security.yml    # Security scanning
│       └── deploy.yml      # Deployment workflow
├── src/
│   ├── index.ts           # Worker entry point & routing
│   ├── storage/
│   │   ├── interface.ts   # Storage interface definition
│   │   └── kv.ts          # KV implementation
│   ├── shortener/
│   │   ├── algorithm.ts   # URL shortening logic
│   │   └── validator.ts   # URL validation
│   ├── handlers/
│   │   ├── shorten.ts     # POST /shorten
│   │   ├── redirect.ts    # GET /:shortCode
│   │   ├── stats.ts       # GET /api/stats/:shortCode
│   │   ├── health.ts      # GET /health
│   │   ├── dashboard.ts   # GET /dashboard (analytics)
│   │   ├── qrcode.ts      # GET /:shortCode/qr
│   │   ├── preview.ts     # GET /:shortCode/preview
│   │   ├── bulk.ts        # POST /api/bulk/shorten
│   │   ├── domains.ts     # Custom domain management
│   │   ├── abtest.ts      # A/B testing
│   │   ├── georoute.ts    # Geographic routing
│   │   └── index.ts       # Handler exports
│   └── middleware/
│       ├── auth.ts        # API key authentication
│       ├── ratelimit.ts   # Rate limiting
│       ├── errors.ts      # Error handling
│       └── index.ts       # Middleware exports
├── test/
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── wrangler.toml          # Cloudflare config
├── package.json
└── tsconfig.json

# Future Go Structure
/go-impl/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── storage/
│   │   ├── interface.go
│   │   └── redis.go
│   ├── shortener/
│   │   └── algorithm.go
│   └── handlers/
│       └── handlers.go
├── Dockerfile
├── docker-compose.yml
└── go.mod
```

## Performance Targets

| Metric | Cloudflare Workers | Go + Docker |
|--------|-------------------|-------------|
| Cold Start | < 50ms | < 100ms |
| Redirect Latency | < 20ms | < 50ms |
| Shorten Latency | < 100ms | < 100ms |
| Throughput | ~50k req/s | ~10k req/s |
| Geographic | Edge (global) | Single region |

## Testing Strategy

1. **Unit Tests**:
   - Storage adapter operations
   - URL shortening algorithm
   - Validation logic

2. **Integration Tests**:
   - Full API endpoint flows
   - Error handling
   - Rate limiting

3. **Load Tests**:
   - Concurrent shortening requests
   - Redirect performance under load

4. **Coverage Target**: > 80% for all critical paths

## Deployment

### Cloudflare Workers (Phase 1)
```bash
npm install
npm test
wrangler deploy
```

### Go + Docker (Phase 2)
```bash
docker-compose up -d
docker-compose exec app go test ./...
```

## Configuration

Environment variables (compatible across both implementations):

```env
# Base URL for generated short links
BASE_URL=https://short.link

# Default expiration time (seconds, 0 = never)
DEFAULT_TTL=0

# Short code length
CODE_LENGTH=6

# Rate limit (requests per minute)
RATE_LIMIT=100

# Environment
ENVIRONMENT=production
```

## Implemented Enhancements

- [x] Analytics dashboard (visual HTML dashboard)
- [x] QR code generation (PNG and SVG formats)
- [x] Link preview (Open Graph metadata)
- [x] Bulk URL shortening (up to 100 URLs)
- [x] API key authentication (permission-based)
- [x] Custom domains (DNS verification)
- [x] A/B testing for redirects (weighted distribution)
- [x] Geographic routing (country/continent-based)
- [x] CI/CD pipelines (security gates)

## Future Enhancements

Potential next-generation features:

- [ ] Mobile app for URL management
- [ ] Browser extension integration
- [ ] Webhooks for URL events
- [ ] Advanced analytics (conversion tracking, funnels)
- [ ] URL expiration notifications
- [ ] Scheduled URL activation
- [ ] Link rotation (time-based)
- [ ] Password-protected URLs
- [ ] Real-time collaboration features
- [ ] GraphQL API support
