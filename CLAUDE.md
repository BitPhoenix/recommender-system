# Claude Instructions

## Development Environment

The API server runs via Tilt in a Kubernetes cluster (minikube). **Do not start any servers manually** - they are already running when working on this project.

- Run `./bin/tilt-start.sh` to start all services (Neo4j, API, Client)
- API available at: `http://localhost:4025`
- Neo4j available at: `bolt://localhost:7687` and `http://localhost:7474`
- Client available at: `http://localhost:5173`

## Design Philosophy

**Prioritize correctness and clean design over simplicity or minimal changes.** When evaluating implementation approaches:

- **Embrace refactoring**: If the cleanest solution requires restructuring existing code, do it. Don't work around poor designs just to avoid touching existing code.
- **Breaking changes are acceptable**: Don't preserve backwards compatibility for its own sake. If a better API or interface design requires breaking changes, prefer the better design.
- **Choose the most correct solution**: Don't default to "simplest" or "fastest to implement." Evaluate options based on correctness, maintainability, and how well they fit the domain model.
- **Fix root causes**: Don't add workarounds or bandaids. If you encounter technical debt while implementing a feature, address it rather than working around it.
- **Design for the actual requirements**: Not for hypothetical future ones, but also not artificially constrained by "what's easiest right now."

When presenting options, don't weight "requires no refactoring" or "minimal changes" as advantages. The right solution is the one with the best design, regardless of how much existing code needs to change.

## Seeding

**Seeding runs automatically via Tilt.** The `neo4j-seed` local_resource watches these files and triggers a rebuild/redeploy when any change:

```
seeds/seed.ts
seeds/skills.ts
seeds/engineers.ts
seeds/stories.ts
seeds/assessments.ts
seeds/types.ts
seeds/index.ts
```

**Do not ask the user to run seeds manually.** After modifying seed files, verify the seed completed successfully by running Cypher queries against Neo4j:

```bash
# Example verification queries (run via curl or Neo4j browser at localhost:7474)
curl -X POST http://localhost:7474/db/neo4j/tx/commit \
  -H "Content-Type: application/json" \
  -d '{"statements": [{"statement": "MATCH (e:Engineer) RETURN count(e) AS total"}]}'
```

Common verification queries:
- `MATCH (e:Engineer) RETURN count(e)` - Count engineers
- `MATCH (s:Skill) RETURN count(s)` - Count skills
- `MATCH (e:Engineer {id: 'eng_james'}) RETURN e.timezone` - Check specific field

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

### Full Test Suite

Run both unit/integration and E2E tests:

```bash
npm test && npm run test:e2e
```

### Verification Policy

**Always run automated tests instead of asking for manual testing.** After completing implementation:
1. Run `npm run typecheck` to verify TypeScript compiles
2. Run `npm test` to run unit/integration tests
3. Run `npm run test:e2e` to run E2E tests (if Tilt is running)

Do not pause for manual verification or ask the user to test manually. If E2E tests require Tilt, attempt to run them - they will pass if Tilt is running, or fail gracefully if not.

### Postman Collection

The Postman collection at `postman/collections/search-filter-tests.postman_collection.json` contains 62 test scenarios with 215 assertions.

**Important:** Update the Postman collection whenever API changes are made (new endpoints, changed request/response schemas, new filters, etc.).

## Code Style

### Function Ordering

Place parent/caller functions **above** the functions they call. This makes code easier to read top-down:

```typescript
/* Good: caller above callees */
export function processData(input: Input): Output {
  const parsed = parseInput(input);
  return formatOutput(parsed);
}

function parseInput(input: Input): Parsed { /* ... */ }
function formatOutput(parsed: Parsed): Output { /* ... */ }

/* Bad: helpers before the function that uses them */
function parseInput(input: Input): Parsed { /* ... */ }
function formatOutput(parsed: Parsed): Output { /* ... */ }

export function processData(input: Input): Output {
  const parsed = parseInput(input);
  return formatOutput(parsed);
}
```

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

### Map/Record Naming

Name maps and records using `keyToValue` pattern to make the mapping direction clear:

```typescript
/* Good: clear what maps to what */
const fieldToRelaxationStrategy: Record<string, RelaxationStrategy> = { ... };
const skillIdToDisplayName: Map<string, string> = new Map();
const ruleIdToDerivationChain: Record<string, string[]> = { ... };

/* Bad: ambiguous names */
const relaxationStrategies: Record<string, RelaxationStrategy> = { ... };
const skillNames: Map<string, string> = new Map();
const derivationChains: Record<string, string[]> = { ... };
```

### Type/Interface Placement

Place local interfaces and type aliases at the **top of the file**, after imports but before any functions:

```typescript
/* Good: types at the top */
import { SomeDependency } from "./dependency.js";

interface LocalResult {
  value: string;
  count: number;
}

export function processData(): LocalResult {
  // ...
}

/* Bad: types scattered in the middle of the file */
import { SomeDependency } from "./dependency.js";

export function processData(): LocalResult {
  // ...
}

interface LocalResult {  // Hard to find, breaks reading flow
  value: string;
  count: number;
}

function helperFunction() { /* ... */ }
```

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
