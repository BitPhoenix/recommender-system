# Critique Endpoint E2E Test Results

**Date**: 2026-01-19
**Endpoint**: `POST /api/search/critique`
**Test Framework**: Newman (Postman CLI)
**Total Tests**: 12
**Total Assertions**: 35
**Result**: All passing (35/35 assertions)

---

## Test Summary

| Test # | Name | Status | Key Verification |
|--------|------|--------|------------------|
| 74 | Basic Seniority Adjustment | PASS | Seniority `mid` → `senior` with metadata |
| 75 | Budget Set Operation | PASS | Direct value assignment via `set` |
| 76 | Failed Adjustment (No Budget) | PASS | Graceful failure with reason |
| 77 | Compound Adjustment | PASS | Multiple adjustments in single request |
| 78 | Mixed Success/Failure | PASS | Partial success handling |
| 79 | Timeline Adjustment (Sooner) | PASS | Directional timeline constraint |
| 80 | Add Skill Requirement | PASS | Collection property modification |
| 81 | Dynamic Suggestions | PASS | Pattern mining for suggestions |
| 82 | Already at Maximum Warning | PASS | Boundary condition with warning |
| 83 | Validation Error (Invalid Direction) | PASS | Schema validation enforcement |
| 84 | Validation Error (Missing Adjustments) | PASS | Required field validation |
| 85 | Timezone Set Operation | PASS | Array value assignment |

---

## Test 74: Basic Seniority Adjustment

### Request
```json
POST /api/search/critique
{
  "baseSearch": {
    "requiredSeniorityLevel": "mid"
  },
  "adjustments": [
    {
      "property": "seniority",
      "operation": "adjust",
      "direction": "more"
    }
  ]
}
```

### Expected Behavior
- Translate `adjust` + `direction: more` on seniority to level upgrade (mid → senior)
- Return critique metadata showing what changed
- Track result count change from applying the critique

