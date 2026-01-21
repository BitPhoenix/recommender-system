# Decomposed Constraints

## Overview

`DecomposedConstraints` is a data structure that breaks down `AppliedFilter` entries into atomic, independently testable pieces. It exists to support the **constraint advisor** feature, which suggests relaxations (when results are sparse) and tightenings (when results are too many).

## The Problem

The `AppliedFilter` structure is optimized for the main search query, but it groups things together in ways that make it hard to test individual constraints:

### 1. BETWEEN Filters Are Compound

A seniority filter like "senior" becomes:

```typescript
AppliedFilter: {
  field: "yearsExperience",
  operator: "BETWEEN",
  value: "6 AND 10"
}
```

When diagnosing why a search returns no results, we need to know if the *minimum* (6 years) or the *maximum* (10 years) is causing the conflict. Testing the filter as a unit doesn't give us that granularity.

### 2. Skill Groups Bundle Multiple Skills

A skill requirement expands to include descendants:

```typescript
AppliedSkillFilter: {
  field: "requiredSkills",
  skills: [
    { skillId: "skill_python", skillName: "Python" },
    { skillId: "skill_django", skillName: "Django" },
    { skillId: "skill_flask", skillName: "Flask" }
  ]
}
```

To suggest "remove the Python requirement", we need to test each skill independently and understand which one the user originally requested vs. which were added through hierarchy expansion.

## The Solution: Decomposition

The `decomposeConstraints()` function transforms `AppliedFilter[]` into `TestableConstraint[]`:

### BETWEEN Becomes Two Constraints

```
AppliedFilter: { field: "yearsExperience", operator: "BETWEEN", value: "6 AND 10" }
                                    ↓
TestableConstraint[0]: { id: "yearsExperience_min_0", operator: ">=", value: 6 }
TestableConstraint[1]: { id: "yearsExperience_max_0", operator: "<",  value: 10 }
```

### Skills Become Individual Constraints

```
AppliedSkillFilter: { skills: [Python, Django, Flask], source: "user" }
                                    ↓
TestableConstraint[0]: { id: "user_skill_skill_python", skillIds: ["skill_python"] }
TestableConstraint[1]: { id: "user_skill_skill_django", skillIds: ["skill_django"] }
TestableConstraint[2]: { id: "user_skill_skill_flask",  skillIds: ["skill_flask"] }
```

### Derived Skills Stay Grouped

Inference-derived skills remain as a single constraint because they came from a single rule:

```
AppliedDerivedSkillFilter: { ruleId: "scaling-requires-distributed", skills: [...] }
                                    ↓
TestableConstraint: { id: "derived_scaling-requires-distributed", skillIds: [...] }
```

## What Each TestableConstraint Contains

```typescript
interface TestableConstraint {
  id: string;                    // Unique identifier for tracking
  field: string;                 // Which field this constrains
  operator: string;              // Cypher operator (>=, <, IN, etc.)
  value: unknown;                // The constraint value
  displayValue: string;          // Human-readable description
  source: string;                // "user" or "inference"
  constraintType: ConstraintType; // Property or SkillTraversal
}

// Property constraints also have:
interface PropertyConstraint extends TestableConstraint {
  cypher: {
    clause: string;              // Pre-built WHERE clause fragment
    paramName: string;           // Parameter name for the query
    paramValue: unknown;         // Parameter value
  };
  fieldType: PropertyFieldType;  // Numeric, String, or StringArray
}
```

## How It's Used

### 1. QuickXplain Algorithm

Finds the minimal set of constraints causing empty results:

```typescript
// Input: All constraints
// Output: { yearsExperience_min_0, user_skill_skill_kubernetes }
// Meaning: "Senior + Kubernetes" is the conflicting combination
```

### 2. Relaxation Tester

Tests "what if we remove/loosen this constraint?":

```typescript
// For each constraint in the conflict set:
const countWithout = await testWithoutConstraint(constraint);
// Returns: "Removing senior requirement gives 15 results"
```

### 3. Tightening Tester

Tests "what if we add this constraint?":

```typescript
// For each potential new constraint:
const countWith = await testWithConstraint(newConstraint);
// Returns: "Adding TypeScript requirement reduces to 8 results"
```

### 4. Converting Back to SkillFilterRequirement

The count query builders expect `SkillFilterRequirement[]` format (same as main search). The `extractSkillConstraints()` function converts decomposed constraints back:

```typescript
function extractSkillConstraints(decomposed: DecomposedConstraints): {
  skillFilterRequirements: SkillFilterRequirement[];
}
```

This round-trip exists because:
- Decomposition is needed for constraint-by-constraint testing
- The query builders were designed for the main search format
- Reusing query builders ensures count queries match main search semantics

## File Locations

| File | Purpose |
|------|---------|
| `constraint-decomposer.service.ts` | `decomposeConstraints()` function |
| `constraint.types.ts` | Type definitions for `TestableConstraint`, `DecomposedConstraints` |
| `skill-extraction.utils.ts` | `extractSkillConstraints()` to convert back |
| `quickxplain.service.ts` | Uses decomposed constraints for conflict detection |
| `relaxation-tester.service.ts` | Tests relaxation scenarios |
| `tightening-tester.service.ts` | Tests tightening scenarios |

## Example Flow

```
User Request: { requiredSeniorityLevel: "senior", requiredSkills: ["Kubernetes"] }
                                          ↓
                                   expandSearchCriteria()
                                          ↓
AppliedFilters: [
  { field: "yearsExperience", operator: "BETWEEN", value: "6 AND 10" },
  { field: "requiredSkills", skills: [Kubernetes, Helm, ...] }
]
                                          ↓
                                   decomposeConstraints()
                                          ↓
TestableConstraints: [
  { id: "yearsExperience_min_0", operator: ">=", value: 6 },
  { id: "yearsExperience_max_0", operator: "<", value: 10 },
  { id: "user_skill_skill_kubernetes", skillIds: ["skill_kubernetes"] },
  { id: "user_skill_skill_helm", skillIds: ["skill_helm"] },
  ...
]
                                          ↓
                              QuickXplain finds conflict:
                              { yearsExperience_min_0, user_skill_skill_kubernetes }
                                          ↓
                              Relaxation suggestions:
                              - "Lower seniority to mid (12 results)"
                              - "Remove Kubernetes requirement (8 results)"
```
