# URL Shortener

A lightweight, high-performance URL shortener built on Cloudflare Workers with a future migration path to Go + Docker.

## Features

- **Serverless & Fast**: Deployed on Cloudflare's edge network for sub-20ms redirects globally
- **Custom Short Codes**: Support for user-defined short codes
- **URL Expiration**: Set TTL for temporary links
- **Analytics Dashboard**: Visual dashboard with charts and real-time URL analytics
- **QR Code Generation**: Generate QR codes in PNG or SVG format for any short URL
- **Link Preview**: Fetch and display Open Graph metadata with preview cards
- **Bulk URL Shortening**: Process up to 100 URLs in a single request
- **API Key Authentication**: Secure API access with permission-based access control
- **Custom Domains**: Support for custom domains per user with DNS verification
- **A/B Testing**: Route traffic to multiple destinations with weighted distribution
- **Geographic Routing**: Route users based on country, continent, or region
- **Security**: Built-in SSRF protection, rate limiting, and input validation
- **Comprehensive Testing**: Unit and integration tests using Cloudflare Workers environment
- **CI/CD Pipelines**: Automated testing, security scanning, and deployment workflows
- **Future-Proof Architecture**: Designed for easy migration to Go + Redis

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (free tier works)
- Wrangler CLI

### Installation

```bash
# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Create KV namespace
npx wrangler kv:namespace create URL_STORE

# Update wrangler.toml with the KV namespace ID from the output above
```

### Local Development

```bash
# Start development server
npm run dev

# The service will be available at http://localhost:8787
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## CI/CD Pipelines

This project includes comprehensive CI/CD pipelines with security gates:

### Automated Testing (On Every PR)
- ✅ TypeScript type checking
- ✅ ESLint code linting
- ✅ Full test suite
- ✅ Dependency security scanning (npm audit)
- ✅ Secret scanning (TruffleHog)
- ✅ SSRF protection validation
- ✅ Build verification
- ✅ CodeQL security analysis
- ✅ Dependency review

### Deployment Strategy
- **Staging**: Automatic deployment on merge to `main`
- **Production**: Manual deployment with approval gates
- **Rollback**: One-click rollback to previous version

### Setup Instructions
See [CI/CD Setup Guide](./.github/CICD_SETUP.md) for:
- Required GitHub secrets configuration
- Branch protection rules
- Environment setup
- Deployment process
- Troubleshooting guide

## API Documentation

### Create Short URL

**POST** `/shorten`

Create a new short URL.

**Request:**
```json
{
  "url": "https://example.com/very/long/url",
  "customCode": "my-link",      // Optional
  "expiresIn": 86400             // Optional, seconds
}
```

**Response (201 Created):**
```json
{
  "shortCode": "my-link",
  "shortUrl": "https://short.link/my-link",
  "originalUrl": "https://example.com/very/long/url",
  "createdAt": 1699564800000,
  "expiresAt": 1699651200000
}
```

**Example:**
```bash
curl -X POST https://your-worker.workers.dev/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Redirect to Original URL

**GET** `/:shortCode`

Redirects to the original URL.

**Response:**
- `302 Found` - Redirects to original URL
- `404 Not Found` - Short code doesn't exist
- `410 Gone` - URL has expired

**Example:**
```bash
curl -L https://your-worker.workers.dev/abc123
# Redirects to original URL
```

### Get URL Statistics

**GET** `/api/stats/:shortCode`

Get analytics for a short URL.

**Response (200 OK):**
```json
{
  "shortCode": "abc123",
  "originalUrl": "https://example.com",
  "visitCount": 42,
  "createdAt": 1699564800000,
  "expiresAt": 1699651200000,
  "customCode": false,
  "isExpired": false
}
```

**Example:**
```bash
curl https://your-worker.workers.dev/api/stats/abc123
```

### Health Check

**GET** `/health`

Check service health.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": 1699564800000,
  "version": "1.0.0",
  "environment": "production"
}
```

### Analytics Dashboard

**GET** `/dashboard`

View a visual analytics dashboard with charts and statistics for all short URLs.

**Response:** HTML page with interactive dashboard

### Generate QR Code

**GET** `/:shortCode/qr`

Generate a QR code for a short URL.

**Query Parameters:**
- `format`: `png` (default) or `svg`
- `size`: Image size in pixels (100-1000, default: 300)

**Response:**
- `200 OK` - Returns QR code image (PNG or SVG)
- `404 Not Found` - Short code doesn't exist

**Example:**
```bash
# Get PNG QR code
curl https://your-worker.workers.dev/abc123/qr?format=png&size=400

