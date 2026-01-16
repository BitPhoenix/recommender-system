# Code Style

## Function Ordering

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

## Comments

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

## Map/Record Naming

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

## Type/Interface Placement

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
