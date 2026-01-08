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

## Code Style

### Comments

For multi-line comments, use block comments (`/* */`) instead of multiple single-line comments (`//`):

```typescript
/* Good: block comment for multi-line explanations */
/*
 * The provenance maps use 'user-input' as a sentinel to mark values that came
 * from the user's request (not from rules). We filter this out because
 * derivationChain should only contain rule IDs.
 */

// Bad: multiple single-line comments
// The provenance maps use 'user-input' as a sentinel to mark values that came
// from the user's request (not from rules). We filter this out because
// derivationChain should only contain rule IDs.
```

Single-line `//` comments are fine for brief annotations.

## Inference Rules (Section 5.2.1)

The system implements iterative requirement expansion using `json-rules-engine`. Rules are organized by type in `recommender_api/src/config/knowledge-base/inference-rules/`:

```
inference-rules/
  index.ts                   # Combines and exports all rules
  filter-rules.config.ts     # Hard constraints (X-requires-Y)
  boost-rules.config.ts      # Soft preferences (X-prefers-Y)
```

### Rule Types

- **Filter rules** (`derived-filter`): Hard constraints that EXCLUDE candidates
  - File: `filter-rules.config.ts`
  - Naming convention: `X-requires-Y`
  - Example: `scaling-requires-distributed` - scaling teamFocus requires distributed systems skill

- **Boost rules** (`derived-boost`): Soft preferences that affect RANKING
  - File: `boost-rules.config.ts`
  - Naming convention: `X-prefers-Y`
  - Example: `senior-prefers-leadership` - senior seniority boosts leadership skills

### Adding New Rules

Facts are organized into nested groups: `request` (user inputs), `derived` (mutable state), `meta` (tracking).

```typescript
// In filter-rules.config.ts or boost-rules.config.ts
const myRule: InferenceRuleDefinition = {
  name: 'Human-readable Rule Name',
  priority: 50,  // Higher = evaluated first (50 for first-hop, 40 for chains, 30 for compound)
  conditions: {
    all: [
      { fact: 'request', path: '$.teamFocus', operator: 'equal', value: 'scaling' }
    ]
  },
  event: {
    type: 'derived-filter',  // or 'derived-boost'
    params: {
      ruleId: 'unique-rule-id',  // Use X-requires-Y or X-prefers-Y naming
      targetField: 'derivedSkills',
      targetValue: ['skill_distributed'],
      boostStrength: 0.6,  // Only for boost rules (0-1)
      rationale: 'Explanation for API response'
    }
  }
};

// Add to the exported array at the bottom of the file
export const filterRules: InferenceRuleDefinition[] = [
  // ... existing rules
  myRule,
];
```

### Fact Structure & Paths

The `request` fact contains all fields from `SearchFilterRequest` (spreads directly), plus convenience fields.

| Fact Group | Path | Description |
|------------|------|-------------|
| `request` | `$.requiredSeniorityLevel` | Required seniority level |
| `request` | `$.teamFocus` | Team focus (scaling, greenfield, etc.) |
| `request` | `$.skills` | Flattened skill names (convenience for 'contains' checks) |
| `request` | `$.requiredSkills` | Full skill requirements with proficiency |
| `request` | `$.maxBudget` | Maximum budget constraint |
| `request` | `$.*` | Any other SearchFilterRequest field |
| `derived` | `$.allSkills` | All skills (user + derived, enables chaining) |
| `derived` | `$.requiredProperties.*` | Normalized keys from required* fields + filter rules |
| `derived` | `$.preferredProperties.*` | Normalized keys from preferred* fields + boost rules |

### Chaining Mechanism

Rules can chain from derived context values:
- **Skills in `derived.allSkills`**: Use `contains` operator
- **Required properties in `derived.requiredProperties`**: Normalized keys (e.g., `seniorityLevel`)
- **Preferred properties in `derived.preferredProperties`**: Normalized keys

**Key concept**: User input (`requiredSeniorityLevel`) is normalized and stored in `derived.requiredProperties.seniorityLevel`. Rule-derived values go to `derived.preferredProperties`.

Example: Boost chain rule that fires from required OR preferred seniority:
```typescript
{
  conditions: {
    any: [
      // Fire from user's required seniority
      { fact: 'derived', path: '$.requiredProperties.seniorityLevel', operator: 'in', value: ['senior', ...] },
      // Fire from rule-derived preferred seniority
      { fact: 'derived', path: '$.preferredProperties.seniorityLevel', operator: 'in', value: ['senior', ...] },
    ]
  },
  // ...
}
```

The derivation chain reflects the trigger source:
- User input trigger → single-element chain: `['current-rule']`
- Derived value trigger → multi-hop chain: `['source-rule', 'current-rule']`

### Available Operators

- Standard: `equal`, `notEqual`, `in`, `notIn`, `greaterThan`, `lessThan`
- Custom: `contains` - checks if array fact contains a value

### Testing New Rules

```bash
# Run inference engine tests
npm test -- src/services/inference-engine.service.test.ts

# Run all tests
npm test
```
