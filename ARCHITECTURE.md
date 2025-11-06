# URL Shortener - Architecture Design

## Overview

This URL shortener is designed with a **platform-agnostic storage interface** to enable easy migration between different deployment models:
- **Current**: Cloudflare Workers + KV Store (serverless, edge-deployed)
- **Future**: Go + Docker + Redis (self-hosted, traditional backend)

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
├── src/
│   ├── index.ts           # Worker entry point
│   ├── storage/
│   │   ├── interface.ts   # Storage interface definition
│   │   └── kv.ts          # KV implementation
│   ├── shortener/
│   │   ├── algorithm.ts   # URL shortening logic
│   │   └── validator.ts   # URL validation
│   ├── handlers/
│   │   ├── shorten.ts     # POST /shorten
│   │   ├── redirect.ts    # GET /:shortCode
│   │   └── stats.ts       # GET /api/stats/:shortCode
│   └── middleware/
│       ├── ratelimit.ts   # Rate limiting
│       └── errors.ts      # Error handling
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

## Future Enhancements

- [ ] Analytics dashboard
- [ ] QR code generation
- [ ] Link preview (Open Graph)
- [ ] Bulk URL shortening
- [ ] API authentication
- [ ] Custom domains
- [ ] A/B testing for redirects
- [ ] Geographic routing
