# Refactor Start Timeline: Array-Based → Threshold-Based Matching

## Summary

Replace position-based array preference (`preferredStartTimeline: ["immediate", "two_weeks"]`) with intuitive threshold-based matching (`preferredMaxStartTime: "two_weeks"`, `requiredMaxStartTime: "one_month"`).

**Also:** Remove the base `startTimelineUtility` - timeline scoring should be purely user-driven.

**Why:**
- Engineering managers think "I need someone within X time" not "rank these options 1-5"
- Some managers don't care about 2 weeks vs 4 weeks - the system shouldn't impose hidden preferences
- Consistent with salary scoring (purely user-driven, no hidden "lower is better" bias)

## New API Contract

```typescript
// Before (array-based)
requiredStartTimeline: ["immediate", "two_weeks", "one_month"],
preferredStartTimeline: ["immediate", "two_weeks"],

// After (threshold-based)
requiredMaxStartTime: "one_month",    // Hard filter - exclude slower
preferredMaxStartTime: "two_weeks",   // Soft boost - full score if at/faster
```

## Scoring Changes

### Before (two overlapping signals)
| Weight | Component | Behavior |
|--------|-----------|----------|
| 0.11 | `startTimeline` | Base utility from fixed step function (immediate=1.0, one_year=0.1) |
| 0.03 | `preferredStartTimelineMatch` | Bonus for matching user's array preference |

### After (single user-driven signal)
| Weight | Component | Behavior |
|--------|-----------|----------|
| 0.10 | `startTimelineMatch` | Threshold-based scoring, only if user specifies preference |

**No preference specified = no timeline-based ranking at all.**

## Scoring Logic

Timeline ordinal: `immediate(0) < two_weeks(1) < one_month(2) < three_months(3) < six_months(4) < one_year(5)`

| Engineer Timeline | preferred=two_weeks, required=one_month | Score |
|-------------------|----------------------------------------|-------|
| immediate | Within preferred | 1.0 (full) |
| two_weeks | At preferred threshold | 1.0 (full) |
| one_month | At required threshold | 0.0 (linear degradation) |
| three_months+ | Beyond required | Filtered out |

**Linear degradation formula** (between preferred and required):
```
score = maxMatch * (1 - (engineerIdx - preferredIdx) / (requiredIdx - preferredIdx))
```

## Edge Cases

1. **Neither specified**: No timeline scoring (weight effectively 0)
2. **Only `preferredMaxStartTime`**: Soft boost only, no filtering
3. **Only `requiredMaxStartTime`**: Hard filter only, no scoring boost
4. **Both equal**: Binary (full score if at/faster, filtered if slower)
5. **Invalid (preferred > required)**: Add Zod validation to reject

## Files to Modify

### 1. Schema (`recommender_api/src/schemas/search.schema.ts`)
- Replace `requiredStartTimeline: z.array(...)` → `requiredMaxStartTime: StartTimelineSchema.optional()`
- Replace `preferredStartTimeline: z.array(...)` → `preferredMaxStartTime: StartTimelineSchema.optional()`
- Add refinement: preferred index <= required index

### 2. Types (`recommender_api/src/types/knowledge-base.types.ts`)
- Update `SearchDefaults.requiredStartTimeline: StartTimeline[]` → `requiredMaxStartTime: StartTimeline`
- Remove `StartTimelineUtility` type if no longer needed

### 3. Response Types (`recommender_api/src/types/search.types.ts`)
- Update `PreferredStartTimelineMatch`: replace `rank: number` → `withinPreferred: boolean`

### 4. Defaults (`recommender_api/src/config/knowledge-base/defaults.config.ts`)
- Change from array to single value: `requiredMaxStartTime: 'one_year'` (allows all)

### 5. Utility Config (`recommender_api/src/config/knowledge-base/utility.config.ts`)
- **Remove** `startTimeline: 0.11` weight
- **Remove** `startTimelineUtility` step function config
- **Rename** `preferredStartTimelineMatch: 0.03` → `startTimelineMatch: 0.10`
- Update comment to THRESHOLD-BASED explanation
- Redistribute weights to sum to 1.0

### 6. Constraint Expander (`recommender_api/src/services/constraint-expander.service.ts`)
- Update `ExpandedConstraints` interface
- Rewrite `expandStartTimelineConstraint()` to convert threshold → array of allowed values
- Update pass-through: `preferredMaxStartTime: StartTimeline | null`

### 7. Utility Calculator (`recommender_api/src/services/utility-calculator.service.ts`)
- **Remove** `calculateStartTimelineUtility()` function (the base step function)
- **Remove** its usage in `calculateUtilityWithBreakdown()` and `calculateUtilityScore()`
- Update `UtilityContext` to use `preferredMaxStartTime` and `requiredMaxStartTime`
- Rewrite `calculatePreferredStartTimelineMatch()` → `calculateStartTimelineMatch()` with threshold logic
- Update result type to use `withinPreferred` instead of `rank`

### 8. Search Service (`recommender_api/src/services/search.service.ts`)
- Wire up new context fields when constructing `UtilityContext`

### 9. Tests
- Update test fixtures and assertions for new field names and scoring behavior

## Weight Redistribution

Current weights sum to 1.0. After removing `startTimeline: 0.11` and changing `preferredStartTimelineMatch: 0.03` → `startTimelineMatch: 0.10`:

Net change: -0.11 + 0.07 = -0.04 to redistribute

Options:
- Add to `skillMatch` (most important signal): 0.22 → 0.26
- Or spread across multiple attributes proportionally

## Implementation Order

1. [x] Types/Schema (no runtime impact)
2. [x] Config files (weights, remove step function)
3. [x] Constraint expander (threshold → array conversion)
4. [x] Utility calculator (remove base utility, new threshold scoring)
5. [x] Search service (wire up)
6. [x] Tests
