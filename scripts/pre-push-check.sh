#!/bin/bash

# Pre-push checks script
# Run this before pushing to ensure CI/CD checks will pass

set -e

echo "🔍 Running pre-push checks..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
FAILED=0

# Function to run check
run_check() {
    local name=$1
    local command=$2

    echo "───────────────────────────────────────────────"
    echo "Running: $name"
    echo "───────────────────────────────────────────────"

    if eval "$command"; then
        echo -e "${GREEN}✓ $name passed${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ $name failed${NC}"
        echo ""
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# 1. Type checking
run_check "TypeScript type checking" "npm run type-check" || true

# 2. Linting
run_check "ESLint" "npm run lint" || true

# 3. Tests
run_check "Tests with coverage" "npm run test:coverage" || true

# 4. Security audit
run_check "Security audit (npm audit)" "npm audit --audit-level=moderate" || true

# 5. Build verification
run_check "Build check (dry-run)" "npx wrangler deploy --dry-run --outdir=dist" || true

# Summary
echo "═══════════════════════════════════════════════"
echo "Pre-push checks summary"
echo "═══════════════════════════════════════════════"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All checks passed! ✓${NC}"
    echo ""
    echo "You're ready to push your changes."
    exit 0
else
    echo -e "${RED}$FAILED check(s) failed ✗${NC}"
    echo ""
    echo "Please fix the issues before pushing."
    echo "See output above for details."
    exit 1
fi
