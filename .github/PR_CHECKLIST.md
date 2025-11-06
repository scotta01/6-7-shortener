# Pull Request Checklist

Use this checklist before submitting a pull request to ensure all CI/CD checks will pass.

## Pre-Commit Checklist

Run these commands locally before pushing:

### 1. Type Checking ✓
```bash
npm run type-check
```
- [ ] No TypeScript errors

### 2. Linting ✓
```bash
npm run lint
```
- [ ] No linting errors
- [ ] Code follows project style guide

### 3. Tests ✓
```bash
npm run test:coverage
```
- [ ] All tests pass
- [ ] New code has test coverage
- [ ] Coverage meets thresholds (>80%)

### 4. Security Audit ✓
```bash
npm audit --audit-level=moderate
```
- [ ] No moderate+ vulnerabilities
- [ ] Dependencies are up to date

### 5. Build Verification ✓
```bash
npx wrangler deploy --dry-run
```
- [ ] Build succeeds
- [ ] No compilation errors

## Pull Request Description

Include in your PR description:

- [ ] **Summary**: What does this PR do?
- [ ] **Motivation**: Why is this change needed?
- [ ] **Testing**: How was this tested?
- [ ] **Screenshots**: If UI changes, include screenshots
- [ ] **Breaking Changes**: List any breaking changes
- [ ] **Security Impact**: Note any security implications

## Code Review Checklist

For reviewers:

### Code Quality
- [ ] Code is readable and maintainable
- [ ] Functions are well-named and focused
- [ ] Complex logic has comments
- [ ] No duplicate code
- [ ] Error handling is appropriate

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation is present
- [ ] SSRF protection is maintained
- [ ] Rate limiting is appropriate
- [ ] Authentication is correct

### Testing
- [ ] Tests cover new functionality
- [ ] Edge cases are tested
- [ ] Integration tests pass
- [ ] Test names are descriptive

### Performance
- [ ] No performance regressions
- [ ] Algorithms are efficient
- [ ] Database queries are optimized
- [ ] No unnecessary API calls

### Documentation
- [ ] README updated if needed
- [ ] API docs updated if endpoints changed
- [ ] Comments explain complex logic
- [ ] Type definitions are accurate

## After Merge

- [ ] Monitor CI/CD pipeline for staging deployment
- [ ] Verify changes in staging environment
- [ ] Check for any errors in logs
- [ ] Notify team of deployment

## Deployment to Production

Required steps:

1. [ ] All PR checks passed
2. [ ] Code review approved
3. [ ] Merged to main
4. [ ] Staging deployment successful
5. [ ] Staging smoke tests passed
6. [ ] Manual testing in staging
7. [ ] Production deployment initiated
8. [ ] Production smoke tests passed
9. [ ] Monitoring for errors

## Emergency Rollback

If production issues occur:

1. Identify the problem
2. Go to **Actions** → **Deploy** workflow
3. Click **Run workflow**
4. Select "rollback"
5. Confirm rollback
6. Monitor rollback completion
7. Verify issue is resolved
8. Create incident report

## Common Issues

### TypeScript Errors
```bash
# Fix missing types
npm install --save-dev @types/package-name

# Check specific file
npx tsc --noEmit src/file.ts
```

### Test Failures
```bash
# Run specific test
npm test -- test/unit/file.test.ts

# Debug test
npm test -- --reporter=verbose

# Update snapshots
npm test -- -u
```

### Linting Errors
```bash
# Auto-fix issues
npm run lint -- --fix

# Check specific file
npx eslint src/file.ts
```

### Build Errors
```bash
# Clean and rebuild
rm -rf node_modules package-lock.json
npm install
npm run type-check
```

## Resources

- [CI/CD Setup Guide](./.github/CICD_SETUP.md)
- [Architecture Documentation](../ARCHITECTURE.md)
- [README](../README.md)
- [GitHub Actions Workflows](./workflows/)

## Questions?

If you have questions about the CI/CD process:
- Review the [CI/CD Setup Guide](./.github/CICD_SETUP.md)
- Check workflow logs in the Actions tab
- Ask in the team chat
- Open an issue for documentation improvements
