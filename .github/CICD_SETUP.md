# CI/CD Setup Guide

This document explains the CI/CD pipelines and security gates configured for the URL Shortener project.

## Overview

We have implemented comprehensive CI/CD pipelines with multiple security gates to ensure code quality, security, and reliable deployments.

## Workflows

### 1. PR Checks (`pr-checks.yml`)

Runs on every pull request to `main`/`master` branches.

**Jobs:**

- **Code Quality** - Type checking and linting
  - TypeScript type checking (`npm run type-check`)
  - ESLint code linting (`npm run lint`)

- **Tests** - Full test suite with coverage
  - Runs unit and integration tests
  - Generates coverage reports
  - Uploads to Codecov (optional)
  - Validates coverage thresholds

- **Dependency Security Scan**
  - Runs `npm audit` to check for vulnerable dependencies
  - Reports critical and high-severity vulnerabilities
  - Generates audit reports

- **Secret Scanning**
  - Uses TruffleHog to detect secrets in code
  - Scans commit history for leaked credentials
  - Only reports verified secrets

- **Build Verification**
  - Performs dry-run deployment with Wrangler
  - Ensures code compiles and builds successfully
  - Validates Cloudflare Workers compatibility

- **Security Validation Tests**
  - Runs security-focused test suites
  - Verifies SSRF protection is in place
  - Validates URL validation logic

- **PR Size Check**
  - Warns on large PRs (>50 files or >1000 lines)
  - Encourages smaller, focused changes

- **All Checks Gate**
  - Aggregates all job results
  - Fails if any required check fails
  - Must pass before merge

### 2. Deployment (`deploy.yml`)

Handles automated and manual deployments to staging and production.

**Staging Deployment:**
- Triggers automatically on push to `main`/`master`
- Runs full test suite before deployment
- Deploys to Cloudflare Workers staging environment
- Performs smoke tests (health check)
- No manual approval required

**Production Deployment:**
- Requires manual workflow dispatch
- Requires GitHub environment approval (recommended)
- Runs security checks before deployment
- Creates deployment tags for rollback capability
- Performs smoke tests after deployment

**Rollback Capability:**
- Can rollback to previous production deployment
- Uses git tags to track deployments
- Quick recovery from failed deployments

### 3. CodeQL Analysis (`codeql.yml`)

Advanced security code scanning.

**Features:**
- Static analysis for security vulnerabilities
- Runs on PRs, pushes to main, and weekly schedule
- Analyzes JavaScript/TypeScript code
- Detects common security issues:
  - SQL injection patterns
  - XSS vulnerabilities
  - Path traversal
  - Insecure cryptography
  - And more

**Schedule:** Weekly on Mondays at 6:00 AM UTC

### 4. Dependency Review (`dependency-review.yml`)

Reviews dependency changes in PRs.

**Features:**
- Checks for vulnerable dependencies in PRs
- Fails on moderate+ severity vulnerabilities
- Adds review comments to PRs automatically

## Required Secrets

Configure these secrets in your GitHub repository settings:

### Cloudflare Secrets

1. **`CLOUDFLARE_API_TOKEN`**
   - Create at: https://dash.cloudflare.com/profile/api-tokens
   - Required permissions:
     - Account: Workers Scripts (Edit)
     - Account: Workers KV Storage (Edit)

2. **`CLOUDFLARE_ACCOUNT_ID`**
   - Find at: https://dash.cloudflare.com/ (in URL or sidebar)

### Optional Secrets

3. **`CODECOV_TOKEN`** (optional)
   - For code coverage reporting
   - Create at: https://codecov.io/

## Environment Configuration

### KV Namespaces

Create separate KV namespaces for each environment:

```bash
# Staging
wrangler kv:namespace create URL_STORE --env staging

# Production
wrangler kv:namespace create URL_STORE --env production
```

Update the IDs in `wrangler.toml`:

```toml
[env.staging.kv_namespaces]
binding = "URL_STORE"
id = "your-staging-kv-id"

[env.production.kv_namespaces]
binding = "URL_STORE"
id = "your-production-kv-id"
```

### Environment Variables

Update the domain URLs in `wrangler.toml` for your custom domains:

```toml
[env.staging]
vars = { BASE_URL = "https://staging.yourdomain.com", ... }

[env.production]
vars = { BASE_URL = "https://yourdomain.com", ... }
```

## Branch Protection Rules

Configure branch protection for `main`/`master`:

### Required Settings

1. **Require pull request reviews before merging**
   - Required approving reviews: 1 (recommended)
   - Dismiss stale PR approvals when new commits are pushed: ✓

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging: ✓
   - Required status checks:
     - `Code Quality`
     - `Tests`
     - `Dependency Security Scan`
     - `Secret Scanning`
     - `Build Check`
     - `Security Validation Tests`
     - `All Checks Passed`

