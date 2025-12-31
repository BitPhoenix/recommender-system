# BELONGS_TO Category Relationship Implementation Plan

## Overview

Introduce a new `BELONGS_TO` relationship type for non-transitive category membership, separate from the existing `CHILD_OF` relationship used for transitive language/framework inheritance.

## Problem Statement

When searching for `requiredSkills: ["Frontend"]`, Marcus returns Node.js and Express in `matchedSkills`. This happens because:

1. `CHILD_OF` is used for both language inheritance AND category membership
2. JavaScript is added as `CHILD_OF Frontend`
3. Node.js is `CHILD_OF JavaScript` (language inheritance)
4. The query traverses: `Frontend → JavaScript → Node.js → Express`
5. Result: Backend skills incorrectly appear as "Frontend" skills

## Desired End State

| Relationship | Meaning | Transitive? | Use Case |
|--------------|---------|-------------|----------|
| `CHILD_OF` | "is built on" / "inherits from" | Yes | Express → Node.js → JavaScript |
| `BELONGS_TO` | "is categorized as" | No | React → Frontend, Node.js → Backend |

**Verification:**
```bash
# Search for Frontend skills
curl -X POST http://localhost:4025/api/search/filter \
  -H "Content-Type: application/json" \
  -d '{"requiredSkills": ["Frontend"], "availability": ["immediate"]}'

# Expected: Marcus returns with matchedSkills containing ONLY:
# - React, Next.js, TypeScript (Frontend skills)
# NOT: Node.js, Express, PostgreSQL (Backend skills)
```

## What We're NOT Doing

- Not changing the existing `CHILD_OF` relationships for language inheritance
- Not removing the role-based categories (Backend, Frontend, Full Stack)
- Not modifying the `CORRELATES_WITH` relationship

---

## Phase 1: Add BELONGS_TO Type and Data

### Overview
Add the new type definition and create the category membership data array.

### Changes Required:

#### 1. Add Type Definition
**File**: `seeds/types.ts`
**Changes**: Add new interface for category membership

```typescript
// Add after SkillHierarchy interface (around line 30)
export interface SkillCategoryMembership {
  skillId: string;
  categoryId: string;
}
```

#### 2. Create Category Membership Data
**File**: `seeds/skills.ts`
**Changes**: Add new `skillCategoryMemberships` array and remove role-based entries from `skillHierarchy`

