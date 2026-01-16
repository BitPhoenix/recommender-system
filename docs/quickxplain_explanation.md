# QuickXplain Algorithm Explanation

This document explains how the QuickXplain algorithm works, as implemented in `recommender_api/src/services/constraint-advisor/quickxplain.service.ts`.

## The Problem

We have a set of constraints (e.g., filters in a search query) that together return too few results. We want to find the **smallest subset** of constraints that still causes the problem. This is called a "minimal conflict set."

## Key Concepts

### Consistent vs Inconsistent

- **Consistent**: A set of constraints that returns >= threshold results (default: 3). The constraints "work."
- **Inconsistent**: A set of constraints that returns < threshold results. The constraints are too restrictive.

### The Parameters

The recursive `quickXplain(background, delta, candidates)` function uses three parameters:

- **Background**: Constraints we're keeping in play while we search. These are always included when testing.
- **Candidates**: Constraints we're searching through to determine which are needed in the minimal conflict.
- **Delta**: What was just added to background. Used for an optimization check (explained below).

### The Core Technique

To check if a constraint can be eliminated from the minimal conflict, we test whether the conflict still exists without it. If yes, that constraint is not needed.

## Worked Example

### Setup

We have 4 constraints: A, B, C, D

When we apply all 4 together, we get 0 results. We want to find the smallest subset that still gives 0 results. In this example, the answer is {A, C}.

### Step 1: Verify there's a problem

Query {A, B, C, D} → 0 results. Conflict exists. Proceed.

### Step 2: Start the search

```
Background: []
Delta: []
Candidates: [A, B, C, D]
```

Split candidates into halves:
- Left: [A, B]
- Right: [C, D]

We'll first search Right [C, D] to see which of those are needed. We keep Left [A, B] in the background while we search.

### Step 3: Search the right half [C, D]

```
Background: [A, B]
Delta: [A, B]
Candidates: [C, D]
```

Delta is non-empty, so we do the delta check: can we eliminate all of the candidates [C, D]?

Query {A, B} → 10 results. Conflict is gone. So we can't eliminate both C and D. Keep searching.

Split candidates into halves:
- Left: [C]
- Right: [D]

We'll first search Right [D]. We keep Left [C] in the background while we search.

### Step 4: Search [D] — can we eliminate D?

```
Background: [A, B, C]
Delta: [C]
Candidates: [D]
```

Delta is non-empty, so we do the delta check: can we eliminate all candidates [D]?

To eliminate D, we test if the conflict exists without D. Query {A, B, C} → 0 results. Conflict still exists without D.

**D is eliminated.** Return [] meaning "nothing from candidates [D] is needed."

### Step 5: Search [C] — can we eliminate C?

```
Background: [A, B]
Delta: []
Candidates: [C]
```

Only 1 candidate, so this is a base case. We already know:
- {A, B} → 10 results (from step 3)
- {A, B, C} → 0 results (from step 4)

C is the difference. C cannot be eliminated. Return [C].

### Step 6: Combine results from searching [C, D]

- From searching [C]: [C] (C is needed)
- From searching [D]: [] (D eliminated)

Combined: [C]

This is the result of step 3. We now know: from the right half [C, D], only C is needed.

### Step 7: Search the left half [A, B]

Now we go back to step 2 and search the left half. We put our confirmed result [C] in the background.

```
Background: [C]
Delta: [C]
Candidates: [A, B]
```

Delta is non-empty, so we do the delta check: can we eliminate all of the candidates [A, B]?

Query {C} → 15 results. Conflict is gone. So we can't eliminate both A and B. Keep searching.

Split candidates into halves:
- Left: [A]
- Right: [B]

We'll first search Right [B]. We keep Left [A] in the background while we search.

### Step 8: Search [B] — can we eliminate B?

```
Background: [C, A]
Delta: [A]
Candidates: [B]
```

Delta is non-empty, so we do the delta check: can we eliminate all candidates [B]?

To eliminate B, we test if the conflict exists without B. Query {C, A} → 0 results. Conflict still exists without B.

**B is eliminated.** Return [] meaning "nothing from candidates [B] is needed."

### Step 9: Search [A] — can we eliminate A?

```
Background: [C]
Delta: []
Candidates: [A]
```

Only 1 candidate, so this is a base case. We already know:
- {C} → 15 results (from step 7)
- {C, A} → 0 results (from step 8)

A is the difference. A cannot be eliminated. Return [A].

### Step 10: Combine results from searching [A, B]

- From searching [A]: [A] (A is needed)
- From searching [B]: [] (B eliminated)

Combined: [A]

This is the result of step 7. We now know: from the left half [A, B], only A is needed.

### Step 11: Combine results from step 2

- From searching left [A, B]: [A]
- From searching right [C, D]: [C]

**Final answer: {A, C}**

## Summary

| Step | Background | Candidates | Query | Result | Conclusion |
|------|------------|------------|-------|--------|------------|
| 1 | - | - | {A,B,C,D} | 0 | Conflict exists |
| 3 | [A,B] | [C,D] | {A,B} | 10 | Can't eliminate both C,D |
| 4 | [A,B,C] | [D] | {A,B,C} | 0 | D eliminated |
| 7 | [C] | [A,B] | {C} | 15 | Can't eliminate both A,B |
| 8 | [C,A] | [B] | {C,A} | 0 | B eliminated |

5 queries total. Minimal conflict set: {A, C}

## Why This Is Efficient

The naive approach would test every possible subset to find the smallest broken one. With 4 constraints, that's 15 subsets.

QuickXplain uses divide-and-conquer: split in half, eliminate what you can, recurse. This gets us down to 5 queries.

With more constraints, the savings are bigger. For 100 constraints where the minimal conflict is size 3, naive might need thousands of queries. QuickXplain would need roughly 20, achieving O(k·log(n/k)) where k is the minimal conflict size and n is total constraints.

## Reference

Based on: Junker, U. (2004). "QuickXPlain: Preferred explanations and relaxations for over-constrained problems." AAAI-04.