### Actual Response (key fields)
```json
{
  "totalCount": 15,
  "critique": {
    "appliedCritiqueAdjustments": [
      {
        "property": "seniority",
        "operation": "adjust",
        "direction": "more",
        "modifiedField": "requiredSeniorityLevel",
        "previousValue": "mid",
        "newValue": "senior"
      }
    ],
    "failedCritiqueAdjustments": [],
    "previousResultCount": 0,
    "resultCountChange": 15
  },
  "appliedFilters": [
    {
      "field": "yearsExperience",
      "operator": "BETWEEN",
      "value": "6 AND 10",
      "source": "knowledge_base"
    }
  ]
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Response has critique metadata: **PASS**
- Seniority adjustment was applied: **PASS**
- Result count change is tracked: **PASS**

### Notes
The critique interpreter correctly maps "more" seniority to the next level in the progression (junior → mid → senior → staff → principal). The `previousValue` and `newValue` fields provide full transparency. The seniority level is translated to years of experience filter (6-10 years for senior) via the knowledge base.

---

## Test 75: Budget Set Operation

### Request
```json
POST /api/search/critique
{
  "baseSearch": {},
  "adjustments": [
    {
      "property": "budget",
      "operation": "set",
      "value": 150000
    }
  ]
}
```

### Expected Behavior
- Use `set` operation to directly assign budget constraint
- Apply budget as salary filter (`<=` operator)

### Actual Response (key fields)
```json
{
  "totalCount": 13,
  "critique": {
    "appliedCritiqueAdjustments": [
      {
        "property": "budget",
        "operation": "set",
        "value": 150000,
        "modifiedField": "maxBudget",
        "previousValue": null,
        "newValue": 150000
      }
    ],
    "failedCritiqueAdjustments": []
  },
  "appliedFilters": [
    {
      "field": "salary",
      "operator": "<=",
      "value": "150000",
      "source": "user"
    }
  ]
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Budget set to specified value: **PASS**

### Notes
The `set` operation bypasses directional interpretation and directly assigns the value. The `previousValue: null` indicates no budget was set in the base search. The budget is translated to a salary filter with upper bound.

---

## Test 76: Failed Adjustment (No Budget to Adjust)

### Request
```json
POST /api/search/critique
{
  "baseSearch": {},
  "adjustments": [
    {
      "property": "budget",
      "operation": "adjust",
      "direction": "more"
    }
  ]
}
```

### Expected Behavior
- Fail gracefully when trying to adjust a non-existent constraint
- Provide clear reason in `failedCritiqueAdjustments`
- Still return results (the failed adjustment doesn't block the search)

### Actual Response (key fields)
```json
{
  "totalCount": 40,
  "critique": {
    "appliedCritiqueAdjustments": [],
    "failedCritiqueAdjustments": [
      {
        "property": "budget",
        "operation": "adjust",
        "direction": "more",
        "targetField": "maxBudget",
        "reason": "No budget constraint set - cannot adjust a non-existent value"
      }
    ],
    "previousResultCount": 0,
    "resultCountChange": 40
  }
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Budget adjustment failed (no budget set): **PASS**
- No adjustments were applied: **PASS**

### Notes
This demonstrates the semantic difference between `adjust` and `set`: you can only `adjust` existing values, but you can always `set` a new value. The API returns 200 (not an error) because the request was valid - the adjustment simply couldn't be applied. This allows compound critiques to partially succeed.

---

## Test 77: Compound Adjustment (Seniority + Budget)

### Request
```json
POST /api/search/critique
{
  "baseSearch": {
    "requiredSeniorityLevel": "mid",
    "maxBudget": 100000
  },
  "adjustments": [
    {
      "property": "seniority",
      "operation": "adjust",
      "direction": "more"
    },
    {
      "property": "budget",
      "operation": "adjust",
      "direction": "more"
    }
  ]
}
```

### Expected Behavior
- Apply multiple adjustments atomically (Section 5.3.2.2 compound critiques)
- Seniority: mid → senior
- Budget: $100,000 → $120,000 (20% increase per config)

### Actual Response (key fields)
```json
{
  "totalCount": 0,
  "critique": {
    "appliedCritiqueAdjustments": [
      {
        "property": "seniority",
        "operation": "adjust",
        "direction": "more",
        "modifiedField": "requiredSeniorityLevel",
        "previousValue": "mid",
        "newValue": "senior"
      },
      {
        "property": "budget",
        "operation": "adjust",
        "direction": "more",
        "modifiedField": "maxBudget",
        "previousValue": 100000,
        "newValue": 120000
      }
    ],
    "failedCritiqueAdjustments": [],
    "previousResultCount": 0,
    "resultCountChange": 0
  }
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Both adjustments were applied: **PASS**
- Seniority increased: **PASS**
- Budget increased by 20%: **PASS**

### Notes
Compound critiques allow users to make multiple refinements in a single interaction. The budget adjustment uses a configurable factor (default 20%) to determine the "more" increment. Result count of 0 indicates these combined constraints are too restrictive - the system correctly applies both but no engineers match (senior level engineers typically earn more than $120k).

---

## Test 78: Mixed Success/Failure

### Request
```json
POST /api/search/critique
{
  "baseSearch": {
    "requiredSeniorityLevel": "mid"
  },
  "adjustments": [
    {
      "property": "seniority",
      "operation": "adjust",
      "direction": "more"
    },
    {
      "property": "budget",
      "operation": "adjust",
      "direction": "more"
    }
  ]
}
```

### Expected Behavior
- Seniority adjustment succeeds (mid → senior)
- Budget adjustment fails (no budget in base search)
- Report both outcomes separately

### Actual Response (key fields)
```json
{
  "critique": {
    "appliedCritiqueAdjustments": [
      {
        "property": "seniority",
        "operation": "adjust",
        "direction": "more",
        "modifiedField": "requiredSeniorityLevel",
        "previousValue": "mid",
        "newValue": "senior"
      }
    ],
    "failedCritiqueAdjustments": [
      {
        "property": "budget",
        "operation": "adjust",
        "direction": "more",
        "targetField": "maxBudget",
        "reason": "No budget constraint set - cannot adjust a non-existent value"
      }
    ],
    "previousResultCount": 0,
    "resultCountChange": 15
  }
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Seniority adjustment succeeded: **PASS**
- Budget adjustment failed: **PASS**

### Notes
This demonstrates partial success in compound critiques. The API applies what it can and reports what it couldn't, giving the client full visibility. The search still executes with the successfully applied adjustments, returning 15 senior-level engineers.

---

## Test 79: Timeline Adjustment (Sooner)

### Request
```json
POST /api/search/critique
{
  "baseSearch": {
    "requiredMaxStartTime": "one_month"
  },
  "adjustments": [
    {
      "property": "timeline",
      "operation": "adjust",
      "direction": "sooner"
    }
  ]
}
```

### Expected Behavior
- Translate `sooner` direction to tighter timeline constraint
- Move from `one_month` → `two_weeks` in the timeline ordering

### Actual Response (key fields)
```json
{
  "totalCount": 25,
  "critique": {
    "appliedCritiqueAdjustments": [
      {
        "property": "timeline",
        "operation": "adjust",
        "direction": "sooner",
        "modifiedField": "requiredMaxStartTime",
        "previousValue": "one_month",
        "newValue": "two_weeks"
      }
    ],
    "failedCritiqueAdjustments": [],
    "previousResultCount": 0,
    "resultCountChange": 25
  }
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Timeline made sooner: **PASS**

### Notes
Timeline uses different direction words (`sooner`/`later`) than other properties (`more`/`less`) to match natural language. The ordering is: immediate < two_weeks < one_month < three_months < six_months < one_year. "Sooner" moves toward `immediate`, "later" moves toward `one_year`.

---

## Test 80: Add Skill Requirement

### Request
```json
POST /api/search/critique
{
  "baseSearch": {},
  "adjustments": [
    {
      "property": "skills",
      "operation": "add",
      "value": {
        "skill": "Python",
        "proficiency": "proficient"
      }
    }
  ]
}
```

### Expected Behavior
- Add Python skill requirement to the search
- Translate to `requiredSkills` array with proficiency filter

### Actual Response (key fields)
```json
{
  "totalCount": 18,
  "critique": {
    "appliedCritiqueAdjustments": [
      {
        "property": "skills",
        "operation": "add",
        "value": {
          "skill": "Python",
          "proficiency": "proficient"
        },
        "modifiedField": "requiredSkills",
        "previousValue": null,
        "newValue": [
          {
            "skill": "Python",
            "minProficiency": "proficient"
          }
        ]
      }
    ],
    "failedCritiqueAdjustments": [],
    "previousResultCount": 0,
    "resultCountChange": 18
  },
  "matches": [
    {
      "id": "eng_robert",
      "name": "Robert Mitchell",
      "matchedSkills": [
        {
          "skillId": "skill_python",
          "skillName": "Python",
          "proficiencyLevel": "expert",
          "confidenceScore": 0.98,
          "yearsUsed": 14,
          "matchType": "direct"
        }
      ],
      "utilityScore": 0.39
    }
  ]
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Skill added to requirements: **PASS**
- Result count tracked for skill addition: **PASS**

### Notes
The `add` operation is for collection properties (skills, businessDomains, technicalDomains). It appends to existing requirements rather than replacing them. The response shows matched skills with full details including proficiency level and years of experience.

---

## Test 81: Dynamic Suggestions Returned

### Request
```json
POST /api/search/critique
{
  "baseSearch": {},
  "adjustments": [
    {
      "property": "seniority",
      "operation": "set",
      "value": "mid"
    }
  ],
  "limit": 20
}
```

### Expected Behavior
- Generate dynamic critique suggestions based on result patterns (Section 5.3.2.3)
- Order suggestions by ascending support (low-support patterns first)
- Include actionable adjustments that could refine results

### Actual Response (key fields)
```json
{
  "totalCount": 13,
  "critique": {
    "appliedCritiqueAdjustments": [
      {
        "property": "seniority",
        "operation": "set",
        "value": "mid",
        "modifiedField": "requiredSeniorityLevel",
        "previousValue": null,
        "newValue": "mid"
      }
    ]
  },
  "suggestedCritiques": [
    {
      "adjustments": [
        {
          "property": "timezone",
          "operation": "set",
          "value": "Central"
        }
      ],
      "description": "Require Central timezone",
      "resultingMatches": 2,
      "support": 0.15,
      "rationale": "15% of current engineers are in Central timezone"
    },
    {
      "adjustments": [
        {
          "property": "timezone",
          "operation": "set",
          "value": "Mountain"
        }
      ],
      "description": "Require Mountain timezone",
      "resultingMatches": 4,
      "support": 0.31,
      "rationale": "31% of current engineers are in Mountain timezone"
    },
    {
      "adjustments": [
        {
          "property": "timeline",
          "operation": "set",
          "value": "immediate"
        }
      ],
      "description": "Require immediate or sooner",
      "resultingMatches": 4,
      "support": 0.31,
      "rationale": "31% of current engineers available immediate or sooner"
    },
    {
      "adjustments": [
        {
          "property": "budget",
          "operation": "set",
          "value": 125000
        }
      ],
      "description": "Lower budget to $125,000",
      "resultingMatches": 4,
      "support": 0.31,
      "rationale": "31% of current engineers have salaries at or below $125,000"
    },
    {
      "adjustments": [
        {
          "property": "timezone",
          "operation": "set",
          "value": "Pacific"
        }
      ],
      "description": "Require Pacific timezone",
      "resultingMatches": 6,
      "support": 0.46,
      "rationale": "46% of current engineers are in Pacific timezone"
    }
  ]
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Response has matches (for suggestions to be generated): **PASS**
- suggestedCritiques array is present when results exist: **PASS**
- Each suggestion has required fields: **PASS**
- Suggestions ordered by ascending support: **PASS**

### Notes
Dynamic critique suggestions implement the pattern mining approach from Section 5.3.2.3. Suggestions are ordered by ascending support so users see less common (more differentiating) options first. Each suggestion includes a ready-to-use `adjustments` array that can be sent directly to the critique endpoint.

---

## Test 82: Already at Maximum Warning

### Request
```json
POST /api/search/critique
{
  "baseSearch": {
    "requiredSeniorityLevel": "principal"
  },
  "adjustments": [
    {
      "property": "seniority",
      "operation": "adjust",
      "direction": "more"
    }
  ]
}
```

### Expected Behavior
- Recognize that `principal` is the maximum seniority level
- Apply the adjustment (no-op) but include a warning
- Do not treat this as a failure

### Actual Response (key fields)
```json
{
  "totalCount": 1,
  "critique": {
    "appliedCritiqueAdjustments": [
      {
        "property": "seniority",
        "operation": "adjust",
        "direction": "more",
        "modifiedField": "requiredSeniorityLevel",
        "previousValue": "principal",
        "newValue": "principal",
        "warning": "Already at maximum seniority (principal)"
      }
    ],
    "failedCritiqueAdjustments": [],
    "previousResultCount": 0,
    "resultCountChange": 1
  }
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Adjustment applied with warning: **PASS**
- Value remains at maximum: **PASS**

### Notes
Boundary conditions are handled gracefully with warnings rather than errors. The adjustment is technically "applied" (put in `appliedCritiqueAdjustments`) because the intent was valid - it just couldn't make a change. This is semantically different from a failed adjustment (which indicates the adjustment couldn't be applied at all). The warning provides user feedback without breaking the flow.

---

## Test 83: Validation Error (Invalid Direction)

### Request
```json
POST /api/search/critique
{
  "baseSearch": {},
  "adjustments": [
    {
      "property": "seniority",
      "operation": "adjust",
      "direction": "sooner"
    }
  ]
}
```

### Expected Behavior
- Reject request at validation layer
- `sooner` is not valid for `seniority` (only `more`/`less`)
- Return 400 with clear error message

### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "code": "custom",
        "message": "Invalid direction 'sooner' for property 'seniority'. Valid: more, less",
        "path": ["adjustments", 0, "direction"]
      }
    ],
    "name": "ZodError"
  }
}
```

### Assertions Verified
- Status code is 400 (validation error): **PASS**
- Error response indicates validation failure: **PASS**

### Notes
The Zod schema enforces property-specific direction validation. Each property has a defined set of valid directions:
- `seniority`, `budget`, `skills`, domains: `more`, `less`
- `timeline`: `sooner`, `later`
- `timezone`: `narrower`, `wider`

This prevents semantically meaningless requests at the API boundary.

---

## Test 84: Validation Error (Missing Adjustments)

### Request
```json
POST /api/search/critique
{
  "baseSearch": {},
  "adjustments": []
}
```

### Expected Behavior
- Reject request with empty adjustments array
- Critiques require at least one adjustment

### Actual Response
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "origin": "array",
        "code": "too_small",
        "minimum": 1,
        "inclusive": true,
        "path": ["adjustments"],
        "message": "At least one adjustment is required"
      }
    ],
    "name": "ZodError"
  }
}
```

### Assertions Verified
- Status code is 400 (validation error): **PASS**
- Error indicates adjustments required: **PASS**

### Notes
A critique without adjustments is meaningless - it would be identical to the base search. The schema enforces `min(1)` on the adjustments array to prevent this.

---

## Test 85: Timezone Set Operation

### Request
```json
POST /api/search/critique
{
  "baseSearch": {},
  "adjustments": [
    {
      "property": "timezone",
      "operation": "set",
      "value": ["Pacific"]
    }
  ]
}
```

### Expected Behavior
- Accept array value for timezone (multi-timezone support)
- Apply as `IN` filter for timezone field

### Actual Response (key fields)
```json
{
  "totalCount": 15,
  "critique": {
    "appliedCritiqueAdjustments": [
      {
        "property": "timezone",
        "operation": "set",
        "value": ["Pacific"],
        "modifiedField": "requiredTimezone",
        "previousValue": null,
        "newValue": ["Pacific"]
      }
    ],
    "failedCritiqueAdjustments": []
  },
  "appliedFilters": [
    {
      "field": "timezone",
      "operator": "IN",
      "value": "[\"Pacific\"]",
      "source": "user"
    }
  ]
}
```

### Assertions Verified
- Status code is 200: **PASS**
- Timezone set correctly: **PASS**

### Notes
Timezone accepts an array to support multi-timezone requirements (e.g., `["Eastern", "Central"]` for East Coast compatible). The value is applied as an `IN` filter. Single values are also accepted for convenience and wrapped into an array.

---

## API Design Highlights

### Unified Adjustment Structure

All adjustments follow a consistent pattern:
```typescript
{
  property: CritiquableProperty,  // What to change
  operation: 'adjust' | 'set' | 'add' | 'remove',  // How to change it
  direction?: Direction,  // For 'adjust' operations
  value?: any,  // For 'set' and 'add' operations
  item?: string  // For 'remove' and collection 'adjust'
}
```

### Transparency in Response

Every critique response includes:
- `appliedCritiqueAdjustments`: What changed, with `previousValue` → `newValue`
- `failedCritiqueAdjustments`: What couldn't be applied and why
- `previousResultCount` / `resultCountChange`: Impact tracking
- `warning`: Boundary conditions or special cases

### Dynamic Suggestions

The system mines patterns from current results to suggest next critiques:
- Ordered by ascending support (rarer patterns first)
- Ready-to-use `adjustments` arrays
- Human-readable descriptions and rationales

---

## Conclusion

All 12 critique endpoint tests pass, validating:
1. **Core Operations**: adjust, set, add work correctly
2. **Compound Critiques**: Multiple adjustments in single request
3. **Graceful Degradation**: Partial success with clear failure reasons
4. **Boundary Handling**: Warnings for edge cases (max values)
5. **Schema Validation**: Invalid requests rejected with helpful messages
6. **Dynamic Suggestions**: Pattern mining generates useful refinements

The critique system successfully implements Section 5.3.2 of the textbook, providing a conversational refinement interface for search results.
