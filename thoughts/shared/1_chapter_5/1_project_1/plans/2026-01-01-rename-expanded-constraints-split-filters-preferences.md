# Refactor: ExpandedConstraints → ExpandedSearchCriteria + Split Filters/Preferences

## Summary

Rename `ExpandedConstraints` to `ExpandedSearchCriteria` and split `appliedConstraints` into:
- `appliedFilters` - hard constraints that exclude candidates (WHERE clauses)
- `appliedPreferences` - soft boosts for ranking (utility scoring)

**Rationale:** BOOST preferences aren't "constraints" - they don't filter, they rank. Current naming is semantically misleading.

**Breaking API Change:** Response shape changes from `{ appliedConstraints }` to `{ appliedFilters, appliedPreferences }`.

---

## New Types

```typescript
// AppliedFilter - hard constraints that filter candidates
export interface AppliedFilter {
  field: string;
  operator: string;  // 'BETWEEN', 'IN', '>=', '<=', 'STARTS WITH', etc.
  value: string;
  source: ConstraintSource;
}

// AppliedPreference - soft boosts for ranking (no operator field needed)
export interface AppliedPreference {
  field: string;
  value: string;
  source: ConstraintSource;
}
```

---

## Classification

**Filters** (push to `appliedFilters`):
- `yearsExperience` - BETWEEN, >=
- `startTimeline` - IN
- `timezone` - STARTS WITH
- `salary` - <=, >=
- `requiredSkills` - IN

**Preferences** (push to `appliedPreferences`):
- `teamFocusMatch` - source: knowledge_base
- `preferredSkills` - source: user
- `preferredSeniorityLevel` - source: user
- `preferredMaxStartTime` - source: user
- `preferredTimezone` - source: user
- `preferredSalaryRange` - source: user

---

## Files to Modify

### 1. `recommender_api/src/types/search.types.ts`
- Create `AppliedFilter` interface
- Create `AppliedPreference` interface
- Update `SearchFilterResponse` to have `appliedFilters` and `appliedPreferences`
- Remove `AppliedConstraint` type

### 2. `recommender_api/src/services/constraint-expander.service.ts`
- Rename `ExpandedConstraints` → `ExpandedSearchCriteria`
- Update `ExpansionContext` to track `filters` and `preferences` separately
- Rename `appliedConstraints` → `appliedFilters`
- Add `appliedPreferences` property
- Update helper functions to push to correct array
- Update `mergeContexts` to merge both arrays

### 3. `recommender_api/src/services/search.service.ts`
- Update import to use `ExpandedSearchCriteria`
- Extract `appliedFilters` and `appliedPreferences` from expanded result
- Pass both to API response

---

## Implementation Order

- [x] Update types in `search.types.ts`
- [x] Rename and restructure `constraint-expander.service.ts`
- [x] Update `search.service.ts`
- [x] Run typecheck
