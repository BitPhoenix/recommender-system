# Canonical Configuration Sources

**Never redefine mappings or orderings that are already configured.** Always import from the canonical source. This prevents bugs where a change in one place leaves other copies stale.

## Domain Mappings

| Configuration | Canonical Source | Description |
|--------------|------------------|-------------|
| Seniority → Years | `config/knowledge-base/compatibility-constraints.config.ts` → `seniorityMapping` | Maps seniority levels to yearsExperience ranges (e.g., senior = 6-10 years) |
| Seniority min years | `config/knowledge-base/utility.config.ts` → `seniorityMinYears` | Derived from seniorityMapping, provides just the minimum years per level |
| Team focus → Skills | `config/knowledge-base/compatibility-constraints.config.ts` → `teamFocusSkillAlignment` | Maps team focus to contextually relevant skills |
| US Timezone Zones | `config/knowledge-base/compatibility-constraints.config.ts` → `usTimezoneZones` | Valid timezone values: Eastern, Central, Mountain, Pacific (stored directly on Engineer, not IANA identifiers) |

## Ordered Values

| Configuration | Canonical Source | Description |
|--------------|------------------|-------------|
| Start timeline order | `types/search.types.ts` → `StartTimeline` | Ordered from fastest to slowest: immediate, two_weeks, one_month, three_months |
| Proficiency order | `types/search.types.ts` → `ProficiencyLevel` | Ordered from lowest to highest: familiar, proficient, expert |
| Timezone zones (E→W) | `config/knowledge-base/compatibility-constraints.config.ts` → `usTimezoneZones` | Ordered East to West: Eastern, Central, Mountain, Pacific |

## Usage Pattern

```typescript
/* Good: import from canonical source */
import { seniorityMapping } from "../../config/knowledge-base/compatibility-constraints.config";

const staffRange = seniorityMapping.staff; // { minYears: 10, maxYears: null }

/* Bad: redefining the mapping */
const STAFF_MIN_YEARS = 10; // Will become stale if seniorityMapping changes
```

When writing Cypher queries or generating output that depends on these values, pass them as parameters rather than hardcoding:

```typescript
/* Good: parameterized from config */
const { junior, mid, senior, staff } = seniorityMapping;
await session.run(`
  MATCH (e:Engineer)
  RETURN sum(CASE WHEN e.yearsExperience >= $staffMin THEN 1 ELSE 0 END) as staffCount
`, { staffMin: staff.minYears });

/* Bad: hardcoded values */
await session.run(`
  MATCH (e:Engineer)
  RETURN sum(CASE WHEN e.yearsExperience >= 10 THEN 1 ELSE 0 END) as staffCount
`);
```