```typescript
// Add new export after skillHierarchy
export const skillCategoryMemberships: SkillCategoryMembership[] = [
  // Frontend skills
  { skillId: 'skill_javascript', categoryId: 'cat_frontend' },
  { skillId: 'skill_typescript', categoryId: 'cat_frontend' },
  { skillId: 'skill_react', categoryId: 'cat_frontend' },
  { skillId: 'skill_nextjs', categoryId: 'cat_frontend' },
  { skillId: 'skill_vue', categoryId: 'cat_frontend' },
  { skillId: 'skill_angular', categoryId: 'cat_frontend' },

  // Backend skills - languages
  { skillId: 'skill_javascript', categoryId: 'cat_backend' },  // JS is BOTH!
  { skillId: 'skill_typescript', categoryId: 'cat_backend' },  // TS is BOTH!
  { skillId: 'skill_nodejs', categoryId: 'cat_backend' },
  { skillId: 'skill_express', categoryId: 'cat_backend' },
  { skillId: 'skill_nestjs', categoryId: 'cat_backend' },
  { skillId: 'skill_python', categoryId: 'cat_backend' },
  { skillId: 'skill_django', categoryId: 'cat_backend' },
  { skillId: 'skill_fastapi', categoryId: 'cat_backend' },
  { skillId: 'skill_java', categoryId: 'cat_backend' },
  { skillId: 'skill_spring', categoryId: 'cat_backend' },
  { skillId: 'skill_go', categoryId: 'cat_backend' },
  { skillId: 'skill_rust', categoryId: 'cat_backend' },
  // Backend - databases
  { skillId: 'skill_postgresql', categoryId: 'cat_backend' },
  { skillId: 'skill_mysql', categoryId: 'cat_backend' },
  { skillId: 'skill_mongodb', categoryId: 'cat_backend' },
  { skillId: 'skill_redis', categoryId: 'cat_backend' },
  { skillId: 'skill_dynamodb', categoryId: 'cat_backend' },
  { skillId: 'skill_neo4j', categoryId: 'cat_backend' },
  { skillId: 'skill_kafka', categoryId: 'cat_backend' },
  // Backend - architecture
  { skillId: 'skill_api_design', categoryId: 'cat_backend' },
  { skillId: 'skill_rest_api', categoryId: 'cat_backend' },
  { skillId: 'skill_graphql', categoryId: 'cat_backend' },
  { skillId: 'skill_grpc', categoryId: 'cat_backend' },
  { skillId: 'skill_system_design', categoryId: 'cat_backend' },
  { skillId: 'skill_microservices', categoryId: 'cat_backend' },
  { skillId: 'skill_event_driven', categoryId: 'cat_backend' },
  { skillId: 'skill_distributed', categoryId: 'cat_backend' },

  // Full Stack = skills that belong to BOTH Frontend and Backend
  // (handled by having skills in both categories above)
  // The cat_fullstack category itself gets BELONGS_TO from cat_backend and cat_frontend
  { skillId: 'cat_backend', categoryId: 'cat_fullstack' },
  { skillId: 'cat_frontend', categoryId: 'cat_fullstack' },
];
```

#### 3. Remove Role-Based CHILD_OF Entries from skillHierarchy
**File**: `seeds/skills.ts`
**Changes**: Delete lines 310-355 (the role-based category CHILD_OF relationships)

Remove this entire section:
```typescript
// DELETE THESE LINES (310-355):
  // Role-based categories (Backend, Frontend, Full Stack)
  // These are virtual groupings that span multiple subcategories
  { childSkillId: 'cat_backend', parentSkillId: 'cat_technical' },
  { childSkillId: 'cat_frontend', parentSkillId: 'cat_technical' },
  { childSkillId: 'cat_fullstack', parentSkillId: 'cat_technical' },
  // ... all the Backend skills - server-side languages and frameworks ...
  // ... all the Frontend skills - client-side frameworks ...
  // ... Full Stack combines Backend and Frontend ...
```

#### 4. Export from Index
**File**: `seeds/index.ts`
**Changes**: Export the new array

