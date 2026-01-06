# Claude Instructions

## Development Environment

The API server runs via Tilt in a Kubernetes cluster (minikube). **Do not start any servers manually** - they are already running when working on this project.

- Run `./bin/tilt-start.sh` to start all services (Neo4j, API, Client)
- API available at: `http://localhost:4025`
- Neo4j available at: `bolt://localhost:7687` and `http://localhost:7474`
- Client available at: `http://localhost:5173`

## Testing

All test commands run from `recommender_api/` directory.

### Unit & Integration Tests (Vitest)

```bash
# Run all tests
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### E2E Tests (Newman/Postman)

**Requires Tilt to be running** (tests hit the live API at localhost:4025).

```bash
# Run E2E tests via npm script
npm run test:e2e

# Or run directly with newman
npx newman run ../postman/collections/search-filter-tests.postman_collection.json \
  --globals ../postman/globals/workspace.postman_globals.json
```

### Full Test Suite

Run both unit/integration and E2E tests:

```bash
npm test && npm run test:e2e
```

### Postman Collection

The Postman collection at `postman/collections/search-filter-tests.postman_collection.json` contains 47 test scenarios with 172 assertions.

**Important:** Update the Postman collection whenever API changes are made (new endpoints, changed request/response schemas, new filters, etc.).
