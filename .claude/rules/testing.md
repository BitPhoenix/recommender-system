# Testing

All test commands run from `recommender_api/` directory.

## Unit & Integration Tests (Vitest)

```bash
# Run all tests
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## E2E Tests (Newman/Postman)

**Requires Tilt to be running** (tests hit the live API).

**Note:** The API binds to the Tailscale hostname (`mac-studio.tailb9e408.ts.net:4025`) rather than `localhost:4025`. The Postman collection URLs are configured for this hostname. If you need to change the host, update the URLs in the collection or use the `--env-var` flag:

```bash
# Run E2E tests via npm script (uses Tailscale hostname)
npm run test:e2e

# Or run with a different host
npx newman run ../postman/collections/search-filter-tests.postman_collection.json \
  --globals ../postman/globals/workspace.postman_globals.json \
  --env-var "baseUrl=http://localhost:4025"
```

## Full Test Suite

Run both unit/integration and E2E tests:

```bash
npm test && npm run test:e2e
```

## Verification Policy

**Always run automated tests instead of asking for manual testing.** After completing implementation:
1. Run `npm run typecheck` to verify TypeScript compiles
2. Run `npm test` to run unit/integration tests
3. Run `npm run test:e2e` to run E2E tests (if Tilt is running)

Do not pause for manual verification or ask the user to test manually. If E2E tests require Tilt, attempt to run them - they will pass if Tilt is running, or fail gracefully if not.

## Postman Collection

The Postman collection at `postman/collections/search-filter-tests.postman_collection.json` contains 62 test scenarios with 215 assertions.

**Important:** Update the Postman collection whenever API changes are made (new endpoints, changed request/response schemas, new filters, etc.).