# Get SVG QR code
curl https://your-worker.workers.dev/abc123/qr?format=svg
```

### Get Link Preview

**GET** `/:shortCode/preview`

Get Open Graph metadata for a short URL.

**Response (200 OK):**
```json
{
  "shortCode": "abc123",
  "originalUrl": "https://example.com",
  "metadata": {
    "title": "Example Domain",
    "description": "Example website description",
    "image": "https://example.com/image.jpg",
    "siteName": "Example"
  },
  "cachedAt": 1699564800000
}
```

**GET** `/:shortCode/card`

View a preview card page that displays the link preview and auto-redirects after 2 seconds.

**Response:** HTML preview card page

### Bulk URL Shortening

**POST** `/api/bulk/shorten`

Shorten multiple URLs in a single request (up to 100 URLs).

**Authentication:** Optional (if API_KEY_REQUIRED is enabled, requires API key)

**Request:**
```json
{
  "urls": [
    {
      "url": "https://example.com/page1",
      "customCode": "page1",
      "expiresIn": 86400
    },
    {
      "url": "https://example.com/page2"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "results": [
    {
      "success": true,
      "shortCode": "page1",
      "shortUrl": "https://short.link/page1",
      "originalUrl": "https://example.com/page1"
    },
    {
      "success": true,
      "shortCode": "xyz789",
      "shortUrl": "https://short.link/xyz789",
      "originalUrl": "https://example.com/page2"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

### API Key Management

#### Create API Key

**POST** `/api/keys`

Create a new API key (requires master API key).

**Authentication:** Master API Key required

**Request:**
```json
{
  "name": "My App",
  "permissions": ["shorten", "stats", "delete"],
  "expiresIn": 2592000
}
```

**Response (201 Created):**
```json
{
  "apiKey": "key_abc123xyz789",
  "name": "My App",
  "permissions": ["shorten", "stats", "delete"],
  "createdAt": 1699564800000,
  "expiresAt": 1702156800000
}
```

#### List API Keys

**GET** `/api/keys`

List all API keys (requires master API key).

**Authentication:** Master API Key required

**Response (200 OK):**
```json
{
  "keys": [
    {
      "id": "key_abc123",
      "name": "My App",
      "permissions": ["shorten", "stats"],
      "createdAt": 1699564800000,
      "lastUsed": 1699568400000
    }
  ]
}
```

#### Revoke API Key

**DELETE** `/api/keys/:keyId`

Revoke an API key (requires master API key).

**Authentication:** Master API Key required

**Response:** `204 No Content`

### Custom Domain Management

#### Register Domain

**POST** `/api/domains`

Register a custom domain (requires API key with domain permissions).

**Authentication:** API Key required

**Request:**
```json
{
  "domain": "go.example.com",
  "verificationMethod": "dns"
}
```

**Response (201 Created):**
```json
{
  "domain": "go.example.com",
  "status": "pending",
  "verificationToken": "verify_abc123",
  "verificationRecord": {
    "type": "TXT",
    "name": "_url-shortener-verify",
    "value": "verify_abc123"
  }
}
```

#### Verify Domain

**POST** `/api/domains/:domain/verify`

Verify domain ownership.

**Authentication:** API Key required

**Response (200 OK):**
```json
{
  "domain": "go.example.com",
  "status": "verified",
  "verifiedAt": 1699564800000
}
```

#### List Domains

**GET** `/api/domains`

List all custom domains for the authenticated user.

**Authentication:** API Key required

### A/B Testing

#### Create A/B Test

**POST** `/api/abtest`

Create an A/B test with multiple destination URLs.

**Authentication:** Optional (if API_KEY_REQUIRED is enabled, requires API key)

**Request:**
```json
{
  "shortCode": "test-link",
  "name": "Landing Page Test",
  "variants": [
    {
      "url": "https://example.com/landing-a",
      "weight": 50
    },
    {
      "url": "https://example.com/landing-b",
      "weight": 50
    }
  ],
  "expiresIn": 604800
}
```

**Response (201 Created):**
```json
{
  "shortCode": "test-link",
  "shortUrl": "https://short.link/test-link",
  "name": "Landing Page Test",
  "variants": [
    {
      "id": "var_1",
      "url": "https://example.com/landing-a",
      "weight": 50
    },
    {
      "id": "var_2",
      "url": "https://example.com/landing-b",
      "weight": 50
    }
  ],
  "createdAt": 1699564800000
}
```

#### Get A/B Test Statistics

**GET** `/api/abtest/:shortCode/stats`

Get detailed statistics for an A/B test.

**Response (200 OK):**
```json
{
  "shortCode": "test-link",
  "name": "Landing Page Test",
  "totalVisits": 1000,
  "variants": [
    {
      "id": "var_1",
      "url": "https://example.com/landing-a",
      "weight": 50,
      "visits": 503
    },
    {
      "id": "var_2",
      "url": "https://example.com/landing-b",
      "weight": 50,
      "visits": 497
    }
  ]
}
```

### Geographic Routing

#### Create Geographic Route

**POST** `/api/georoute`

Create a short URL with geographic routing rules.

**Authentication:** Optional (if API_KEY_REQUIRED is enabled, requires API key)

**Request:**
```json
{
  "shortCode": "global-promo",
  "name": "Global Promotion",
  "rules": [
    {
      "type": "country",
      "value": "US",
      "url": "https://example.com/us"
    },
    {
      "type": "continent",
      "value": "EU",
      "url": "https://example.com/eu"
    }
  ],
  "defaultUrl": "https://example.com/global",
  "expiresIn": 2592000
}
```

**Response (201 Created):**
```json
{
  "shortCode": "global-promo",
  "shortUrl": "https://short.link/global-promo",
  "name": "Global Promotion",
  "rules": [
    {
      "id": "rule_1",
      "type": "country",
      "value": "US",
      "url": "https://example.com/us"
    },
    {
      "id": "rule_2",
      "type": "continent",
      "value": "EU",
      "url": "https://example.com/eu"
    }
  ],
  "defaultUrl": "https://example.com/global"
}
```

#### Get Geographic Statistics

**GET** `/api/georoute/:shortCode/stats`

Get geographic distribution statistics.

**Response (200 OK):**
```json
{
  "shortCode": "global-promo",
  "totalVisits": 5000,
  "byCountry": {
    "US": 2000,
    "GB": 800,
    "DE": 600,
    "FR": 500,
    "other": 1100
  },
  "byContinent": {
    "NA": 2200,
    "EU": 2300,
    "AS": 400,
    "other": 100
  }
}
```

## Authentication

This service supports optional API key authentication for enhanced security.

### Configuration

Set the following environment variables in `wrangler.toml`:

```toml
[vars]
MASTER_API_KEY = "your-master-key-here"  # For managing API keys
API_KEY_REQUIRED = "false"               # Set to "true" to require API keys
```

### Using API Keys

Include your API key in requests using either method:

**Bearer Token:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  https://your-worker.workers.dev/shorten
```

**X-API-Key Header:**
```bash
curl -H "X-API-Key: your-api-key" \
  https://your-worker.workers.dev/shorten
```

### Permissions

API keys can have the following permissions:
- `shorten`: Create short URLs
- `stats`: View statistics
- `delete`: Delete short URLs
- `bulk`: Use bulk operations
- `domains`: Manage custom domains
- `abtest`: Create A/B tests
- `georoute`: Create geographic routes

## Configuration

Environment variables can be set in `wrangler.toml`:

```toml
[vars]
BASE_URL = "https://yourdomain.com"  # Your custom domain
DEFAULT_TTL = "0"                    # Default expiration (0 = never)
CODE_LENGTH = "6"                    # Length of generated codes
RATE_LIMIT = "100"                   # Requests per minute per IP
ENVIRONMENT = "production"
```

## Custom Domain

To use a custom domain:

1. Add your domain to Cloudflare
2. Deploy the worker
3. Go to Workers & Pages → your worker → Triggers
4. Add a custom domain
5. Update `BASE_URL` in `wrangler.toml`

## Security

### Built-in Protections

- **SSRF Prevention**: Blocks localhost and private IP ranges
- **Rate Limiting**: Per-IP rate limiting (configurable)
- **Input Validation**: Strict URL and custom code validation
- **Reserved Words**: Prevents use of API routes as short codes

### URL Validation

The service rejects:
- Non-HTTP/HTTPS URLs
- Localhost and 127.0.0.1
- Private IP ranges (10.x, 192.168.x, 172.16.x)
- URLs with embedded credentials
- URLs exceeding 2048 characters

## Architecture

The service is designed with a **storage abstraction layer** to enable future migration to Go + Docker:

```
┌─────────────────────────────────────┐
│  HTTP Handlers (Portable Logic)    │
│  - URL shortening algorithm         │
│  - Validation                       │
│  - Business logic                   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Storage Interface (Abstract)       │
│  - set(code, data)                  │
│  - get(code)                        │
│  - exists(code)                     │
│  - delete(code)                     │
│  - incrementStats(code)             │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐          ┌─────▼─────┐
│   KV   │          │   Redis   │
│ (Now)  │          │ (Future)  │
└────────┘          └───────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design documentation.

## Project Structure

```
.
├── src/
│   ├── index.ts              # Worker entry point & routing
│   ├── storage/              # Storage abstraction layer
│   │   ├── interface.ts      # Storage interface contract
│   │   ├── kv.ts             # Cloudflare KV implementation
│   │   └── memory.ts         # In-memory (for testing)
│   ├── shortener/            # Core business logic
│   │   ├── algorithm.ts      # URL shortening algorithm
│   │   └── validator.ts      # URL validation
│   ├── handlers/             # HTTP request handlers
│   │   ├── shorten.ts        # POST /shorten
│   │   ├── redirect.ts       # GET /:shortCode
│   │   ├── stats.ts          # GET /api/stats/:shortCode
│   │   └── health.ts         # GET /health
│   └── middleware/           # Cross-cutting concerns
│       ├── errors.ts         # Error handling
│       └── ratelimit.ts      # Rate limiting
├── test/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── wrangler.toml             # Cloudflare configuration
├── ARCHITECTURE.md           # Architecture documentation
└── README.md                 # This file
```

## Development

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm test test/unit

# Integration tests only
npm test test/integration
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Performance

| Metric | Cloudflare Workers |
|--------|-------------------|
| Cold Start | < 50ms |
| Redirect Latency | < 20ms (at edge) |
| Shorten Latency | < 100ms |
| Throughput | ~50k req/s |
| Geographic Coverage | 300+ cities globally |

## Limitations

### Cloudflare Workers (Free Tier)

- 100,000 requests/day
- 10ms CPU time per request
- KV: 1000 writes/day, unlimited reads
- 1 MB script size

### KV Storage

- Eventually consistent (may take up to 60 seconds to propagate)
- Visit counters may have race conditions (acceptable for analytics)
- No atomic increment (workaround: read-modify-write)

## Migration Path to Go + Docker

When you're ready to migrate:

1. **Export Data**: Use Wrangler to export KV data
   ```bash
   wrangler kv:key list --binding=URL_STORE
   ```

2. **Import to Redis**: Load data into Redis with the same key structure

3. **Deploy Go Service**: The storage interface is compatible
   - Implement `URLStorage` interface in Go
   - Use Redis adapter instead of KV adapter
   - Same HTTP handlers and business logic

4. **Switch Traffic**: Update DNS to point to Go service

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed migration guide.

## Future Enhancements

All major features have been implemented! Potential future enhancements:

- [ ] Mobile app for URL management
- [ ] Browser extension for quick shortening
- [ ] Webhooks for URL events
- [ ] Advanced analytics (conversion tracking, funnel analysis)
- [ ] URL expiration notifications
- [ ] Scheduled URL activation
- [ ] Link rotation (time-based redirects)
- [ ] Password-protected URLs

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass (`npm test`)
2. Code is properly typed (`npm run type-check`)
3. Code follows style guide (`npm run lint`)

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [Report Issue](https://github.com/yourusername/url-shortener/issues)
- Documentation: See [ARCHITECTURE.md](./ARCHITECTURE.md)

---

**Built with Cloudflare Workers** | **Designed for Go Migration**