3. **Require conversation resolution before merging**: ✓

4. **Do not allow bypassing the above settings**: ✓

5. **Restrict who can push to matching branches** (optional)
   - Limit to administrators and CI/CD service accounts

### Configuration Steps

1. Go to repository **Settings** → **Branches**
2. Click **Add rule** or edit existing rule
3. Branch name pattern: `main` (or `master`)
4. Enable the settings listed above
5. Select required status checks from the list
6. Save changes

## GitHub Environments (Recommended)

Set up environments for deployment approval gates:

### Staging Environment

1. Go to **Settings** → **Environments** → **New environment**
2. Name: `staging`
3. Environment protection rules (optional):
   - Required reviewers: (none for auto-deploy)
4. Environment secrets: (none needed, uses repo secrets)

### Production Environment

1. Go to **Settings** → **Environments** → **New environment**
2. Name: `production`
3. Environment protection rules:
   - Required reviewers: Add team leads/senior developers
   - Wait timer: 5 minutes (optional)
4. Environment variables:
   - Restrict deployment to `main` branch only

## Deployment Process

### Automatic Staging Deployment

1. Create a pull request
2. All PR checks must pass (required)
3. Get code review approval
4. Merge to `main`
5. Staging deployment triggers automatically
6. Smoke tests run against staging

### Manual Production Deployment

1. Go to **Actions** → **Deploy** workflow
2. Click **Run workflow**
3. Select `production` environment
4. Confirm deployment
5. Wait for environment approval (if configured)
6. Production deployment executes
7. Smoke tests verify deployment
8. Git tag created for rollback capability

### Emergency Rollback

If a production deployment causes issues:

1. Go to **Actions** → **Deploy** workflow
2. Click **Run workflow**
3. Select `rollback` option
4. Previous stable version deploys immediately

## Security Features

### Built-in Security Gates

1. **SSRF Protection Validation**
   - Ensures validator blocks localhost/private IPs
   - Runs on every PR

2. **Secret Scanning**
   - TruffleHog scans for leaked credentials
   - Blocks PRs with secrets

3. **Dependency Scanning**
   - npm audit checks for vulnerable dependencies
   - Dependency Review checks PRs

4. **CodeQL Analysis**
   - Static analysis for code vulnerabilities
   - Runs weekly and on PRs

### Security Best Practices

1. **Never commit secrets**
   - Use GitHub Secrets for credentials
   - Use environment variables in Wrangler

2. **Keep dependencies updated**
   - Review Dependabot alerts regularly
   - Update vulnerable packages promptly

3. **Review security scan results**
   - Check CodeQL findings
   - Address npm audit vulnerabilities

4. **Test security features**
   - Validate SSRF protection
   - Test rate limiting
   - Verify authentication

## Monitoring and Alerts

### GitHub Notifications

Configure notifications for:
- Failed workflows
- Security alerts (Dependabot, CodeQL)
- Deployment status

### Smoke Tests

Both staging and production deployments include smoke tests:
- Health endpoint check (`/health`)
- Validates deployment succeeded
- Fails deployment if checks fail

## Troubleshooting

### Build Failures

**Problem:** TypeScript compilation errors
- Solution: Run `npm run type-check` locally and fix errors

**Problem:** Test failures
- Solution: Run `npm test` locally to reproduce and fix

### Deployment Failures

**Problem:** Wrangler authentication errors
- Solution: Verify `CLOUDFLARE_API_TOKEN` secret is set correctly
- Check token has required permissions

**Problem:** KV namespace not found
- Solution: Create KV namespaces and update IDs in `wrangler.toml`

**Problem:** Environment variables not set
- Solution: Update `wrangler.toml` with correct environment config

### Security Scan Failures

**Problem:** npm audit finds vulnerabilities
- Solution: Run `npm audit fix` locally
- Review and update dependencies
- Check if vulnerabilities apply to your use case

**Problem:** Secret scanning alerts
- Solution: Remove secrets from code
- Rotate compromised credentials
- Use GitHub Secrets for sensitive data

**Problem:** CodeQL alerts
- Solution: Review findings in Security tab
- Fix vulnerable code patterns
- False positives can be dismissed with justification

## Testing Locally

Before pushing, run these checks locally:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Tests with coverage
npm run test:coverage

# Security audit
npm audit

# Build verification
npx wrangler deploy --dry-run
```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [TruffleHog Documentation](https://github.com/trufflesecurity/trufflehog)

## Support

For issues with CI/CD pipelines:
1. Check workflow logs in Actions tab
2. Review this documentation
3. Contact the DevOps team
4. Open an issue in the repository