```typescript
export { skillCategoryMemberships } from './skills';
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `cd seeds && npx tsc --noEmit`
- [x] No duplicate exports or type errors

#### Manual Verification:
- [ ] Review that all Frontend skills are correctly categorized
- [ ] Review that all Backend skills are correctly categorized
- [ ] Verify JavaScript/TypeScript appear in BOTH categories

---

## Phase 2: Update Seed Script

### Overview
Add seeding function for BELONGS_TO relationships.

### Changes Required:

#### 1. Add Seed Function
**File**: `seeds/seed.ts`
**Changes**: Add new function to create BELONGS_TO relationships

```typescript
// Add after seedSkillHierarchy function (around line 94)
async function seedSkillCategoryMemberships(session: Session): Promise<void> {
  console.log('🏷️  Seeding skill category memberships...');

  for (const membership of data.skillCategoryMemberships) {
    await session.run(
      `MATCH (skill:Skill {id: $skillId})
       MATCH (category:Skill {id: $categoryId})
       MERGE (skill)-[:BELONGS_TO]->(category)`,
      {
        skillId: membership.skillId,
        categoryId: membership.categoryId,
      }
    );
  }
  console.log(`   ✓ Seeded ${data.skillCategoryMemberships.length} category membership relationships`);
}
```

#### 2. Call the New Function
**File**: `seeds/seed.ts`
**Changes**: Add call in the main seed flow

```typescript
// In the seed() function, after seedSkillCorrelations (around line 445)
if (shouldSeedCategory('skills')) {
  await seedSkills(session);
  await seedSkillHierarchy(session);
  await seedSkillCategoryMemberships(session);  // ADD THIS LINE
  await seedSkillCorrelations(session);
}
```

### Success Criteria:

#### Automated Verification:
- [x] Seed script compiles: `cd seeds && npx tsc --noEmit`
- [x] Seed script runs successfully: `cd seeds && npx tsx seed.ts skills`
- [x] Console shows: `✓ Seeded 35 category membership relationships`

#### Manual Verification:
- [ ] Verify in Neo4j Browser: `MATCH (s:Skill)-[:BELONGS_TO]->(c:Skill) RETURN s.name, c.name LIMIT 20`

---

## Phase 3: Update Skill Resolver

### Overview
Modify the skill resolver to use BELONGS_TO for categories (non-transitive) and CHILD_OF for regular skills (transitive).

### Changes Required:

#### 1. Update resolveSkillHierarchy Function
**File**: `recommender_api/src/services/skill-resolver.service.ts`
**Changes**: Replace the leaf query with a UNION query

```typescript
export async function resolveSkillHierarchy(
  session: Session,
  skillIdentifiers: string[]
): Promise<SkillResolutionResult> {
  if (!skillIdentifiers || skillIdentifiers.length === 0) {
    return { resolvedSkills: [], expandedSkillNames: [], matchedIdentifiers: [] };
  }

  // Query that handles BOTH category lookups (BELONGS_TO) and skill inheritance (CHILD_OF)
  const leafQuery = `
// First: Find role-based categories (Backend, Frontend, Full Stack) and get skills via BELONGS_TO
MATCH (rootSkill:Skill)
WHERE (rootSkill.id IN $skillIdentifiers OR rootSkill.name IN $skillIdentifiers)
  AND rootSkill.isCategory = true
  AND rootSkill.id IN ['cat_backend', 'cat_frontend', 'cat_fullstack']

// For role categories, use BELONGS_TO (non-transitive, 1 hop only)
MATCH (leafSkill:Skill)-[:BELONGS_TO]->(rootSkill)
WHERE leafSkill.isCategory = false
RETURN DISTINCT leafSkill.id AS skillId, leafSkill.name AS skillName

UNION

// Second: For other categories (like "Databases"), use CHILD_OF (transitive)
MATCH (rootSkill:Skill)
WHERE (rootSkill.id IN $skillIdentifiers OR rootSkill.name IN $skillIdentifiers)
  AND rootSkill.isCategory = true
  AND NOT rootSkill.id IN ['cat_backend', 'cat_frontend', 'cat_fullstack']

MATCH (descendant:Skill)-[:CHILD_OF*0..]->(rootSkill)
WHERE descendant.isCategory = false
RETURN DISTINCT descendant.id AS skillId, descendant.name AS skillName

UNION

// Third: For regular skills (not categories), use CHILD_OF (transitive)
MATCH (rootSkill:Skill)
WHERE (rootSkill.id IN $skillIdentifiers OR rootSkill.name IN $skillIdentifiers)
  AND rootSkill.isCategory = false

MATCH (descendant:Skill)-[:CHILD_OF*0..]->(rootSkill)
WHERE descendant.isCategory = false
RETURN DISTINCT descendant.id AS skillId, descendant.name AS skillName
`;

  // Query to find which identifiers matched (including categories)
  const matchedQuery = `
UNWIND $skillIdentifiers AS identifier
MATCH (s:Skill)
WHERE s.id = identifier OR s.name = identifier
RETURN DISTINCT identifier
`;

  const leafResult = await session.run(leafQuery, { skillIdentifiers });
  const matchedResult = await session.run(matchedQuery, { skillIdentifiers });

  const resolvedSkills: ResolvedSkill[] = leafResult.records.map((record) => ({
    skillId: record.get('skillId') as string,
    skillName: record.get('skillName') as string,
  }));

  const expandedSkillNames = resolvedSkills.map((s) => s.skillName);
  const matchedIdentifiers = matchedResult.records.map(
    (record) => record.get('identifier') as string
  );

  return { resolvedSkills, expandedSkillNames, matchedIdentifiers };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `cd recommender_api && npm run build`
- [x] API starts successfully

#### Manual Verification:
- [x] Test Frontend search returns only frontend skills
- [x] Test Backend search returns only backend skills
- [x] Test "JavaScript" search still returns all JS descendants (transitive)

**Note:** Query was refactored to use generic variable-depth traversal (`BELONGS_TO*1..2`) instead of hardcoding category IDs. This makes adding new composite categories automatic.

---

## Phase 4: Re-seed and Test

### Overview
Apply all changes and verify the fix.

### Steps:

1. **Re-seed the database:**
```bash
cd seeds && npx tsx seed.ts skills
```

2. **Restart the API (if not using hot reload):**
```bash
# Tilt should auto-reload, or manually restart
```

3. **Test the fix:**

**Test 1: Frontend search**
```bash
curl -s -X POST http://localhost:4025/api/search/filter \
  -H "Content-Type: application/json" \
  -d '{"requiredSkills": ["Frontend"], "availability": ["immediate"]}' | jq '.matches[0].matchedSkills'
```
Expected: Only React, Next.js, TypeScript, Vue, Angular, JavaScript - NO Node.js, Express

**Test 2: Backend search**
```bash
curl -s -X POST http://localhost:4025/api/search/filter \
  -H "Content-Type: application/json" \
  -d '{"requiredSkills": ["Backend"], "seniorityLevel": "senior"}' | jq '.matches[0].matchedSkills'
```
Expected: Node.js, Express, PostgreSQL, etc. - NO React, Vue

**Test 3: JavaScript search (should still be transitive)**
```bash
curl -s -X POST http://localhost:4025/api/search/filter \
  -H "Content-Type: application/json" \
  -d '{"requiredSkills": ["JavaScript"]}' | jq '.queryMetadata.skillsExpanded'
```
Expected: ALL JavaScript descendants including Node.js, Express, React, Vue, etc.

**Test 4: Full Stack search**
```bash
curl -s -X POST http://localhost:4025/api/search/filter \
  -H "Content-Type: application/json" \
  -d '{"requiredSkills": ["Full Stack"]}' | jq '.queryMetadata.skillsExpanded'
```
Expected: Both Frontend AND Backend skills

### Success Criteria:

#### Automated Verification:
- [x] Seed completes without errors
- [x] API builds and starts

#### Manual Verification:
- [x] Test 1 passes: Frontend returns only frontend skills
- [x] Test 2 passes: Backend returns only backend skills
- [x] Test 3 passes: JavaScript search is still transitive
- [x] Test 4 passes: Full Stack returns both categories

---

## Files Modified Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `seeds/types.ts` | Add | New `SkillCategoryMembership` interface |
| `seeds/skills.ts` | Modify | Add `skillCategoryMemberships` array, remove role-based CHILD_OF entries |
| `seeds/index.ts` | Modify | Export new array (via `export * from './skills'`) |
| `seeds/seed.ts` | Modify | Add `seedSkillCategoryMemberships` and `cleanupRoleCategoryChildOf` functions |
| `recommender_api/src/services/skill-resolver.service.ts` | Modify | Simplified to generic 2-branch query using `BELONGS_TO*1..2` (no hardcoded IDs) |

## Rollback Plan

If issues arise:
1. Revert the skill-resolver.service.ts changes
2. Revert the seeds/skills.ts changes (restore CHILD_OF entries)
3. Re-seed the database

The BELONGS_TO relationships in the database won't cause issues if the code doesn't use them.
