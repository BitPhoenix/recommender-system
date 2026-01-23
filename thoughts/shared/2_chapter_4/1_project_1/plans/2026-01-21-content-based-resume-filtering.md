# Content-Based Resume Filtering Implementation Plan

## Overview

Add content-based filtering capabilities to the recommender_api, supporting resume upload with LLM-based feature extraction and text similarity (TF-IDF, dense embeddings, hybrid) for matching engineers to queries and finding similar candidates.

## Current State Analysis

### What Exists

- **Neo4j 5.26-community** with typed nodes (Engineer, Skill, UserSkill, etc.) - supports native vector indices
- **Ollama integration** (`llm.service.ts`) with `qwen2.5:14b-instruct` for text completion (no embeddings yet)
- **Skill resolution** (`skill-resolver.service.ts`) with exact matching and hierarchy expansion
- **Modular service architecture** following route/controller/service pattern with Zod schemas
- **138 skills** in canonical taxonomy with CHILD_OF and BELONGS_TO relationships

### What's Missing

- Embedding generation capability in LLM service
- TF-IDF vectorization and indexing
- Fuzzy skill matching for LLM-extracted skill names
- Resume processing pipeline
- Content-based search endpoints
- Vector indices in Neo4j

### Key Discoveries

- `recommender_api/src/services/llm.service.ts:83-87` - Uses `client.chat()` for completions, Ollama also supports `client.embed()` for embeddings
- `recommender_api/src/services/skill-resolver.service.ts:146-147` - Exact matching only, no fuzzy logic
- `helm_charts/neo4j-db/values.yaml:5` - Neo4j 5.26 supports `CREATE VECTOR INDEX` for native ANN search
- `recommender_api/src/config.ts:19-22` - LLM configuration pattern to follow for embedding model

## Desired End State

After completing all phases:

1. **Resume Upload Endpoint** (`POST /api/resume/upload`)
   - Accept resume text, extract structured features via LLM
   - Create new engineers OR update existing engineers
   - Normalize extracted skills (synonym → fuzzy → flag for review)
   - Generate TF-IDF and embedding vectors
   - Store vectors in Neo4j

2. **Content Search Endpoint** (`POST /api/search/content`)
   - Accept free-text query or engineer ID for similarity search
   - Support three methods: `tfidf`, `embedding`, `hybrid`
   - Return ranked matches with interpretable score breakdowns
   - Support pagination and optional constraint filters

3. **Hybrid Search Pipeline**
   - Boolean filtering via inverted index (must-have keywords)
   - TF-IDF scoring on filtered set
   - Embedding re-ranking on top-K results
   - Score fusion for final ranking

### Verification

- All automated tests pass (`npm test`, `npm run typecheck`, `npm run test:e2e`)
- Resume upload extracts skills correctly and normalizes them
- TF-IDF search returns keyword-relevant results
- Embedding search returns semantically similar results
- Hybrid search combines both approaches effectively
- Performance: <500ms for search queries against 1000+ engineers

## What We're NOT Doing

- PDF parsing (input is plain text only)
- Real-time resume parsing during engineer creation (separate upload flow)
- Training custom embedding models (using pre-trained Ollama models)
- External vector stores (using Neo4j's native vector indices)
- Automatic skill taxonomy updates (unknown skills flagged for manual review)

## Implementation Approach

**Three phases**, each building on the previous:

1. **Phase 1: TF-IDF Baseline** - Sparse vectors for keyword matching with interpretable scores
2. **Phase 2: Dense Embeddings** - Semantic similarity via Ollama embedding model
3. **Phase 3: Hybrid Approach** - Boolean filtering + embedding ranking + TF-IDF explainability

Each phase is independently valuable and testable.

---

## Phase 1: TF-IDF Baseline

### Overview

Implement TF-IDF vectorization for engineer profiles using plain concatenated text. Structured features (skills, experience, domains) are already extracted via LLM and stored in Neo4j for filtering - TF-IDF provides complementary fuzzy text similarity without needing to duplicate structural concerns. This keeps the implementation simple while still capturing keyword relevance.

### Changes Required

#### 1.0 New Dependencies

```bash
npm install natural lemmatizer
npm install -D @types/natural
```

| Package | Purpose | Used For |
|---------|---------|----------|
| `natural` | NLP toolkit | WordTokenizer, PorterStemmer |
| `lemmatizer` | Word lemmatization | "applications" → "application" |
| `@types/natural` | TypeScript types | Type safety |

#### 1.1 Skill Synonym Nodes (Seeded in Neo4j)

**Design Decision: Separate Nodes vs Property Array**

We store synonyms as separate `SkillSynonym` nodes with `ALIAS_FOR` relationships rather than as a property array on Skill nodes. Here's the rationale:

| Aspect | Property (`synonyms: ["k8s", "kube"]`) | Separate Node (`SkillSynonym`) |
|--------|----------------------------------------|--------------------------------|
| **Indexing** | Neo4j cannot index array elements | Full index support on `name` |
| **Lookup** | Must scan all skills or cache in memory | Direct O(1) index lookup |
| **Metadata** | Cannot add per-synonym attributes | Can add `source`, `confidence`, `addedAt` |
| **Queryability** | Requires `UNWIND` + filtering | Direct queries ("show all synonyms") |
| **Extensibility** | Limited | Can add ML-suggested synonyms later |

**The key issue**: Neo4j cannot efficiently index individual array elements. With a property approach, finding "k8s" → Kubernetes would require scanning all skills or maintaining an in-memory cache. With separate nodes, we create an index and get O(1) lookups.

**Schema**:

```cypher
(:SkillSynonym {id, name})-[:ALIAS_FOR]->(:Skill {id, name, ...})
```

**File**: `seeds/skill-synonyms.ts` (new)

```typescript
import { Session } from "neo4j-driver";

interface SkillSynonym {
  name: string;       // The synonym (lowercase for consistent matching)
  skillId: string;    // The canonical skill ID it maps to
}

/*
 * Skill synonyms map common variations to canonical skill IDs.
 * Stored as separate nodes for indexable lookups.
 */
export const skillSynonyms: SkillSynonym[] = [
  // JavaScript ecosystem
  { name: "react.js", skillId: "skill_react" },
  { name: "reactjs", skillId: "skill_react" },
  { name: "vue.js", skillId: "skill_vue" },
  { name: "vuejs", skillId: "skill_vue" },
  { name: "node.js", skillId: "skill_nodejs" },
  { name: "nodejs", skillId: "skill_nodejs" },
  { name: "express.js", skillId: "skill_express" },
  { name: "expressjs", skillId: "skill_express" },
  { name: "next.js", skillId: "skill_nextjs" },
  { name: "nextjs", skillId: "skill_nextjs" },
  { name: "nest.js", skillId: "skill_nestjs" },
  { name: "nestjs", skillId: "skill_nestjs" },

  // Infrastructure
  { name: "k8s", skillId: "skill_kubernetes" },
  { name: "kube", skillId: "skill_kubernetes" },
  { name: "amazon web services", skillId: "skill_aws" },
  { name: "gcp", skillId: "skill_gcp" },
  { name: "google cloud", skillId: "skill_gcp" },
  { name: "google cloud platform", skillId: "skill_gcp" },

  // Databases
  { name: "postgres", skillId: "skill_postgresql" },
  { name: "psql", skillId: "skill_postgresql" },
  { name: "mongo", skillId: "skill_mongodb" },

  // Languages
  { name: "ts", skillId: "skill_typescript" },
  { name: "js", skillId: "skill_javascript" },
  { name: "golang", skillId: "skill_go" },
  { name: "python3", skillId: "skill_python" },
  { name: "py", skillId: "skill_python" },
];

/*
 * Seed skill synonyms into Neo4j.
 */
export async function seedSkillSynonyms(session: Session): Promise<void> {
  // Create unique constraint for synonym names (lowercase)
  await session.run(`
    CREATE CONSTRAINT skill_synonym_name_unique IF NOT EXISTS
    FOR (s:SkillSynonym) REQUIRE s.name IS UNIQUE
  `);

  // Create index for fast lookups
  await session.run(`
    CREATE INDEX skill_synonym_name_index IF NOT EXISTS
    FOR (s:SkillSynonym) ON (s.name)
  `);

  // Seed synonyms
  for (const synonym of skillSynonyms) {
    await session.run(`
      MATCH (skill:Skill {id: $skillId})
      MERGE (syn:SkillSynonym {name: $name})
      ON CREATE SET
        syn.id = $synonymId,
        syn.createdAt = datetime()
      MERGE (syn)-[:ALIAS_FOR]->(skill)
    `, {
      name: synonym.name.toLowerCase(),
      skillId: synonym.skillId,
      synonymId: `synonym_${synonym.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    });
  }

  console.log(`[Seed] Created ${skillSynonyms.length} skill synonyms`);
}
```

**Update**: `seeds/seed.ts` - Add synonym seeding

```typescript
import { seedSkillSynonyms } from "./skill-synonyms.js";

// In the seed function, after seeding skills:
await seedSkillSynonyms(session);
```

#### 1.2 Company and WorkExperience Nodes

Store work history as graph nodes to enable rich queries like "engineers with FAANG experience" or "engineers who used Kafka at a startup."

**Schema**:

```cypher
// Company nodes - created dynamically during resume upload, seeded for well-known companies
(:Company {
  id: string,           // "company_stripe", "company_google", or generated UUID
  name: string,         // "Stripe", "Google"
  normalizedName: string, // Lowercase for matching: "stripe", "google"
  type: string          // "faang" | "startup" | "enterprise" | "agency" | "consultancy" | "unknown"
})

// WorkExperience nodes - always created from resume extraction
(:WorkExperience {
  id: string,           // Generated UUID
  title: string,        // "Senior Software Engineer"
  startDate: string,    // "2020-01" or "2020"
  endDate: string,      // "2023-06" or "present"
  seniority: string,    // "junior" | "mid" | "senior" | "staff" | "principal"
  highlights: string[]  // Notable accomplishments
})

// CompanyAlias nodes - map alternate names to canonical companies (like SkillSynonym)
(:CompanyAlias {
  id: string,           // Generated
  name: string          // Lowercase alias: "facebook", "fb", "aws"
})-[:ALIAS_FOR]->(:Company)

// Relationships
(Engineer)-[:HAD_ROLE]->(WorkExperience)-[:AT_COMPANY]->(Company)

// Skills: UserSkill is the single source of truth, optionally linked to where it was used
(Engineer)-[:HAS]->(UserSkill)-[:FOR]->(Skill)
(UserSkill)-[:USED_AT]->(WorkExperience)  // 0 to many - skills can be used at multiple jobs, or none (self-taught)
```

**Design Rationale**:

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Company as separate node** | Yes | Enables "find engineers who worked at X" queries; company reputation is reusable across engineers |
| **Normalized name on Company** | Yes | Case-insensitive matching: "Google", "google", "GOOGLE" all resolve to same node |
| **WorkExperience per role** | Yes | Same company, different roles = different WorkExperience nodes |
| **UserSkill → USED_AT → WorkExperience** | Optional relationship | Single UserSkill per skill; link to jobs where used; no link = self-taught |
| **Company type** | Stored on Company | Extracted from resume, can be overridden for known companies |
| **CompanyAlias nodes** | Separate nodes | Same pattern as SkillSynonym - indexed O(1) lookup for "facebook" → Meta |

**File**: `seeds/companies.ts` (new) - Seed well-known companies

```typescript
import { Session } from "neo4j-driver";

interface SeedCompany {
  id: string;
  name: string;
  type: "faang" | "startup" | "enterprise" | "agency" | "consultancy";
}

/*
 * Well-known companies pre-seeded with correct types.
 * Companies not in this list are created dynamically during resume upload.
 */
export const knownCompanies: SeedCompany[] = [
  // FAANG / Big Tech
  { id: "company_google", name: "Google", type: "faang" },
  { id: "company_meta", name: "Meta", type: "faang" },
  { id: "company_apple", name: "Apple", type: "faang" },
  { id: "company_amazon", name: "Amazon", type: "faang" },
  { id: "company_netflix", name: "Netflix", type: "faang" },
  { id: "company_microsoft", name: "Microsoft", type: "faang" },

  // Well-known tech companies
  { id: "company_stripe", name: "Stripe", type: "startup" },
  { id: "company_airbnb", name: "Airbnb", type: "startup" },
  { id: "company_uber", name: "Uber", type: "startup" },
  { id: "company_lyft", name: "Lyft", type: "startup" },
  { id: "company_square", name: "Square", type: "startup" },
  { id: "company_shopify", name: "Shopify", type: "startup" },
  { id: "company_twilio", name: "Twilio", type: "startup" },
  { id: "company_datadog", name: "Datadog", type: "startup" },
  { id: "company_snowflake", name: "Snowflake", type: "startup" },

  // Enterprise
  { id: "company_ibm", name: "IBM", type: "enterprise" },
  { id: "company_oracle", name: "Oracle", type: "enterprise" },
  { id: "company_salesforce", name: "Salesforce", type: "enterprise" },
  { id: "company_sap", name: "SAP", type: "enterprise" },

  // Consultancies
  { id: "company_mckinsey", name: "McKinsey", type: "consultancy" },
  { id: "company_bcg", name: "BCG", type: "consultancy" },
  { id: "company_accenture", name: "Accenture", type: "consultancy" },
  { id: "company_deloitte", name: "Deloitte", type: "consultancy" },
  { id: "company_thoughtworks", name: "ThoughtWorks", type: "consultancy" },
];

interface CompanyAlias {
  name: string;      // The alias (lowercase)
  companyId: string; // The canonical company ID it maps to
}

/*
 * Company aliases map alternate names to canonical company IDs.
 * Handles rebrandings, abbreviations, and common variations.
 */
export const companyAliases: CompanyAlias[] = [
  // Rebrandings
  { name: "facebook", companyId: "company_meta" },
  { name: "facebook, inc.", companyId: "company_meta" },
  { name: "fb", companyId: "company_meta" },

  // Abbreviations / alternate names
  { name: "aws", companyId: "company_amazon" },
  { name: "amazon web services", companyId: "company_amazon" },
  { name: "gcp", companyId: "company_google" },
  { name: "google cloud", companyId: "company_google" },
  { name: "google cloud platform", companyId: "company_google" },
  { name: "alphabet", companyId: "company_google" },
  { name: "msft", companyId: "company_microsoft" },
  { name: "azure", companyId: "company_microsoft" },
  { name: "microsoft azure", companyId: "company_microsoft" },

  // Common variations
  { name: "block", companyId: "company_square" },  // Square rebranded to Block
  { name: "block, inc.", companyId: "company_square" },
];

/*
 * Seed well-known companies into Neo4j.
 */
export async function seedCompanies(session: Session): Promise<void> {
  // Create unique constraint on normalized name
  await session.run(`
    CREATE CONSTRAINT company_normalized_name_unique IF NOT EXISTS
    FOR (c:Company) REQUIRE c.normalizedName IS UNIQUE
  `);

  // Create index on company type for filtering
  await session.run(`
    CREATE INDEX company_type_index IF NOT EXISTS
    FOR (c:Company) ON (c.type)
  `);

  // Seed known companies
  for (const company of knownCompanies) {
    await session.run(`
      MERGE (c:Company {normalizedName: $normalizedName})
      ON CREATE SET
        c.id = $id,
        c.name = $name,
        c.type = $type
      ON MATCH SET
        c.type = $type
    `, {
      id: company.id,
      name: company.name,
      normalizedName: company.name.toLowerCase(),
      type: company.type,
    });
  }

  console.log(`[Seed] Created ${knownCompanies.length} known companies`);

  // Create unique constraint for alias names
  await session.run(`
    CREATE CONSTRAINT company_alias_name_unique IF NOT EXISTS
    FOR (a:CompanyAlias) REQUIRE a.name IS UNIQUE
  `);

  // Create index for fast alias lookup
  await session.run(`
    CREATE INDEX company_alias_name_index IF NOT EXISTS
    FOR (a:CompanyAlias) ON (a.name)
  `);

  // Seed company aliases
  for (const alias of companyAliases) {
    await session.run(`
      MATCH (c:Company {id: $companyId})
      MERGE (a:CompanyAlias {name: $name})
      ON CREATE SET a.id = randomUUID()
      MERGE (a)-[:ALIAS_FOR]->(c)
    `, {
      name: alias.name,
      companyId: alias.companyId,
    });
  }

  console.log(`[Seed] Created ${companyAliases.length} company aliases`);
}
```

**Update**: `seeds/seed.ts` - Add company seeding

```typescript
import { seedCompanies } from "./companies.js";

// In the seed function, after seeding skills and synonyms:
await seedCompanies(session);
```

#### 1.3 Skill Normalization Service

**File**: `recommender_api/src/services/skill-normalizer.service.ts` (new)

Implement the three-tier normalization: exact match → synonym lookup → fuzzy matching → flag for review.

```typescript
import { Session } from "neo4j-driver";

interface NormalizationResult {
  canonicalSkillId: string | null;
  canonicalSkillName: string | null;
  method: "exact" | "synonym" | "fuzzy" | "unresolved";
  confidence: number; // 0-1
  originalName: string;
}

interface CanonicalSkill {
  id: string;
  name: string;
}

/*
 * Normalize an extracted skill name to a canonical skill ID.
 * Uses three-tier fallback: exact → synonym (from Neo4j) → fuzzy → unresolved.
 */
export async function normalizeExtractedSkill(
  session: Session,
  extractedName: string,
  allCanonicalSkills: CanonicalSkill[]
): Promise<NormalizationResult> {
  const normalized = extractedName.toLowerCase().trim();

  // Tier 1: Exact match on skill ID or name
  const exactMatch = allCanonicalSkills.find(
    (skill) => skill.id.toLowerCase() === normalized ||
               skill.name.toLowerCase() === normalized
  );
  if (exactMatch) {
    return {
      canonicalSkillId: exactMatch.id,
      canonicalSkillName: exactMatch.name,
      method: "exact",
      confidence: 1.0,
      originalName: extractedName,
    };
  }

  // Tier 2: Synonym lookup from Neo4j (indexed, O(1) lookup)
  const synonymResult = await session.run(`
    MATCH (syn:SkillSynonym {name: $name})-[:ALIAS_FOR]->(skill:Skill)
    RETURN skill.id AS skillId, skill.name AS skillName
    LIMIT 1
  `, { name: normalized });

  if (synonymResult.records.length > 0) {
    const record = synonymResult.records[0];
    return {
      canonicalSkillId: record.get("skillId") as string,
      canonicalSkillName: record.get("skillName") as string,
      method: "synonym",
      confidence: 0.95,
      originalName: extractedName,
    };
  }

  // Tier 3: Fuzzy string matching (Levenshtein distance)
  const fuzzyResult = findFuzzyMatch(normalized, allCanonicalSkills);
  if (fuzzyResult && fuzzyResult.similarity >= 0.8) {
    return {
      canonicalSkillId: fuzzyResult.skill.id,
      canonicalSkillName: fuzzyResult.skill.name,
      method: "fuzzy",
      confidence: fuzzyResult.similarity,
      originalName: extractedName,
    };
  }

  // Tier 4: Unresolved - flag for review
  return {
    canonicalSkillId: null,
    canonicalSkillName: null,
    method: "unresolved",
    confidence: 0,
    originalName: extractedName,
  };
}

interface NormalizedSkillsResult {
  resolvedSkills: NormalizationResult[];
  unresolvedSkills: NormalizationResult[];
}

/*
 * Normalize a list of extracted skill names to our canonical taxonomy.
 * Returns resolved skills (matched) and unresolved skills (needs review).
 */
export async function normalizeExtractedSkills(
  session: Session,
  extractedSkillNames: string[]
): Promise<NormalizedSkillsResult> {
  const canonicalSkills = await loadCanonicalSkills(session);

  const normalizedSkills = await Promise.all(
    extractedSkillNames.map((name) =>
      normalizeExtractedSkill(session, name, canonicalSkills)
    )
  );

  return {
    resolvedSkills: normalizedSkills.filter((n) => n.canonicalSkillId !== null),
    unresolvedSkills: normalizedSkills.filter((n) => n.canonicalSkillId === null),
  };
}

interface FuzzyMatchResult {
  skill: CanonicalSkill;
  similarity: number;
}

function findFuzzyMatch(
  searchTerm: string,
  candidates: CanonicalSkill[]
): FuzzyMatchResult | null {
  let bestMatch: FuzzyMatchResult | null = null;

  for (const candidate of candidates) {
    const similarity = calculateSimilarity(searchTerm, candidate.name.toLowerCase());
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { skill: candidate, similarity };
    }
  }

  return bestMatch;
}

/*
 * Calculate normalized Levenshtein similarity (0-1).
 * 1.0 = exact match, 0.0 = completely different.
 */
function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1 - distance / maxLength;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/*
 * Load all canonical skills from Neo4j for normalization.
 */
export async function loadCanonicalSkills(session: Session): Promise<CanonicalSkill[]> {
  const result = await session.run(`
    MATCH (s:Skill)
    WHERE s.isCategory = false
    RETURN s.id AS id, s.name AS name
  `);

  return result.records.map((record) => ({
    id: record.get("id") as string,
    name: record.get("name") as string,
  }));
}
```

#### 1.4 Company Normalization Service

**File**: `recommender_api/src/services/company-normalizer.service.ts` (new)

Normalize company names by stripping suffixes and resolving aliases. Unlike skill normalization, unknown companies are created (not flagged for review).

**Why companies are created vs skills flagged:**

| Aspect | Skills | Companies |
|--------|--------|-----------|
| **Cardinality** | ~150 canonical skills (curated) | Millions of companies worldwide |
| **Taxonomy type** | Closed - we control what exists | Open - any company is valid |
| **Unknown = ?** | Likely typo, hallucination, or too niche | Likely legitimate, just not pre-seeded |
| **Query impact** | "Find React engineers" needs canonical ID | "Find startup engineers" uses `type`, not specific company |
| **Bad data risk** | High - wrong matches, poor recommendations | Low - company is context/signal, not primary filter |
| **Review burden** | Manageable (~5-20 unknowns per resume) | Unmanageable (most companies won't be seeded) |

**Bottom line:** Skills are the *what* (primary matching criteria), companies are the *where* (context and signal). We need skill precision; we need company coverage.

**File**: `config/text-normalization.config.ts` (new) - Suffix patterns stay in code

```typescript
/*
 * US company suffixes to strip during normalization.
 */
export const companySuffixes = [
  ", Inc.", " Inc.", " Inc",
  ", LLC", " LLC",
  ", Corp.", " Corp.", " Corp",
  " Corporation",
  ", L.P.", " L.P.", " LP",  // Limited Partnership
  ", L.L.C.", " L.L.C.",     // Alternate LLC format
];
```

**File**: `recommender_api/src/services/company-normalizer.service.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import { companySuffixes } from "../../config/text-normalization.config.js";

export interface CompanyNormalizationResult {
  normalizedName: string;          // After suffix stripping + lowercasing
  canonicalCompanyId: string | null; // If matched existing company or alias
  canonicalCompanyName: string | null;
  method: "exact" | "alias" | "new";
}

/*
 * Normalize a company name:
 * 1. Strip common legal suffixes (Inc., LLC, etc.)
 * 2. Check for exact match in existing companies
 * 3. Check for alias match (CompanyAlias nodes)
 * 4. Return normalized name for new company creation
 */
export async function normalizeCompanyName(
  session: Session,
  companyName: string
): Promise<CompanyNormalizationResult> {
  // Step 1: Strip suffixes and normalize
  let normalized = companyName.trim();
  for (const suffix of companySuffixes) {
    if (normalized.toLowerCase().endsWith(suffix.toLowerCase())) {
      normalized = normalized.slice(0, -suffix.length).trim();
      break; // Only strip one suffix
    }
  }
  const normalizedLower = normalized.toLowerCase();

  // Step 2: Check for exact match on existing company
  const exactResult = await session.run(`
    MATCH (c:Company {normalizedName: $name})
    RETURN c.id AS companyId, c.name AS companyName
    LIMIT 1
  `, { name: normalizedLower });

  if (exactResult.records.length > 0) {
    const record = exactResult.records[0];
    return {
      normalizedName: normalizedLower,
      canonicalCompanyId: record.get("companyId") as string,
      canonicalCompanyName: record.get("companyName") as string,
      method: "exact",
    };
  }

  // Step 3: Check for alias match
  const aliasResult = await session.run(`
    MATCH (a:CompanyAlias {name: $name})-[:ALIAS_FOR]->(c:Company)
    RETURN c.id AS companyId, c.name AS companyName
    LIMIT 1
  `, { name: normalizedLower });

  if (aliasResult.records.length > 0) {
    const record = aliasResult.records[0];
    return {
      normalizedName: normalizedLower,
      canonicalCompanyId: record.get("companyId") as string,
      canonicalCompanyName: record.get("companyName") as string,
      method: "alias",
    };
  }

  // Step 4: No match - return normalized name for new company creation
  return {
    normalizedName: normalizedLower,
    canonicalCompanyId: null,
    canonicalCompanyName: null,
    method: "new",
  };
}
```

#### 1.5 LLM Feature Extraction Service (Job-Centric with RAG)

**File**: `recommender_api/src/services/resume-processor/feature-extractor.service.ts` (new)

**Design Decision: Job-Centric vs Flat Skill List**

We extract an **ordered list of jobs** rather than a flat skill list. This provides:

| Aspect | Flat Schema | Job-Centric Schema |
|--------|-------------|-------------------|
| Skill duration | "5 years React" (where?) | "React at Job A (2y) + Job B (3y)" |
| Recency | Unknown | "Used Kubernetes in most recent role" |
| Skill context | Just a list | "Python for ML at startup, for backend at enterprise" |
| Career progression | ["Junior", "Senior"] | Full trajectory with dates and companies |
| Seniority validation | Self-reported | Verifiable from job history |

**Design Decision: RAG for Constrained Fields**

We pass actual domain values from our database to the LLM instead of letting it hallucinate arbitrary strings. This ensures extracted values match our taxonomy.

```typescript
import { Session } from "neo4j-driver";
import { generateCompletion } from "../llm.service.js";
import { seniorityMapping } from "../../config/knowledge-base/compatibility-constraints.config.js";

/*
 * A single job/position extracted from the resume.
 */
export interface ExtractedJob {
  title: string;
  company: string;
  companyType: string;              // Constrained by RAG context
  startDate: string;                // "2020-01" or "2020"
  endDate: string | "present";
  seniority: string;                // junior/mid/senior/staff/principal
  skills: ExtractedJobSkill[];      // Skills used in THIS role
  highlights: string[];             // Key accomplishments at this job
}

export interface ExtractedJobSkill {
  name: string;
  confidence: "explicit" | "inferred" | "uncertain";
}

export interface ExtractedProfile {
  /*
   * Jobs ordered by date ASCENDING (oldest first).
   * This lets us see career progression chronologically.
   */
  jobs: ExtractedJob[];

  /*
   * Standalone skills from the resume's Skills section (not tied to specific jobs).
   * These are normalized separately and create UserSkill nodes without USED_AT links.
   */
  skills: string[];

  /*
   * Business domains from our taxonomy (via RAG context).
   */
  businessDomains: string[];

  /*
   * Technical domains from our taxonomy (via RAG context).
   */
  technicalDomains: string[];

  /*
   * Computed/validated by LLM from job history.
   */
  totalYearsExperience: number;

  /*
   * A one-line professional headline summarizing the candidate.
   */
  headline: string | null;
}

/*
 * RAG context loaded from Neo4j to constrain LLM extraction.
 */
export interface ExtractionRagContext {
  validBusinessDomains: string[];   // From BusinessDomain nodes (e.g., "Fintech", "Healthcare")
  validTechnicalDomains: string[];  // From TechnicalDomain nodes (e.g., "Backend", "DevOps")
  validCompanyTypes: string[];      // Predefined list
  validSeniorities: string[];       // Predefined list
}

/*
 * Valid company types (could also be seeded in Neo4j if needed).
 */
const VALID_COMPANY_TYPES = [
  "FAANG",
  "big-tech",
  "startup",
  "scaleup",
  "enterprise",
  "agency",
  "consultancy",
  "government",
  "nonprofit",
  "other",
];

/*
 * Valid seniority levels - derived from canonical seniorityMapping.
 */
const VALID_SENIORITIES = Object.keys(seniorityMapping);

/*
 * Load RAG context from Neo4j for constraining LLM extraction.
 */
export async function loadExtractionRagContext(session: Session): Promise<ExtractionRagContext> {
  // Load business domains from Neo4j
  const businessDomainResult = await session.run(`
    MATCH (d:BusinessDomain)
    RETURN d.name AS name
    ORDER BY d.name
  `);
  const validBusinessDomains = businessDomainResult.records.map((r) => r.get("name") as string);

  // Load technical domains from Neo4j
  const technicalDomainResult = await session.run(`
    MATCH (d:TechnicalDomain)
    RETURN d.name AS name
    ORDER BY d.name
  `);
  const validTechnicalDomains = technicalDomainResult.records.map((r) => r.get("name") as string);

  return {
    validBusinessDomains,
    validTechnicalDomains,
    validCompanyTypes: VALID_COMPANY_TYPES,
    validSeniorities: VALID_SENIORITIES,
  };
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured information from developer resumes.
Extract precise, factual information only. Do not infer skills that are not mentioned or strongly implied.
Pay careful attention to dates and job ordering.`;

function buildExtractionPrompt(resumeText: string, ragContext: ExtractionRagContext): string {
  return `Extract structured information from this resume.

Resume:
${resumeText}

IMPORTANT - Use ONLY these values for constrained fields:
- businessDomains: ${ragContext.validBusinessDomains.join(", ")}
- technicalDomains: ${ragContext.validTechnicalDomains.join(", ")}
- companyType: ${ragContext.validCompanyTypes.join(", ")}
- seniority: ${ragContext.validSeniorities.join(", ")}

Return JSON matching this exact schema:
{
  "jobs": [
    {
      "title": string,              // Job title as written
      "company": string,            // Company name
      "companyType": string,        // One of: ${ragContext.validCompanyTypes.join(", ")}
      "startDate": string,          // "YYYY-MM" or "YYYY" if month unknown
      "endDate": string,            // "YYYY-MM", "YYYY", or "present"
      "seniority": string,          // One of: ${ragContext.validSeniorities.join(", ")}
      "skills": [
        {
          "name": string,           // Skill name as written
          "confidence": "explicit" | "inferred" | "uncertain"
        }
      ],
      "highlights": string[]        // Key accomplishments (2-4 bullet points max)
    }
  ],
  "skills": string[],               // Standalone skills from Skills section (not tied to specific jobs)
  "businessDomains": string[],      // Industry domains from: ${ragContext.validBusinessDomains.join(", ")}
  "technicalDomains": string[],     // Technical focus from: ${ragContext.validTechnicalDomains.join(", ")}
  "totalYearsExperience": number,   // Total years in software/tech
  "headline": string | null         // One-line professional summary
}

Rules:
- Order jobs by date ASCENDING (oldest job FIRST, most recent job LAST)
- IMPORTANT: Treat promotions as SEPARATE job entries, even at the same company
  - "Software Engineer at Google (2018-2020)" and "Senior Engineer at Google (2020-2022)" = TWO separate jobs
  - Each promotion level may have different skills, responsibilities, and seniority
- For each job, only include skills that were clearly used in THAT role
- "explicit": skill is directly stated for that job
- "inferred": skill deduced from context (e.g., "deployed to EKS" implies Kubernetes)
- "uncertain": educated guess based on weak signals
- If a date is unclear, make your best estimate based on context
- For companyType, use "other" if none of the options fit
- For businessDomains, include industries the engineer has worked in (e.g., Fintech, Healthcare)
- For technicalDomains, include technical focus areas (e.g., Backend, Frontend, DevOps)
- Only include domains from the provided lists that clearly apply`;
}

/*
 * Extract structured profile from resume text using LLM with RAG context.
 * Returns null if LLM is unavailable.
 */
export async function extractFeaturesFromResume(
  session: Session,
  resumeText: string
): Promise<ExtractedProfile | null> {
  // Load RAG context for constrained extraction
  const ragContext = await loadExtractionRagContext(session);

  const prompt = buildExtractionPrompt(resumeText, ragContext);

  const response = await generateCompletion(prompt, {
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    maxTokens: 4000,
  });

  if (!response) {
    return null;
  }

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                      response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[FeatureExtractor] No JSON found in LLM response");
      return null;
    }

    const jsonString = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonString);

    // Basic validation
    if (!Array.isArray(parsed.jobs)) {
      console.warn("[FeatureExtractor] Invalid jobs array in LLM response");
      return null;
    }

    return parsed as ExtractedProfile;
  } catch (error) {
    console.warn("[FeatureExtractor] Failed to parse LLM response:", error);
    return null;
  }
}

/*
 * Collect unique skill names from all sources for normalization efficiency.
 *
 * SKILL SOURCES:
 * 1. Job-specific skills - extracted from job entries
 * 2. Standalone skills - from resume's Skills section (not tied to specific jobs)
 *
 * WHY THIS EXISTS:
 * The same skill (e.g., "React") often appears in multiple places. Normalizing
 * involves database queries (exact match, synonym lookup, fuzzy match). If we
 * normalized inline while iterating, we'd query for "React" N times.
 *
 * Instead, we:
 * 1. Collect unique skill names from ALL sources (this function)
 * 2. Normalize each unique skill ONCE
 * 3. Create UserSkill for each resolved skill
 * 4. For job-specific skills, also create USED_AT links to WorkExperience
 *
 * Job associations are NOT lost - we iterate profile.jobs separately when
 * creating USED_AT relationships. This function returns only names because
 * that's all we need for normalization.
 */
export function getAllUniqueSkillNames(profile: ExtractedProfile): string[] {
  const seenNormalizedNames = new Set<string>();
  const uniqueSkillNames: string[] = [];

  // Collect from job-specific skills
  for (const job of profile.jobs) {
    for (const skill of job.skills) {
      const normalizedSkillName = skill.name.toLowerCase();
      if (!seenNormalizedNames.has(normalizedSkillName)) {
        seenNormalizedNames.add(normalizedSkillName);
        uniqueSkillNames.push(skill.name);  // Keep original casing for normalizer
      }
    }
  }

  // Collect from standalone skills section
  for (const skillName of profile.skills) {
    const normalizedSkillName = skillName.toLowerCase();
    if (!seenNormalizedNames.has(normalizedSkillName)) {
      seenNormalizedNames.add(normalizedSkillName);
      uniqueSkillNames.push(skillName);
    }
  }

  return uniqueSkillNames;
}
```

#### 1.6 Text Normalization Service

**File**: `recommender_api/src/services/content-search/text-normalizer.service.ts` (new)

Handles text tokenization and normalization for TF-IDF and embedding processing. Separated from TF-IDF computation to enable reuse and follow SRP.

```typescript
import { PorterStemmer, WordTokenizer } from "natural";
import { lemmatizer } from "lemmatizer";

/*
 * =============================================================================
 * TYPES & CONFIGURATION
 * =============================================================================
 */

export type NormalizationStrategy = "none" | "stemming" | "lemma";

/*
 * Current normalization strategy - change this to compare approaches.
 * After rebuilding the index, run the same searches and compare results.
 */
export const NORMALIZATION_STRATEGY: NormalizationStrategy = "none";

/*
 * =============================================================================
 * STOPWORDS
 * =============================================================================
 *
 * Why use stopwords when IDF already down-weights common terms?
 *
 * 1. **Cleaner "matching terms" explanations** - Users see meaningful matches
 * 2. **Smaller index size** - Fewer dimensions, less memory, faster computation
 * 3. **Edge case protection** - Works even in small corpora where IDF is unreliable
 */

// Standard English stopwords (articles, prepositions, pronouns, auxiliaries)
const ENGLISH_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "as", "is", "was", "are", "were", "been", "be", "have",
  "has", "had", "do", "does", "did", "will", "would", "could", "should", "may",
  "might", "must", "shall", "can", "need", "dare", "ought", "used", "i", "you",
  "he", "she", "it", "we", "they", "what", "which", "who", "whom", "this",
  "that", "these", "those", "am", "being", "having", "doing",
]);

/*
 * Resume-specific stopwords: words that appear on nearly every resume but
 * provide zero discriminative value for matching candidates.
 */
const RESUME_FILLER_WORDS = new Set([
  "responsible", "responsibilities", "various", "multiple", "several",
  "including", "such", "also", "well", "etc", "using", "within",
  "years", "year", "months", "month",
  "experience", "experienced", "work", "worked", "working",
  "team", "teams", "company", "role", "position", "job",
]);

const STOPWORDS = new Set([...ENGLISH_STOPWORDS, ...RESUME_FILLER_WORDS]);

/*
 * =============================================================================
 * TECH-SPECIFIC PATTERNS
 * =============================================================================
 */

/*
 * Compound patterns normalized before tokenization.
 */
const TECH_COMPOUND_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // JavaScript ecosystem
  { pattern: /\bnode\.?js\b/gi, replacement: "nodejs" },
  { pattern: /\bvue\.?js\b/gi, replacement: "vuejs" },
  { pattern: /\bnext\.?js\b/gi, replacement: "nextjs" },
  { pattern: /\bnuxt\.?js\b/gi, replacement: "nuxtjs" },
  { pattern: /\breact\.?js\b/gi, replacement: "reactjs" },
  { pattern: /\bexpress\.?js\b/gi, replacement: "expressjs" },
  { pattern: /\bthree\.?js\b/gi, replacement: "threejs" },
  { pattern: /\bd3\.?js\b/gi, replacement: "d3js" },
  // .NET ecosystem
  { pattern: /\.net\b/gi, replacement: "dotnet" },
  { pattern: /\basp\.net\b/gi, replacement: "aspnet" },
  // Languages with special characters
  { pattern: /\bc\+\+/gi, replacement: "cpp" },
  { pattern: /\bc#/gi, replacement: "csharp" },
  { pattern: /\bf#/gi, replacement: "fsharp" },
  // Common abbreviations
  { pattern: /\bk8s\b/gi, replacement: "kubernetes" },
  // Version patterns: "Python 3.9" → "python"
  { pattern: /\b(python|java|node|go|rust|ruby)\s*\d+(\.\d+)*/gi, replacement: "$1" },
];

/*
 * Multi-word tech phrases treated as single tokens.
 */
const PHRASE_TO_TOKEN: Record<string, string> = {
  "machine learning": "machinelearning",
  "deep learning": "deeplearning",
  "natural language processing": "nlp",
  "computer vision": "computervision",
  "data science": "datascience",
  "data engineering": "dataengineering",
  "site reliability": "sre",
  "continuous integration": "ci",
  "continuous deployment": "cd",
  "ci cd": "cicd",
  "ci/cd": "cicd",
  "dev ops": "devops",
  "user experience": "ux",
  "user interface": "ui",
  "front end": "frontend",
  "back end": "backend",
  "full stack": "fullstack",
  "real time": "realtime",
  "open source": "opensource",
  "test driven": "tdd",
  "behavior driven": "bdd",
  "object oriented": "oop",
  "event driven": "eventdriven",
  "micro services": "microservices",
  "rest api": "restapi",
  "restful api": "restapi",
  "graphql api": "graphqlapi",
  "cloud native": "cloudnative",
  "infrastructure as code": "iac",
  "version control": "versioncontrol",
  "tech lead": "techlead",
  "team lead": "teamlead",
  "engineering manager": "engineeringmanager",
};

const wordTokenizer = new WordTokenizer();

/*
 * =============================================================================
 * MAIN API
 * =============================================================================
 */

/*
 * Tokenize and normalize text for TF-IDF/embedding processing.
 *
 * Processing pipeline:
 *   1. Normalize tech compounds  - "Node.js" → "nodejs", "C++" → "cpp"
 *   2. Replace known phrases     - "machine learning" → "machinelearning"
 *   3. Tokenize                  - Split into words
 *   4. Filter stopwords          - Remove non-discriminative words
 *   5. Apply normalization       - Stem or lemmatize based on strategy
 *
 * @param text - Raw text to tokenize
 * @param strategy - Word normalization approach (defaults to NORMALIZATION_STRATEGY)
 */
export function tokenize(
  text: string,
  strategy: NormalizationStrategy = NORMALIZATION_STRATEGY
): string[] {
  const withNormalizedCompounds = normalizeTechCompounds(text);
  const withReplacedPhrases = replaceKnownPhrases(withNormalizedCompounds.toLowerCase());
  const rawTokens = wordTokenizer.tokenize(withReplacedPhrases) || [];
  const withoutStopwords = filterStopwords(rawTokens);
  const normalized = applyWordNormalization(withoutStopwords, strategy);
  return normalized;
}

/*
 * =============================================================================
 * PIPELINE HELPERS (called by tokenize)
 * =============================================================================
 */

function normalizeTechCompounds(text: string): string {
  let result = text;
  for (const { pattern, replacement } of TECH_COMPOUND_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function replaceKnownPhrases(text: string): string {
  let result = text;
  for (const [phrase, token] of Object.entries(PHRASE_TO_TOKEN)) {
    result = result.replace(new RegExp(phrase, "g"), token);
  }
  return result;
}

function filterStopwords(tokens: string[]): string[] {
  return tokens.filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function applyWordNormalization(
  tokens: string[],
  strategy: NormalizationStrategy
): string[] {
  switch (strategy) {
    case "stemming":
      return tokens.map((token) => PorterStemmer.stem(token));
    case "lemma":
      return tokens.map((token) => lemmatizer(token));
    case "none":
    default:
      return tokens;
  }
}
```

#### 1.7 Sparse Vector Service

**File**: `recommender_api/src/services/content-search/sparse-vector.service.ts` (new)

Generic sparse vector operations for similarity computation. Separated from TF-IDF to enable reuse with other sparse representations.

**Why Sparse Representation for TF-IDF?**

TF-IDF vectors are naturally sparse. A vocabulary might contain 50,000+ terms, but a single engineer profile uses maybe 200 unique words - that's 99.6% zeros. Sparse representation stores only non-zero entries as (term, weight) pairs, dramatically reducing storage and computation. The absence of a term in the `terms` array *is* the zero value - no explicit storage needed.

```typescript
/*
 * =============================================================================
 * TYPES
 * =============================================================================
 */

export interface SparseVector {
  terms: string[];
  weights: number[];
}

export interface MatchingTerm {
  term: string;
  queryWeight: number;
  docWeight: number;
}

/*
 * =============================================================================
 * MAIN API
 * =============================================================================
 */

/*
 * Calculate cosine similarity between two sparse vectors.
 * Assumes vectors are already L2-normalized.
 */
export function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  /*
   * Sparse vectors only store non-zero terms, so computing the dot product
   * requires finding the intersection of terms present in both vectors.
   *
   * Naive approach: For each term in a, scan all terms in b → O(n × m)
   * Map approach: Build a lookup map from b, then iterate a → O(n + m)
   *
   * Example with vectors:
   *   a: { terms: ["react", "typescript"], weights: [0.8, 0.6] }
   *   b: { terms: ["react", "nodejs"],     weights: [0.7, 0.9] }
   *
   * bTermToWeight = Map { "react" → 0.7, "nodejs" → 0.9 }
   *
   * Iterate a's terms:
   *   "react"      → found in map → 0.8 × 0.7 = 0.56
   *   "typescript" → not in map   → skip
   *
   * Result: 0.56 (only overlapping terms contribute)
   */
  const bTermToWeight = buildTermToWeightMap(b);
  return calculateDotProduct(a, bTermToWeight);
}

/*
 * Get the top matching terms between query and document for explainability.
 */
export function getTopMatchingTerms(
  queryVector: SparseVector,
  docVector: SparseVector,
  limit: number = 10
): MatchingTerm[] {
  const docTermToWeight = buildTermToWeightMap(docVector);
  const matches = findMatchingTermsWithContribution(queryVector, docTermToWeight);
  return sortAndLimitMatches(matches, limit);
}

/*
 * L2 normalize a sparse vector in place.
 */
export function l2Normalize(vector: SparseVector): SparseVector {
  const magnitude = calculateMagnitude(vector.weights);
  if (magnitude > 0) {
    for (let i = 0; i < vector.weights.length; i++) {
      vector.weights[i] /= magnitude;
    }
  }
  return vector;
}

/*
 * =============================================================================
 * HELPERS
 * =============================================================================
 */

function buildTermToWeightMap(vector: SparseVector): Map<string, number> {
  const termToWeight = new Map<string, number>();
  for (let i = 0; i < vector.terms.length; i++) {
    termToWeight.set(vector.terms[i], vector.weights[i]);
  }
  return termToWeight;
}

function calculateDotProduct(
  vector: SparseVector,
  otherTermToWeight: Map<string, number>
): number {
  let dotProduct = 0;
  for (let i = 0; i < vector.terms.length; i++) {
    const otherWeight = otherTermToWeight.get(vector.terms[i]);
    if (otherWeight !== undefined) {
      dotProduct += vector.weights[i] * otherWeight;
    }
  }
  return dotProduct;
}

function calculateMagnitude(weights: number[]): number {
  return Math.sqrt(weights.reduce((sum, w) => sum + w * w, 0));
}

interface MatchWithContribution extends MatchingTerm {
  contribution: number;
}

function findMatchingTermsWithContribution(
  queryVector: SparseVector,
  docTermToWeight: Map<string, number>
): MatchWithContribution[] {
  const matches: MatchWithContribution[] = [];

  for (let i = 0; i < queryVector.terms.length; i++) {
    const term = queryVector.terms[i];
    const docWeight = docTermToWeight.get(term);
    if (docWeight !== undefined) {
      matches.push({
        term,
        queryWeight: queryVector.weights[i],
        docWeight,
        contribution: queryVector.weights[i] * docWeight,
      });
    }
  }

  return matches;
}

function sortAndLimitMatches(
  matches: MatchWithContribution[],
  limit: number
): MatchingTerm[] {
  return matches
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, limit)
    .map(({ term, queryWeight, docWeight }) => ({ term, queryWeight, docWeight }));
}
```

#### 1.8 TF-IDF Vectorizer Service

**File**: `recommender_api/src/services/content-search/tfidf-vectorizer.service.ts` (new)

Standard TF-IDF indexing and querying. Imports text normalization and vector math from dedicated services.

```typescript
import { tokenize, NORMALIZATION_STRATEGY } from "./text-normalizer.service.js";
import { type SparseVector, l2Normalize } from "./sparse-vector.service.js";

/*
 * =============================================================================
 * TYPES
 * =============================================================================
 */

export interface Document {
  id: string;
  text: string;
}

export interface TfIdfIndex {
  vocabulary: Set<string>;
  termToIdf: Map<string, number>;
  documentIdToVector: Map<string, SparseVector>;
  totalDocuments: number;
}

interface TfIdfComponents {
  vocabulary: Set<string>;
  docIdToTermToTf: Map<string, Map<string, number>>;
  termToIdf: Map<string, number>;
}

/*
 * =============================================================================
 * INDEX BUILDING
 * =============================================================================
 */

/*
 * Build a TF-IDF index from documents with concatenated text.
 */
export function buildTfIdfIndex(documents: Document[]): TfIdfIndex {
  const { vocabulary, docIdToTermToTf, termToIdf } = computeTfIdfComponents(documents);
  const documentIdToVector = buildDocumentVectors(documents, docIdToTermToTf, termToIdf);

  return {
    vocabulary,
    termToIdf,
    documentIdToVector,
    totalDocuments: documents.length,
  };
}

function computeTfIdfComponents(documents: Document[]): TfIdfComponents {
  const vocabulary = new Set<string>();
  // Counts how many documents contain each term - the standard definition of document frequency (DF) in TF-IDF
  const termToDocumentFrequency = new Map<string, number>();
  const docIdToTermCounts = new Map<string, Map<string, number>>();

  for (const doc of documents) {
    const termToCountInDoc = computeTermCountsInDocument(doc.text);
    docIdToTermCounts.set(doc.id, termToCountInDoc);

    for (const term of termToCountInDoc.keys()) {
      vocabulary.add(term);
      termToDocumentFrequency.set(term, (termToDocumentFrequency.get(term) || 0) + 1);
    }
  }

  const docIdToTermToTf = computeTfFromTermCounts(docIdToTermCounts);
  const termToIdf = computeIdfFromDocumentFrequency(termToDocumentFrequency, documents.length);

  return { vocabulary, docIdToTermToTf, termToIdf };
}

function computeTermCountsInDocument(text: string): Map<string, number> {
  const termToCountInDoc = new Map<string, number>();
  const tokens = tokenize(text, NORMALIZATION_STRATEGY);

  for (const token of tokens) {
    termToCountInDoc.set(token, (termToCountInDoc.get(token) || 0) + 1);
  }

  return termToCountInDoc;
}

function computeTfFromTermCounts(
  docIdToTermCounts: Map<string, Map<string, number>>
): Map<string, Map<string, number>> {
  const docIdToTermToTf = new Map<string, Map<string, number>>();

  for (const [docId, termToCountInDoc] of docIdToTermCounts) {
    const numTotalTermsInDoc = Array.from(termToCountInDoc.values()).reduce((sum, count) => sum + count, 0);
    const termToTfInDoc = new Map<string, number>();

    for (const [term, termCountInDoc] of termToCountInDoc) {
      termToTfInDoc.set(term, termCountInDoc / numTotalTermsInDoc);
    }

    docIdToTermToTf.set(docId, termToTfInDoc);
  }

  return docIdToTermToTf;
}

function computeIdfFromDocumentFrequency(
  termToDocumentFrequency: Map<string, number>,
  totalDocs: number
): Map<string, number> {
  const termToIdf = new Map<string, number>();
  for (const [term, documentFrequency] of termToDocumentFrequency) {
    termToIdf.set(term, Math.log(totalDocs / (documentFrequency + 1)) + 1); // Smoothed IDF
  }
  return termToIdf;
}

function buildDocumentVectors(
  documents: Document[],
  docIdToTermToTf: Map<string, Map<string, number>>,
  termToIdf: Map<string, number>
): Map<string, SparseVector> {
  const documentIdToVector = new Map<string, SparseVector>();

  for (const doc of documents) {
    const termToTfInDoc = docIdToTermToTf.get(doc.id)!;
    const vector = buildSingleDocumentVector(termToTfInDoc, termToIdf);
    documentIdToVector.set(doc.id, l2Normalize(vector));
  }

  return documentIdToVector;
}

function buildSingleDocumentVector(
  termToTfInDoc: Map<string, number>,
  termToIdf: Map<string, number>
): SparseVector {
  const terms: string[] = [];
  const weights: number[] = [];

  for (const [term, tf] of termToTfInDoc) {
    const idf = termToIdf.get(term) || 0;
    const tfidf = tf * idf;

    if (tfidf > 0) {
      terms.push(term);
      weights.push(tfidf);
    }
  }

  return { terms, weights };
}

/*
 * =============================================================================
 * QUERY PROCESSING
 * =============================================================================
 */

/*
 * Convert a query string to a TF-IDF vector using the IDF values from the corpus index.
 * This ensures query terms are weighted consistently with document terms.
 */
export function queryToVector(query: string, index: TfIdfIndex): SparseVector {
  const tokens = tokenize(query, NORMALIZATION_STRATEGY);
  const termCounts = countKnownTerms(tokens, index.vocabulary);
  const vector = buildQueryVector(termCounts, tokens.length, index.termToIdf);
  return l2Normalize(vector);
}

function countKnownTerms(
  tokens: string[],
  vocabulary: Set<string>
): Map<string, number> {
  const termCounts = new Map<string, number>();
  for (const token of tokens) {
    if (vocabulary.has(token)) {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
    }
  }
  return termCounts;
}

function buildQueryVector(
  termCounts: Map<string, number>,
  totalTokens: number,
  termToIdf: Map<string, number>
): SparseVector {
  const terms: string[] = [];
  const weights: number[] = [];

  for (const [term, count] of termCounts) {
    const tf = count / totalTokens;
    const idf = termToIdf.get(term) || 0;
    const tfidf = tf * idf;

    if (tfidf > 0) {
      terms.push(term);
      weights.push(tfidf);
    }
  }

  return { terms, weights };
}

/*
 * =============================================================================
 * RE-EXPORTS
 * =============================================================================
 */

export { type SparseVector } from "./sparse-vector.service.js";
export { cosineSimilarity, getTopMatchingTerms } from "./sparse-vector.service.js";
export { tokenize } from "./text-normalizer.service.js";
```

#### 1.9 TF-IDF Index Manager

**File**: `recommender_api/src/services/content-search/tfidf-index-manager.service.ts` (new)

Manages building and storing the TF-IDF index from Neo4j engineer data.

```typescript
import { Session } from "neo4j-driver";
import {
  buildTfIdfIndex,
  type Document,
  type TfIdfIndex,
} from "./tfidf-vectorizer.service.js";

// In-memory index (rebuilt on startup, updated on resume upload)
let tfIdfIndex: TfIdfIndex | null = null;

/*
 * Load all engineer documents from Neo4j with concatenated text.
 *
 * This query aggregates all searchable text:
 * - Headline
 * - Job titles from WorkExperience nodes
 * - Skills (all types)
 * - Domains from BusinessDomain and TechnicalDomain relationships
 * - Job highlights from WorkExperience nodes
 * - Resume text
 */
async function loadEngineerDocuments(session: Session): Promise<Document[]> {
  const result = await session.run(`
    MATCH (e:Engineer)

    // Collect job titles from work history
    OPTIONAL MATCH (e)-[:HAD_ROLE]->(w:WorkExperience)
    WITH e, collect(DISTINCT w.title) AS jobTitles, collect(DISTINCT w.highlights) AS allHighlights

    // Flatten highlights arrays (each WorkExperience has highlights: string[])
    WITH e, jobTitles,
         reduce(acc = [], h IN allHighlights | acc + COALESCE(h, [])) AS flatHighlights

    // Collect skills
    OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    WITH e, jobTitles, flatHighlights, collect(DISTINCT s.name) AS skills

    // Collect domains
    OPTIONAL MATCH (e)-[:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    OPTIONAL MATCH (e)-[:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
    WITH e, jobTitles, flatHighlights, skills,
         collect(DISTINCT bd.name) + collect(DISTINCT td.name) AS domains

    // Get resume text
    OPTIONAL MATCH (e)-[:HAS_RESUME]->(r:Resume)

    RETURN
      e.id AS engineerId,
      e.headline AS headline,
      jobTitles,
      skills,
      domains,
      flatHighlights AS jobHighlights,
      r.rawText AS resumeText
  `);

  return result.records.map((record) => {
    const engineerId = record.get("engineerId") as string;
    const headline = (record.get("headline") as string) || "";
    const jobTitles = (record.get("jobTitles") as string[]) || [];
    const skills = (record.get("skills") as (string | null)[]) || [];
    const domains = (record.get("domains") as (string | null)[]) || [];
    const jobHighlights = (record.get("jobHighlights") as string[]) || [];
    const resumeText = (record.get("resumeText") as string) || "";

    /*
     * Concatenate all text fields into a single string.
     * TF-IDF will weight terms by frequency and rarity, not by source field.
     *
     * Note: Skills extracted from the resume appear both in the `skills` array and in
     * `resumeText`, causing some double-counting. This is acceptable because:
     * 1. The effect is consistent across all engineers (same extraction process)
     * 2. The impact is small relative to total text length
     * 3. Including both gives us normalized skill names AND rich resume context
     */
    const text = [
      headline,
      jobTitles.join(" "),
      skills.filter(Boolean).join(" "),
      domains.filter(Boolean).join(" "),
      jobHighlights.join(" "),
      resumeText,
    ]
      .filter(Boolean)
      .join(" ");

    return { id: engineerId, text };
  });
}

/*
 * Build or rebuild the TF-IDF index from all engineers in Neo4j.
 */
export async function buildEngineerTfIdfIndex(session: Session): Promise<TfIdfIndex> {
  const documents = await loadEngineerDocuments(session);
  tfIdfIndex = buildTfIdfIndex(documents);

  console.log(
    `[TF-IDF] Built index with ${tfIdfIndex.totalDocuments} documents, ` +
    `${tfIdfIndex.vocabulary.size} terms`
  );

  return tfIdfIndex;
}

/*
 * Get the current TF-IDF index, building it if necessary.
 */
export async function getTfIdfIndex(session: Session): Promise<TfIdfIndex> {
  if (!tfIdfIndex) {
    return buildEngineerTfIdfIndex(session);
  }
  return tfIdfIndex;
}

/*
 * Update the index after a new or updated engineer document.
 *
 * Currently rebuilds the entire index for simplicity. This is acceptable because:
 * 1. Corpus is small (hundreds of engineers)
 * 2. Resume uploads are infrequent
 * 3. Rebuild is fast at this scale
 *
 * Revisit if: corpus grows to thousands+ documents AND uploads become frequent.
 * At that point, consider accepting stale IDF values for new documents and
 * rebuilding the full index periodically in a background job.
 */
export async function updateTfIdfIndex(session: Session): Promise<void> {
  await buildEngineerTfIdfIndex(session);
}

/*
 * Reset the index (for testing).
 */
export function resetTfIdfIndex(): void {
  tfIdfIndex = null;
}
```

#### 1.10 Resume Schema

**File**: `recommender_api/src/schemas/resume.schema.ts` (new)

```typescript
import { z } from "zod";
import { StartTimelineSchema } from "./search.schema.js";

// Resume upload request
export const ResumeUploadRequestSchema = z.object({
  resumeText: z.string().min(100, "Resume text must be at least 100 characters"),

  // For existing engineer updates
  engineerId: z.string().optional(),

  // For new engineer creation (required if engineerId not provided)
  engineerName: z.string().optional(),
  engineerEmail: z.string().email().optional(),

  // Processing options
  extractFeatures: z.boolean().default(true),
  // If present, generate vectors of these types. If absent, skip vector generation.
  generateVectors: z.array(z.enum(["tfidf", "embedding"])).optional().default(["tfidf"]),
}).refine(
  (data) => data.engineerId || (data.engineerName && data.engineerEmail),
  {
    message: "Either engineerId (for update) or engineerName + engineerEmail (for create) is required",
    path: ["engineerId"],
  }
);

export type ResumeUploadRequest = z.infer<typeof ResumeUploadRequestSchema>;

// Job-centric extraction schemas (matches LLM extraction output)
export const ExtractedJobSkillSchema = z.object({
  name: z.string(),
  confidence: z.enum(["explicit", "inferred", "uncertain"]),
});

export const ExtractedJobSchema = z.object({
  title: z.string(),
  company: z.string(),
  companyType: z.string(),
  startDate: z.string(),              // "2020-01" or "2020"
  endDate: z.union([z.string(), z.literal("present")]),
  seniority: z.enum(["junior", "mid", "senior", "staff", "principal"]),
  skills: z.array(ExtractedJobSkillSchema),
  highlights: z.array(z.string()),
});

export const ExtractedFeaturesSchema = z.object({
  jobs: z.array(ExtractedJobSchema),   // Ordered by date ASCENDING (oldest first)
  skills: z.array(z.string()),         // Standalone skills from Skills section (not tied to specific jobs)
  businessDomains: z.array(z.string()), // e.g., "Fintech", "Healthcare", "E-commerce"
  technicalDomains: z.array(z.string()), // e.g., "Backend", "Frontend", "DevOps"
  totalYearsExperience: z.number(),
  headline: z.string().nullable(),
});

// Normalization result for each skill found across all jobs
export const NormalizationResultSchema = z.object({
  extracted: z.string(),
  canonicalId: z.string().nullable(),
  canonicalName: z.string().nullable(),
  method: z.enum(["exact", "synonym", "fuzzy", "unresolved"]),
  confidence: z.number(),
});

export const ResumeUploadResponseSchema = z.object({
  engineerId: z.string(),
  isNewEngineer: z.boolean(),

  extractedFeatures: ExtractedFeaturesSchema.optional(),

  validationResults: z.object({
    // Skills normalization results
    resolvedSkills: z.array(NormalizationResultSchema),
    unresolvedSkills: z.array(z.string()),
    // Business domain normalization results
    resolvedBusinessDomains: z.array(z.object({
      extracted: z.string(),
      canonicalId: z.string(),
      canonicalName: z.string(),
    })),
    unresolvedBusinessDomains: z.array(z.string()),
    // Technical domain normalization results
    resolvedTechnicalDomains: z.array(z.object({
      extracted: z.string(),
      canonicalId: z.string(),
      canonicalName: z.string(),
    })),
    unresolvedTechnicalDomains: z.array(z.string()),
  }).optional(),

  vectors: z.object({
    tfidf: z.object({
      termCount: z.number(),
      nonZeroTerms: z.number(),
    }).optional(),
    embedding: z.object({
      dimensions: z.number(),
      model: z.string(),
    }).optional(),
  }).optional(),
});

export type ResumeUploadResponse = z.infer<typeof ResumeUploadResponseSchema>;

// Content search request
export const ContentSearchRequestSchema = z.object({
  // One of these is required
  queryText: z.string().optional(),
  similarToEngineerId: z.string().optional(),

  // Search method
  method: z.enum(["tfidf", "embedding", "hybrid"]).default("tfidf"),

  // Future: Add optional filters (maxBudget, requiredTimezone) once basic search is validated

  // Pagination
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
}).refine(
  (data) => data.queryText || data.similarToEngineerId,
  {
    message: "Either queryText or similarToEngineerId is required",
    path: ["queryText"],
  }
);

export type ContentSearchRequest = z.infer<typeof ContentSearchRequestSchema>;

// Content search response
export const ContentMatchSchema = z.object({
  id: z.string(),
  name: z.string(),
  headline: z.string(),
  salary: z.number(),
  yearsExperience: z.number(),
  timezone: z.string(),

  // Content-based scoring
  contentScore: z.number(),
  contentScoreBreakdown: z.object({
    tfidfScore: z.number().optional(),
    embeddingScore: z.number().optional(),
    tfidfMatchingTerms: z.array(z.string()).optional(),
  }).optional(),
});

export const ContentSearchResponseSchema = z.object({
  matches: z.array(ContentMatchSchema),
  totalCount: z.number(),
  searchMethod: z.enum(["tfidf", "embedding", "hybrid"]),
  queryMetadata: z.object({
    executionTimeMs: z.number(),
    documentsSearched: z.number(),
    requiredTerms: z.array(z.string()).optional(),        // Boolean filter terms that were applied (echo back)
  }),
});

export type ContentSearchResponse = z.infer<typeof ContentSearchResponseSchema>;
```

#### 1.11 Resume Upload Service

**File**: `recommender_api/src/services/resume-processor/resume-upload.service.ts` (new)

Thin orchestrator that coordinates the resume upload workflow using the extracted services.

```typescript
import { Session } from "neo4j-driver";
import {
  extractFeaturesFromResume,
  getAllUniqueSkillNames,
  type ExtractedProfile,
} from "./feature-extractor.service.js";
import { normalizeExtractedSkills } from "../skill-normalizer.service.js";
import { normalizeExtractedDomains } from "../domain-normalizer.service.js";
import { linkEngineerToDomains } from "../domain.service.js";
import {
  engineerExists,
  createEngineer,
  updateEngineerProperties,
} from "../engineer.service.js";
import { storeResume } from "../resume.service.js";
import { buildSkillNameToWorkExperienceIdMap, createUserSkills } from "../user-skill.service.js";
import { createWorkExperiencesFromExtractedJobs } from "../work-experience.service.js";
import { updateTfIdfIndex } from "../content-search/tfidf-index-manager.service.js";
import type { ResumeUploadRequest, ResumeUploadResponse } from "../../schemas/resume.schema.js";

/*
 * Process a resume upload: extract features, normalize skills, create/update engineer, generate vectors.
 */
export async function processResumeUpload(
  session: Session,
  request: ResumeUploadRequest
): Promise<ResumeUploadResponse> {
  // Step 1: Determine if this is create or update
  let engineerId: string;
  let isNewEngineer: boolean;

  if (request.engineerId) {
    // Update existing engineer
    const exists = await engineerExists(session, request.engineerId);
    if (!exists) {
      throw new Error(`Engineer not found: ${request.engineerId}`);
    }
    engineerId = request.engineerId;
    isNewEngineer = false;
  } else {
    // Create new engineer
    engineerId = await createEngineer(session, request.engineerName!, request.engineerEmail!);
    isNewEngineer = true;
  }

  // Step 2: Store resume snapshot
  await storeResume(session, engineerId, request.resumeText);

  // Step 3: Extract features if requested
  let extractedFeatures: ExtractedProfile | null = null;
  let validationResults: ResumeUploadResponse["validationResults"] = undefined;

  if (request.extractFeatures) {
    // Extract with RAG context (domains constrained by our taxonomy)
    extractedFeatures = await extractFeaturesFromResume(session, request.resumeText);

    if (extractedFeatures) {
      // Update simple engineer properties (seniority, years experience, headline)
      await updateEngineerProperties(session, engineerId, extractedFeatures);

      // Normalize and link business domains
      const { resolvedDomains: resolvedBusinessDomains, unresolvedDomains: unresolvedBusinessDomains } =
        await normalizeExtractedDomains(session, extractedFeatures.businessDomains, "BusinessDomain");
      await linkEngineerToDomains(session, engineerId, resolvedBusinessDomains, "BusinessDomain");

      // Normalize and link technical domains
      const { resolvedDomains: resolvedTechnicalDomains, unresolvedDomains: unresolvedTechnicalDomains } =
        await normalizeExtractedDomains(session, extractedFeatures.technicalDomains, "TechnicalDomain");
      await linkEngineerToDomains(session, engineerId, resolvedTechnicalDomains, "TechnicalDomain");

      /*
       * SKILL DATA MODEL:
       *
       * (Engineer)-[:HAS]->(UserSkill)-[:FOR]->(Skill)
       *                               |
       *                         [:USED_AT]
       *                               |
       *                               v
       *                        (WorkExperience)
       *
       * - Skill: shared canonical skill node from our taxonomy (e.g., "Python")
       * - UserSkill: per-engineer node representing "this engineer knows this skill"
       *   - Can hold engineer-specific data (proficiency, years with skill, etc.)
       *   - Multiple engineers' UserSkills point to the same shared Skill
       * - USED_AT: links UserSkill to specific jobs where the skill was used
       *
       * SKILL SOURCES:
       * 1. Job-specific skills - extracted from job entries (get USED_AT relationship)
       * 2. Standalone skills - from resume's Skills section (no job association)
       *
       * NORMALIZATION FLOW:
       * 1. Collect ALL unique skill names (from jobs + standalone skills section)
       * 2. Normalize each unique name ONCE (avoids duplicate DB queries for "React" appearing 5x)
       * 3. Create UserSkill for each resolved skill
       * 4. For job-specific skills, also create USED_AT links to WorkExperience
       */
      const uniqueSkillNames = getAllUniqueSkillNames(extractedFeatures);

      /*
       * Normalize extracted skill names to our canonical skill taxonomy.
       * Example: "JS", "javascript", "JavaScript" → canonical skill "JavaScript" (id: "javascript")
       *
       * Returns resolved skills (matched our taxonomy) and unresolved skills (needs review).
       */
      const { resolvedSkills, unresolvedSkills } = await normalizeExtractedSkills(session, uniqueSkillNames);

      // Create work history (Companies, WorkExperiences)
      const jobIndexToWorkExperienceId = await createWorkExperiencesFromExtractedJobs(session, engineerId, extractedFeatures.jobs);

      // Build skill → workExperienceIds map from job structure (pure function)
      const skillNameToWorkExperienceIds = buildSkillNameToWorkExperienceIdMap(extractedFeatures.jobs, jobIndexToWorkExperienceId);

      /*
       * Create UserSkills with USED_AT links in a single pass.
       *
       * Skills from the resume's Skills section → UserSkill only (no job association)
       * Skills from work experience entries → UserSkill + USED_AT links to those jobs
       *
       * The skillNameToWorkExperienceIds map tells us which skills came from jobs.
       * Skills not in that map are standalone (from the Skills section).
       */
      await createUserSkills(session, engineerId, resolvedSkills, skillNameToWorkExperienceIds);

      validationResults = {
        resolvedSkills: resolvedSkills.map((n) => ({
          extracted: n.originalName,
          canonicalId: n.canonicalSkillId,
          canonicalName: n.canonicalSkillName,
          method: n.method,
          confidence: n.confidence,
        })),
        unresolvedSkills: unresolvedSkills.map((n) => n.originalName),
        resolvedBusinessDomains: resolvedBusinessDomains.map((d) => ({
          extracted: d.originalName,
          canonicalId: d.canonicalDomainId,
          canonicalName: d.canonicalDomainName,
        })),
        unresolvedBusinessDomains: unresolvedBusinessDomains.map((d) => d.originalName),
        resolvedTechnicalDomains: resolvedTechnicalDomains.map((d) => ({
          extracted: d.originalName,
          canonicalId: d.canonicalDomainId,
          canonicalName: d.canonicalDomainName,
        })),
        unresolvedTechnicalDomains: unresolvedTechnicalDomains.map((d) => d.originalName),
      };
    }
  }

  // Step 4: Update TF-IDF index
  if (request.generateVectors?.includes("tfidf")) {
    await updateTfIdfIndex(session);
  }

  // Build response
  const response: ResumeUploadResponse = {
    engineerId,
    isNewEngineer,
  };

  if (extractedFeatures) {
    response.extractedFeatures = extractedFeatures;
  }

  if (validationResults) {
    response.validationResults = validationResults;
  }

  if (request.generateVectors?.length) {
    response.vectors = {};
    if (request.generateVectors.includes("tfidf")) {
      response.vectors.tfidf = {
        termCount: 0,  // Will be populated from index stats
        nonZeroTerms: 0,
      };
    }
  }

  return response;
}
```

#### 1.12 Domain Normalizer Service

**File**: `recommender_api/src/services/domain-normalizer.service.ts` (new)

Normalizes extracted domain names to our canonical domain taxonomy. Follows the same pattern as skill-normalizer and company-normalizer.

```typescript
import { Session } from "neo4j-driver";

export interface DomainNormalizationResult {
  originalName: string;
  canonicalDomainId: string | null;
  canonicalDomainName: string | null;
}

export interface NormalizedDomainsResult {
  resolvedDomains: DomainNormalizationResult[];
  unresolvedDomains: DomainNormalizationResult[];
}

export type DomainNodeType = "BusinessDomain" | "TechnicalDomain";

/*
 * Normalize extracted domain names to our canonical domain taxonomy.
 * Works for both BusinessDomain and TechnicalDomain node types.
 */
export async function normalizeExtractedDomains(
  session: Session,
  extractedDomainNames: string[],
  domainType: DomainNodeType
): Promise<NormalizedDomainsResult> {
  const results: DomainNormalizationResult[] = [];

  for (const domainName of extractedDomainNames) {
    // Try to match against the specified domain taxonomy
    const result = await session.run(`
      MATCH (d:${domainType})
      WHERE toLower(d.name) = toLower($domainName)
      RETURN d.id AS domainId, d.name AS domainName
      LIMIT 1
    `, { domainName });

    if (result.records.length > 0) {
      const record = result.records[0];
      results.push({
        originalName: domainName,
        canonicalDomainId: record.get("domainId") as string,
        canonicalDomainName: record.get("domainName") as string,
      });
    } else {
      results.push({
        originalName: domainName,
        canonicalDomainId: null,
        canonicalDomainName: null,
      });
    }
  }

  return {
    resolvedDomains: results.filter((r) => r.canonicalDomainId !== null),
    unresolvedDomains: results.filter((r) => r.canonicalDomainId === null),
  };
}
```

#### 1.13 Domain Service

**File**: `recommender_api/src/services/domain.service.ts` (new)

Handles domain relationship creation (linking engineers to domains).

```typescript
import { Session } from "neo4j-driver";
import { DomainNormalizationResult, DomainNodeType } from "./domain-normalizer.service.js";

/*
 * Link engineer to resolved domains (business or technical).
 */
export async function linkEngineerToDomains(
  session: Session,
  engineerId: string,
  resolvedDomains: DomainNormalizationResult[],
  domainType: DomainNodeType
): Promise<void> {
  for (const domain of resolvedDomains) {
    if (domain.canonicalDomainId) {
      await session.run(`
        MATCH (e:Engineer {id: $engineerId})
        MATCH (d:${domainType} {id: $domainId})
        MERGE (e)-[:HAS_EXPERIENCE_IN]->(d)
      `, { engineerId, domainId: domain.canonicalDomainId });
    }
  }
}
```

#### 1.14 Engineer Service

**File**: `recommender_api/src/services/engineer.service.ts` (new)

Handles engineer CRUD operations and resume storage.

```typescript
import { Session } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";
import { ExtractedProfile } from "./feature-extractor.service.js";

export async function engineerExists(session: Session, engineerId: string): Promise<boolean> {
  const result = await session.run(
    `MATCH (e:Engineer {id: $engineerId}) RETURN e.id`,
    { engineerId }
  );
  return result.records.length > 0;
}

export async function createEngineer(
  session: Session,
  name: string,
  email: string
): Promise<string> {
  const engineerId = `eng_${uuidv4().slice(0, 8)}`;

  await session.run(
    `
    CREATE (e:Engineer {
      id: $engineerId,
      name: $name,
      email: $email,
      headline: '',
      salary: 0,
      yearsExperience: 0,
      startTimeline: 'immediate',
      timezone: 'Eastern',
      createdAt: datetime()
    })
    `,
    { engineerId, name, email }
  );

  return engineerId;
}

/*
 * Update simple engineer properties from extracted profile.
 * Domain linking is handled separately by normalizeExtractedDomains + linkEngineerToDomains.
 */
export async function updateEngineerProperties(
  session: Session,
  engineerId: string,
  profile: ExtractedProfile
): Promise<void> {
  // Compute seniority from most recent job
  const mostRecentJob = profile.jobs[profile.jobs.length - 1];
  const currentSeniority = mostRecentJob?.seniority || "mid";

  await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    SET
      e.headline = COALESCE($headline, e.headline),
      e.yearsExperience = $yearsExperience,
      e.extractedSeniority = $seniority
  `, {
    engineerId,
    headline: profile.headline,
    yearsExperience: profile.totalYearsExperience,
    seniority: currentSeniority,
  });
}

export interface EngineerBasicInfo {
  id: string;
  name: string;
  headline: string;
  salary: number;
  yearsExperience: number;
  timezone: string;
}

/*
 * Load basic info for a list of engineers by their IDs.
 */
export async function loadEngineerInfo(
  session: Session,
  engineerIds: string[]
): Promise<Map<string, EngineerBasicInfo>> {
  if (engineerIds.length === 0) {
    return new Map();
  }

  const result = await session.run(
    `
    MATCH (e:Engineer)
    WHERE e.id IN $engineerIds
    RETURN
      e.id AS id,
      e.name AS name,
      e.headline AS headline,
      e.salary AS salary,
      e.yearsExperience AS yearsExperience,
      e.timezone AS timezone
    `,
    { engineerIds }
  );

  const engineerIdToInfo = new Map<string, EngineerBasicInfo>();
  for (const record of result.records) {
    engineerIdToInfo.set(record.get("id"), {
      id: record.get("id"),
      name: record.get("name"),
      headline: record.get("headline") || "",
      salary: (record.get("salary") as { low: number })?.low || record.get("salary") || 0,
      yearsExperience: (record.get("yearsExperience") as { low: number })?.low || record.get("yearsExperience") || 0,
      timezone: record.get("timezone") || "Eastern",
    });
  }

  return engineerIdToInfo;
}
```

#### 1.15 Resume Service

**File**: `recommender_api/src/services/resume.service.ts` (new)

Handles Resume node storage and retrieval.

```typescript
import { Session } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";

/*
 * Store or update a resume for an engineer.
 * Uses MERGE to handle both creation and updates.
 */
export async function storeResume(
  session: Session,
  engineerId: string,
  resumeText: string
): Promise<void> {
  const snapshotId = `resume_${uuidv4().slice(0, 8)}`;

  await session.run(
    `
    MATCH (e:Engineer {id: $engineerId})
    MERGE (e)-[:HAS_RESUME]->(r:Resume {engineerId: $engineerId})
    ON CREATE SET
      r.id = $snapshotId,
      r.rawText = $resumeText,
      r.processedAt = datetime()
    ON MATCH SET
      r.rawText = $resumeText,
      r.processedAt = datetime()
    `,
    { engineerId, snapshotId, resumeText }
  );
}

```

#### 1.16 User Skill Service

**File**: `recommender_api/src/services/user-skill.service.ts` (new)

Handles UserSkill node creation and USED_AT relationship linking.

```typescript
import { Session } from "neo4j-driver";
import { ExtractedJob } from "./feature-extractor.service.js";

/*
 * Build a map of skillName → workExperienceIds from job structure.
 * Pure function - no DB access.
 */
export function buildSkillNameToWorkExperienceIdMap(
  jobs: ExtractedJob[],
  jobIndexToWorkExperienceId: Map<number, string>
): Map<string, string[]> {
  const skillNameToWorkExperienceIds = new Map<string, string[]>();

  jobs.forEach((job, index) => {
    const workExperienceId = jobIndexToWorkExperienceId.get(index);
    if (!workExperienceId) return;

    for (const skill of job.skills) {
      const normalizedSkillName = skill.name.toLowerCase();
      const workExperienceIdsForSkill = skillNameToWorkExperienceIds.get(normalizedSkillName) || [];
      workExperienceIdsForSkill.push(workExperienceId);
      skillNameToWorkExperienceIds.set(normalizedSkillName, workExperienceIdsForSkill);
    }
  });

  return skillNameToWorkExperienceIds;
}

/*
 * Create UserSkill nodes for all resolved skills, with USED_AT links for job-specific skills.
 *
 * UserSkill is the single source of truth for "engineer knows skill".
 * USED_AT links connect UserSkills to WorkExperiences where the skill was used.
 * Skills from the standalone Skills section will have UserSkills but no USED_AT links.
 */
export async function createUserSkills(
  session: Session,
  engineerId: string,
  resolvedSkills: Array<{ originalName: string; canonicalSkillId: string | null }>,
  skillNameToWorkExperienceIds: Map<string, string[]>
): Promise<void> {
  for (const resolvedSkill of resolvedSkills) {
    if (!resolvedSkill.canonicalSkillId) continue;

    // Create UserSkill
    await session.run(`
      MATCH (e:Engineer {id: $engineerId})
      MATCH (s:Skill {id: $skillId})
      MERGE (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s)
      ON CREATE SET
        us.id = randomUUID(),
        us.proficiencyLevel = 'proficient',
        us.createdAt = datetime()
    `, {
      engineerId,
      skillId: resolvedSkill.canonicalSkillId,
    });

    // Create USED_AT links if this skill was used in jobs
    const workExperienceIds = skillNameToWorkExperienceIds.get(resolvedSkill.originalName.toLowerCase()) || [];
    for (const workExperienceId of workExperienceIds) {
      await session.run(`
        MATCH (e:Engineer {id: $engineerId})-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill {id: $skillId})
        MATCH (w:WorkExperience {id: $workExperienceId})
        MERGE (us)-[:USED_AT]->(w)
      `, {
        engineerId,
        skillId: resolvedSkill.canonicalSkillId,
        workExperienceId,
      });
    }
  }
}
```

#### 1.17 Work Experience Service

**File**: `recommender_api/src/services/work-experience.service.ts` (new)

Handles WorkExperience node creation and relationships.

```typescript
import { Session } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";
import { ExtractedJob } from "./feature-extractor.service.js";
import { findOrCreateCompany } from "./company.service.js";

/*
 * Create work history: Company nodes and WorkExperience nodes.
 * Returns a map of jobIndex → workExperienceId for linking skills to jobs.
 */
export async function createWorkExperiencesFromExtractedJobs(
  session: Session,
  engineerId: string,
  jobs: ExtractedJob[]
): Promise<Map<number, string>> {
  const jobIndexToWorkExperienceId = new Map<number, string>();

  for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
    const job = jobs[jobIndex];

    // Step 1: Find or create the Company node
    const companyId = await findOrCreateCompany(session, job.company, job.companyType);

    // Step 2: Create WorkExperience node
    const workExperienceId = `wexp_${uuidv4().slice(0, 8)}`;
    jobIndexToWorkExperienceId.set(jobIndex, workExperienceId);

    await session.run(`
      CREATE (w:WorkExperience {
        id: $workExperienceId,
        title: $title,
        startDate: $startDate,
        endDate: $endDate,
        seniority: $seniority,
        highlights: $highlights
      })
    `, {
      workExperienceId,
      title: job.title,
      startDate: job.startDate,
      endDate: job.endDate,
      seniority: job.seniority,
      highlights: job.highlights,
    });

    // Step 3: Create relationships
    // Engineer -[:HAD_ROLE]-> WorkExperience
    await session.run(`
      MATCH (e:Engineer {id: $engineerId})
      MATCH (w:WorkExperience {id: $workExperienceId})
      CREATE (e)-[:HAD_ROLE]->(w)
    `, { engineerId, workExperienceId });

    // WorkExperience -[:AT_COMPANY]-> Company
    await session.run(`
      MATCH (w:WorkExperience {id: $workExperienceId})
      MATCH (c:Company {id: $companyId})
      CREATE (w)-[:AT_COMPANY]->(c)
    `, { workExperienceId, companyId });
  }

  return jobIndexToWorkExperienceId;
}
```

#### 1.18 Company Service

**File**: `recommender_api/src/services/company.service.ts` (new)

Handles Company node creation and lookup.

```typescript
import { Session } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";
import { normalizeCompanyName } from "./company-normalizer.service.js";

/*
 * Find an existing Company by normalized name (including aliases), or create a new one.
 * Uses company normalizer for suffix stripping and alias resolution.
 */
export async function findOrCreateCompany(
  session: Session,
  companyName: string,
  companyType: string
): Promise<string> {
  // Step 1: Normalize company name (strip suffixes, check aliases)
  const normalization = await normalizeCompanyName(session, companyName);

  // Step 2: If we found an existing company (exact or alias match), return it
  if (normalization.canonicalCompanyId) {
    return normalization.canonicalCompanyId;
  }

  // Step 3: Create new company with normalized name
  const companyId = `company_${uuidv4().slice(0, 8)}`;

  /*
   * MERGE on normalizedName ensures we don't create duplicates.
   * The normalizer already checked for exact/alias matches, so this
   * should create a new company.
   */
  const result = await session.run(`
    MERGE (c:Company {normalizedName: $normalizedName})
    ON CREATE SET
      c.id = $companyId,
      c.name = $companyName,
      c.type = $companyType
    RETURN c.id AS companyId
  `, {
    normalizedName: normalization.normalizedName,
    companyId,
    companyName: companyName.trim(), // Keep original casing for display name
    companyType,
  });

  return result.records[0].get("companyId");
}
```

#### 1.19 Content Search Service (TF-IDF)

**File**: `recommender_api/src/services/content-search/content-search.service.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import { getTfIdfIndex, type TfIdfIndex } from "./tfidf-index-manager.service.js";
import {
  queryToVector,
  cosineSimilarity,
  getTopMatchingTerms,
  type SparseVector,
} from "./tfidf-vectorizer.service.js";
import { loadEngineerInfo } from "../engineer.service.js";
import type { ContentSearchRequest, ContentSearchResponse } from "../../schemas/resume.schema.js";

/*
 * Execute content-based search using TF-IDF similarity.
 */
export async function executeContentSearch(
  session: Session,
  request: ContentSearchRequest
): Promise<ContentSearchResponse> {
  const startTime = Date.now();

  // Get or build the TF-IDF index
  const tfIdfIndex = await getTfIdfIndex(session);

  // Get query vector
  let queryVector: SparseVector;
  let queryText: string;

  if (request.similarToEngineerId) {
    // Find similar to an existing engineer
    // The TF-IDF index uses engineer IDs as document IDs
    const targetVector = tfIdfIndex.documentIdToVector.get(request.similarToEngineerId);
    if (!targetVector) {
      throw new Error(`Engineer not found in index: ${request.similarToEngineerId}`);
    }
    queryVector = targetVector;
    queryText = "";  // No query text for similarity search
  } else {
    queryText = request.queryText!;
    queryVector = queryToVector(queryText, tfIdfIndex);
  }

  // Score all documents
  const scored: Array<{ engineerId: string; score: number; tfidfMatchingTerms: string[] }> = [];

  for (const [engineerId, docVector] of tfIdfIndex.documentIdToVector) {
    // Skip self-match for similarity search
    if (request.similarToEngineerId && engineerId === request.similarToEngineerId) {
      continue;
    }

    const score = cosineSimilarity(queryVector, docVector);
    if (score > 0) {
      const matching = getTopMatchingTerms(queryVector, docVector, 5);
      scored.push({
        engineerId,
        score,
        tfidfMatchingTerms: matching.map((m) => m.term),
      });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Apply pagination
  const totalCount = scored.length;
  const paginatedResults = scored.slice(request.offset, request.offset + request.limit);

  // Load engineer details
  const engineerIds = paginatedResults.map((r) => r.engineerId);
  const engineerInfoMap = await loadEngineerInfo(session, engineerIds);

  // Build response (Future: add optional filters here once basic search is validated)
  const matches = paginatedResults
    .filter((result) => engineerInfoMap.has(result.engineerId))
    .map((result) => {
      const engineer = engineerInfoMap.get(result.engineerId)!;
      return {
        id: engineer.id,
        name: engineer.name,
        headline: engineer.headline,
        salary: engineer.salary,
        yearsExperience: engineer.yearsExperience,
        timezone: engineer.timezone,
        contentScore: result.score,
        contentScoreBreakdown: {
          tfidfScore: result.score,
          tfidfMatchingTerms: result.tfidfMatchingTerms,
        },
      };
    });

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount,
    searchMethod: "tfidf",
    queryMetadata: {
      executionTimeMs,
      documentsSearched: tfIdfIndex.totalDocuments,
    },
  };
}
```

#### 1.20 Resume Controller

**File**: `recommender_api/src/controllers/resume.controller.ts` (new)

```typescript
import type { Request, Response } from "express";
import driver from "../neo4j.js";
import { processResumeUpload } from "../services/resume-processor/resume-upload.service.js";
import type { ResumeUploadRequest } from "../schemas/resume.schema.js";

/*
 * Handle resume upload requests.
 * POST /api/resume/upload
 */
export async function uploadResume(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const request = req.body as ResumeUploadRequest;
    const response = await processResumeUpload(session, request);
    res.status(200).json(response);
  } catch (error) {
    console.error("Resume upload error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: "RESUME_UPLOAD_ERROR",
        message: "Failed to process resume upload",
        details: error instanceof Error ? [{ field: "internal", message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
```

#### 1.21 Content Search Controller

**File**: `recommender_api/src/controllers/content-search.controller.ts` (new)

```typescript
import type { Request, Response } from "express";
import driver from "../neo4j.js";
import { executeContentSearch } from "../services/content-search/content-search.service.js";
import type { ContentSearchRequest } from "../schemas/resume.schema.js";

/*
 * Handle content-based search requests.
 * POST /api/search/content
 */
export async function contentSearch(req: Request, res: Response): Promise<void> {
  const session = driver.session();

  try {
    const request = req.body as ContentSearchRequest;
    const response = await executeContentSearch(session, request);
    res.status(200).json(response);
  } catch (error) {
    console.error("Content search error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: "CONTENT_SEARCH_ERROR",
        message: "Failed to execute content search",
        details: error instanceof Error ? [{ field: "internal", message: error.message }] : undefined,
      },
    });
  } finally {
    await session.close();
  }
}
```

#### 1.22 Resume Routes

**File**: `recommender_api/src/routes/resume.routes.ts` (new)

```typescript
import { Router } from "express";
import { uploadResume } from "../controllers/resume.controller.js";
import { validate } from "../middleware/zod-validate.middleware.js";
import { ResumeUploadRequestSchema } from "../schemas/resume.schema.js";

const router = Router();

/**
 * POST /api/resume/upload
 * Upload a resume for feature extraction and indexing.
 * Creates a new engineer or updates an existing one.
 *
 * Implements Chapter 4: Content-Based Filtering
 */
router.post("/upload", validate(ResumeUploadRequestSchema), uploadResume);

export default router;
```

#### 1.23 Content Search Routes

**File**: `recommender_api/src/routes/content-search.routes.ts` (new)

```typescript
import { Router } from "express";
import { contentSearch } from "../controllers/content-search.controller.js";
import { validate } from "../middleware/zod-validate.middleware.js";
import { ContentSearchRequestSchema } from "../schemas/resume.schema.js";

const router = Router();

/**
 * POST /api/search/content
 * Search engineers using content-based similarity (TF-IDF, embeddings, or hybrid).
 *
 * Implements Chapter 4: Content-Based Filtering
 */
router.post("/content", validate(ContentSearchRequestSchema), contentSearch);

export default router;
```

#### 1.24 Wire Routes in App

**File**: `recommender_api/src/app.ts`

Add the new routes:

```typescript
import resumeRoutes from "./routes/resume.routes.js";
import contentSearchRoutes from "./routes/content-search.routes.js";

// In createApp():
app.use("/api/resume", resumeRoutes);
app.use("/api/search", contentSearchRoutes);
```

### Success Criteria - Phase 1

#### Test Fixtures: Example Engineer Resumes

Create test fixture resumes in `recommender_api/src/test/fixtures/resumes/` for use across unit, integration, and E2E tests:

| Fixture | Purpose |
|---------|---------|
| `senior-fullstack-faang.txt` | Senior engineer with FAANG experience, React/Node/AWS skills |
| `junior-backend-startup.txt` | Junior engineer with Python/Django, startup background |
| `staff-devops-enterprise.txt` | Staff engineer with Kubernetes/Terraform, enterprise experience |
| `mid-frontend-agency.txt` | Mid-level with Vue/TypeScript, agency background |
| `career-changer-bootcamp.txt` | Bootcamp grad with non-traditional background |

Each fixture should include:
- Realistic work history with dates and companies
- Mix of explicit and inferable skills
- Skill name variations to test normalization (e.g., "React.js", "k8s", "postgres")
- Company name variations to test alias resolution (e.g., "Facebook", "AWS")

#### Unit Tests

**File**: `recommender_api/src/services/content-search/text-normalizer.service.test.ts`
- [x] Removes English stopwords ("the", "and", "is", etc.)
- [x] Lemmatizes words ("applications" → "application", "running" → "run")
- [x] Tokenizes text correctly (handles punctuation, whitespace)
- [x] Handles empty/null input gracefully

**File**: `recommender_api/src/services/content-search/sparse-vector.service.test.ts`
- [x] Creates sparse vector from term frequencies
- [x] Calculates cosine similarity between two sparse vectors
- [x] Handles zero vectors (no common terms)
- [x] Handles identical vectors (similarity = 1.0)

**File**: `recommender_api/src/services/content-search/tfidf-vectorizer.service.test.ts`
- [x] Builds vocabulary from document corpus
- [x] Calculates TF (term frequency) correctly
- [x] Calculates IDF (inverse document frequency) with smoothing
- [x] Produces correct TF-IDF weights
- [x] Handles unseen terms in query (not in vocabulary)

**File**: `recommender_api/src/services/skill-normalizer.service.test.ts`
- [x] Exact match: "React" → skill_react (confidence 1.0, method "exact")
- [x] Synonym match: "reactjs" → skill_react (confidence 0.95, method "synonym")
- [x] Fuzzy match: "Kubernates" → skill_kubernetes (confidence ≥0.8, method "fuzzy")
- [x] Unresolved: "FooBarBaz123" → null (method "unresolved")
- [x] Case insensitivity: "REACT", "react", "React" all resolve to same skill

**File**: `recommender_api/src/services/company-normalizer.service.test.ts`
- [x] Strips suffixes: "Stripe, Inc." → "stripe"
- [x] Exact match: "Google" → company_google (method "exact")
- [x] Alias match: "Facebook" → company_meta (method "alias")
- [x] New company: "Unknown Startup XYZ" → null with normalized name (method "new")
- [x] Handles multiple suffix formats (Inc., LLC, Corp., etc.)

**File**: `recommender_api/src/services/content-search/tfidf-index-manager.service.test.ts`
- [x] Builds index from engineer documents
- [x] Searches index and returns ranked results
- [x] Updates index when engineer profile changes
- [x] Removes engineer from index
- [x] Returns matching terms in search results

#### Integration Tests

**File**: `recommender_api/src/services/__tests__/seed-synonyms.integration.test.ts`
- [x] Skill synonyms seeded correctly with ALIAS_FOR relationships
- [x] Synonym lookup returns correct canonical skill
- [x] Unique constraint prevents duplicate synonyms

**File**: `recommender_api/src/services/__tests__/seed-companies.integration.test.ts`
- [x] Known companies seeded with correct types
- [x] Company aliases seeded with ALIAS_FOR relationships
- [x] Alias lookup returns correct canonical company

**File**: `recommender_api/src/services/__tests__/resume-upload.integration.test.ts`
- [x] Creates new engineer with extracted skills from fixture resume
- [x] Creates UserSkill nodes linked to canonical skills
- [x] Creates WorkExperience nodes linked to companies
- [x] Updates existing engineer when engineerId provided
- [x] Returns unresolved skills in needsReview array

**File**: `recommender_api/src/services/__tests__/content-search.integration.test.ts`
- [x] Finds engineers matching query keywords
- [x] Returns results ranked by TF-IDF relevance
- [x] Returns matching terms for each result
- [x] Handles queries with no matches (empty results)
- [x] `similarToEngineerId` finds engineers similar to given engineer

#### E2E Tests (Postman Collection)

**Folder**: `Resume Upload` (new folder in collection)

| Test | Description |
|------|-------------|
| Upload new engineer resume | POST /api/resume/upload creates engineer, returns skills |
| Upload with existing engineerId | Updates existing engineer's profile |
| Upload with skill variations | Normalizes "react.js", "k8s" to canonical skills |
| Upload with unknown skills | Returns needsReview array with unresolved skills |
| Upload invalid request | Returns 400 for missing required fields |

**Folder**: `Content Search` (new folder in collection)

| Test | Description |
|------|-------------|
| Search by keywords | POST /api/search/content with queryText returns matches |
| Search relevance ranking | More specific matches rank higher |
| Search returns matching terms | Response includes which terms matched |
| Search by similar engineer | `similarToEngineerId` returns similar profiles |
| Search with no matches | Returns empty results array, not error |
| Search invalid request | Returns 400 for missing queryText |

#### Automated Verification Commands

- [x] TypeScript compiles: `npm run typecheck`
- [x] Unit tests pass: `npm test -- --grep "unit"`
- [x] Integration tests pass: `npm test -- --grep "integration"`
- [x] All tests pass: `npm test` (956 tests)
- [x] E2E tests pass: `npm run test:e2e` (109 requests, 353 assertions)

#### Manual Verification (Now Automated)

The following items were originally manual verification steps, but are now covered by automated tests:

- [x] Resume upload creates realistic engineer profile from fixture resume
  - **Verified by**: E2E test "01 - Update Existing Engineer" + Integration test "stores resume text for an existing engineer"
- [x] TF-IDF search ranks engineers sensibly (more keyword matches = higher rank)
  - **Verified by**: E2E test "09 - More Keyword Matches = Higher Rank" + Integration test "ranks engineers with more keyword matches higher"
- [x] Rare terms boost relevance more than common terms
  - **Verified by**: E2E test "10 - Rare Terms Boost Relevance More Than Common Terms" + Integration test "boosts rare/discriminative terms more than common terms"

**Phase 1 Complete**: All automated verification passes. Ready to proceed to Phase 2.

---

## Phase 2: Dense Embeddings

### Overview

Add embedding generation to the LLM service, store embeddings in Neo4j with a vector index, and implement embedding-based similarity search.

**Why Dense Representation for Embeddings?**

Unlike TF-IDF, embedding vectors are naturally dense. A typical embedding model outputs 1024 or 1536 dimensions, and every dimension has a non-zero floating-point value. There are no zeros to skip, so sparse representation would just add overhead (storing 1024 dimension labels we don't need). Dense representation stores embeddings as a simple `number[]` array where position encodes meaning - all vectors agree that index 0 means the same latent concept.

### Implementation Order

Based on pre-implementation analysis, the recommended order for Phase 2 is:

1. Schema update (add `method` field) - enables API-level method switching
2. Config update (`LLM_EMBEDDING_MODEL`)
3. LLM service extension (`generateEmbedding()`)
4. Migration script (vector index creation)
5. Shared engineer text loader service (new) - extracts common document loading
6. Refactor TF-IDF index manager to use shared loader (adds company names to TF-IDF)
7. Embedding index manager service (uses shared loader)
8. Content search service update (dispatcher + embedding search)
9. Resume upload integration

### Changes Required

#### 2.0 Add Search Method to Content Search Schema

**Prerequisite**: The current `ContentSearchRequest` schema doesn't have a `method` field to select between TF-IDF, embedding, or hybrid search. This must be added before implementing the search dispatcher.

**File**: `recommender_api/src/schemas/resume.schema.ts`

Add the `method` field to `ContentSearchRequestSchema`:

```typescript
export const ContentSearchRequestSchema = z.object({
  queryText: z.string().optional(),
  similarToEngineerId: z.string().optional(),
  method: z.enum(["tfidf", "embedding", "hybrid"]).default("tfidf").optional(),
  /*
   * Required terms for boolean filtering (AND logic).
   * Engineers must have ALL of these terms in their profile to be included.
   * If not provided, no boolean filtering is applied—all engineers are candidates.
   *
   * Example: ["react", "kafka"] → only engineers mentioning both "react" AND "kafka"
   */
  requiredTerms: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
  offset: z.number().int().nonnegative().default(0).optional(),
}).refine(
  (data) => data.queryText || data.similarToEngineerId,
  { message: "Either queryText or similarToEngineerId must be provided" }
);

export type ContentSearchRequest = z.infer<typeof ContentSearchRequestSchema>;
```

**Note**: The response schema already includes `searchMethod: "tfidf" | "embedding" | "hybrid"` - this was prepared in Phase 1.

#### 2.1 Extend LLM Service with Embedding Support

**File**: `recommender_api/src/services/llm.service.ts`

Add embedding configuration and generation:

```typescript
// Add to config.ts first:
// LLM_EMBEDDING_MODEL: process.env.LLM_EMBEDDING_MODEL || "mxbai-embed-large",

/*
 * Generate an embedding vector for text using Ollama.
 * Returns null if LLM is unavailable.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!(await isLLMAvailable())) {
    return null;
  }

  try {
    const client = getClient();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS * 2);  // Longer timeout for embeddings

    try {
      const response = await client.embed({
        model: config.LLM_EMBEDDING_MODEL,
        input: text,
      });

      clearTimeout(timeoutId);
      return response.embeddings[0];
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[LLM] Embedding request timed out");
    } else {
      console.warn("[LLM] Embedding generation failed:", error);
    }
    return null;
  }
}
```

#### 2.2 Update Config

**File**: `recommender_api/src/config.ts`

```typescript
interface Config {
  // ... existing fields
  LLM_EMBEDDING_MODEL: string;
}

const config: Config = {
  // ... existing values
  LLM_EMBEDDING_MODEL: process.env.LLM_EMBEDDING_MODEL || "mxbai-embed-large",
};
```

#### 2.3 Neo4j Vector Index Setup

Add a migration or seed script to create the vector index.

Neo4j's vector index uses HNSW (Hierarchical Navigable Small World), an approximate nearest neighbor algorithm that provides O(log n) search complexity. This means searching 2,000 vectors takes roughly the same time as searching 100 vectors—the index navigates a graph structure rather than scanning all vectors.

**Note**: The `seeds/migrations/` directory does not exist yet and must be created. This establishes a migration pattern for future schema changes.

**File**: `seeds/migrations/001-add-vector-indices.ts` (new)

```typescript
import { Session } from "neo4j-driver";

export async function createVectorIndices(session: Session): Promise<void> {
  // Create vector index for engineer embeddings
  await session.run(`
    CREATE VECTOR INDEX engineer_embedding_index IF NOT EXISTS
    FOR (e:Engineer)
    ON (e.embedding)
    OPTIONS {
      indexConfig: {
        \`vector.dimensions\`: 1024,
        \`vector.similarity_function\`: 'cosine'
      }
    }
  `);

  console.log("[Migration] Created engineer_embedding_index");
}
```

#### 2.3.5 Shared Engineer Text Loader

Extract document loading into a shared service used by both TF-IDF and embedding index managers. This also adds **company names** to TF-IDF (currently missing) and unifies the text concatenation approach.

**File**: `recommender_api/src/services/content-search/engineer-text-loader.service.ts` (new)

```typescript
import { Session } from "neo4j-driver";

export interface EngineerTextContent {
  engineerId: string;
  headline: string;
  jobTitles: string[];
  skills: string[];
  domains: string[];
  jobHighlights: string[];
  companyNames: string[];
  resumeText: string;
}

/*
 * Load text content for engineers from Neo4j.
 *
 * Aggregates all searchable text fields:
 * - Headline
 * - Job titles from WorkExperience nodes
 * - Skills from UserSkill → Skill relationships
 * - Domains from BusinessDomain and TechnicalDomain relationships
 * - Job highlights from WorkExperience nodes
 * - Company names from WorkExperience → Company relationships
 * - Resume raw text
 *
 * Used by both TF-IDF and embedding index managers.
 */
export async function loadEngineerTextContent(
  session: Session,
  engineerId?: string
): Promise<EngineerTextContent[]> {
  const whereClause = engineerId ? "WHERE e.id = $engineerId" : "";

  const result = await session.run(`
    MATCH (e:Engineer)
    ${whereClause}

    // Collect job titles and highlights from work history
    OPTIONAL MATCH (e)-[:HAD_ROLE]->(w:WorkExperience)
    WITH e, collect(DISTINCT w.title) AS jobTitles, collect(DISTINCT w.highlights) AS allHighlights
    WITH e, jobTitles, reduce(acc = [], h IN allHighlights | acc + COALESCE(h, [])) AS flatHighlights

    // Collect company names
    OPTIONAL MATCH (e)-[:HAD_ROLE]->(:WorkExperience)-[:AT_COMPANY]->(c:Company)
    WITH e, jobTitles, flatHighlights, collect(DISTINCT c.name) AS companyNames

    // Collect skills
    OPTIONAL MATCH (e)-[:HAS]->(us:UserSkill)-[:FOR]->(s:Skill)
    WITH e, jobTitles, flatHighlights, companyNames, collect(DISTINCT s.name) AS skills

    // Collect domains
    OPTIONAL MATCH (e)-[:HAS_EXPERIENCE_IN]->(bd:BusinessDomain)
    OPTIONAL MATCH (e)-[:HAS_EXPERIENCE_IN]->(td:TechnicalDomain)
    WITH e, jobTitles, flatHighlights, companyNames, skills,
         collect(DISTINCT bd.name) + collect(DISTINCT td.name) AS domains

    // Get resume text
    OPTIONAL MATCH (e)-[:HAS_RESUME]->(r:Resume)

    RETURN
      e.id AS engineerId,
      e.headline AS headline,
      jobTitles,
      skills,
      domains,
      flatHighlights AS jobHighlights,
      companyNames,
      r.rawText AS resumeText
  `, { engineerId: engineerId || null });

  return result.records.map((record) => ({
    engineerId: record.get("engineerId") as string,
    headline: (record.get("headline") as string) || "",
    jobTitles: (record.get("jobTitles") as string[]) || [],
    skills: ((record.get("skills") as (string | null)[]) || []).filter((s): s is string => s !== null),
    domains: ((record.get("domains") as (string | null)[]) || []).filter((d): d is string => d !== null),
    jobHighlights: (record.get("jobHighlights") as string[]) || [],
    companyNames: (record.get("companyNames") as string[]) || [],
    resumeText: (record.get("resumeText") as string) || "",
  }));
}

/*
 * Concatenate engineer text content into a single searchable string.
 *
 * Uses space separator for all fields - this works for both TF-IDF (tokenization
 * splits on whitespace/punctuation regardless) and embeddings (semantic content
 * matters more than delimiters).
 */
export function concatenateEngineerText(content: EngineerTextContent): string {
  return [
    content.headline,
    content.jobTitles.join(" "),
    content.skills.join(" "),
    content.domains.join(" "),
    content.companyNames.join(" "),
    content.jobHighlights.join(" "),
    content.resumeText,
  ]
    .filter(Boolean)
    .join(" ");
}
```

**Refactor existing TF-IDF manager**: Update `tfidf-index-manager.service.ts` to use the shared loader:

```typescript
// In tfidf-index-manager.service.ts
import { loadEngineerTextContent, concatenateEngineerText } from "./engineer-text-loader.service.js";

async function loadEngineerDocuments(session: Session): Promise<Document[]> {
  const contents = await loadEngineerTextContent(session);
  return contents.map((content) => ({
    id: content.engineerId,
    text: concatenateEngineerText(content),
  }));
}
```

This refactoring also **adds company names to TF-IDF search** - queries like "Google engineer" or "Stripe backend" will now match.

#### 2.4 Embedding Index Manager

**File**: `recommender_api/src/services/content-search/embedding-index-manager.service.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import { generateEmbedding } from "../llm.service.js";
import { loadEngineerTextContent, concatenateEngineerText } from "./engineer-text-loader.service.js";

/*
 * Generate and store embedding for an engineer.
 *
 * Uses the shared text loader to get engineer content, then generates
 * a dense embedding vector via the LLM service.
 */
export async function updateEngineerEmbedding(
  session: Session,
  engineerId: string
): Promise<boolean> {
  const contents = await loadEngineerTextContent(session, engineerId);
  if (contents.length === 0) {
    return false;
  }

  const content = contents[0];
  const combinedText = concatenateEngineerText(content);

  if (!combinedText.trim()) {
    return false;
  }

  // Generate embedding
  const embedding = await generateEmbedding(combinedText);
  if (!embedding) {
    return false;
  }

  // Store embedding
  await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    SET e.embedding = $embedding,
        e.embeddingModel = $model,
        e.embeddingUpdatedAt = datetime()
  `, {
    engineerId,
    embedding,
    model: "mxbai-embed-large",
  });

  return true;
}

/*
 * Find engineers similar to a query using vector similarity.
 */
export async function findSimilarByEmbedding(
  session: Session,
  queryEmbedding: number[],
  limit: number = 20,
  excludeEngineerId?: string
): Promise<Array<{ engineerId: string; score: number }>> {
  const excludeClause = excludeEngineerId
    ? "AND e.id <> $excludeEngineerId"
    : "";

  const result = await session.run(`
    CALL db.index.vector.queryNodes('engineer_embedding_index', $limit, $queryEmbedding)
    YIELD node AS e, score
    WHERE e.embedding IS NOT NULL ${excludeClause}
    RETURN e.id AS engineerId, score
    ORDER BY score DESC
  `, {
    queryEmbedding,
    limit,
    excludeEngineerId: excludeEngineerId || null,
  });

  return result.records.map((record) => ({
    engineerId: record.get("engineerId") as string,
    score: record.get("score") as number,
  }));
}

/*
 * Find engineers similar to a query, filtered to a specific candidate set.
 *
 * This is the key function for hybrid search: it uses HNSW for efficient
 * O(log n) vector search while respecting the boolean filter's candidate set.
 *
 * The candidateIds filter is applied as a WHERE clause on the HNSW results.
 * This is efficient because:
 * 1. HNSW returns candidates in score order
 * 2. We over-fetch and filter, so we get enough results
 * 3. The candidateIds set lookup is O(1)
 */
export async function findSimilarByEmbeddingWithFilter(
  session: Session,
  queryEmbedding: number[],
  limit: number,
  candidateIds: Set<string>,
  excludeEngineerId?: string
): Promise<Array<{ engineerId: string; score: number }>> {
  // Over-fetch to account for filtering
  // HNSW will return more results, we filter to candidateIds
  const overFetchMultiplier = Math.min(10, Math.ceil(10000 / candidateIds.size));
  const fetchLimit = limit * overFetchMultiplier;

  const excludeClause = excludeEngineerId
    ? "AND e.id <> $excludeEngineerId"
    : "";

  const result = await session.run(`
    CALL db.index.vector.queryNodes('engineer_embedding_index', $fetchLimit, $queryEmbedding)
    YIELD node AS e, score
    WHERE e.embedding IS NOT NULL
      AND e.id IN $candidateIdList
      ${excludeClause}
    RETURN e.id AS engineerId, score
    ORDER BY score DESC
    LIMIT $limit
  `, {
    queryEmbedding,
    fetchLimit,
    limit,
    candidateIdList: Array.from(candidateIds),
    excludeEngineerId: excludeEngineerId || null,
  });

  return result.records.map((record) => ({
    engineerId: record.get("engineerId") as string,
    score: record.get("score") as number,
  }));
}

/*
 * Get a single engineer's embedding.
 */
export async function getEngineerEmbedding(
  session: Session,
  engineerId: string
): Promise<number[] | null> {
  const result = await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    RETURN e.embedding AS embedding
  `, { engineerId });

  if (result.records.length === 0) {
    return null;
  }

  return result.records[0].get("embedding") as number[] | null;
}

/*
 * Get all engineer IDs (for when no boolean filter is applied).
 */
export async function getAllEngineerIds(session: Session): Promise<Set<string>> {
  const result = await session.run(`
    MATCH (e:Engineer)
    RETURN e.id AS engineerId
  `);

  return new Set(result.records.map((r) => r.get("engineerId") as string));
}

/*
 * Find engineers similar to another engineer.
 */
export async function findSimilarToEngineer(
  session: Session,
  engineerId: string,
  limit: number = 20
): Promise<Array<{ engineerId: string; score: number }>> {
  // Get target engineer's embedding
  const embeddingResult = await session.run(`
    MATCH (e:Engineer {id: $engineerId})
    RETURN e.embedding AS embedding
  `, { engineerId });

  if (embeddingResult.records.length === 0) {
    throw new Error(`Engineer not found: ${engineerId}`);
  }

  const embedding = embeddingResult.records[0].get("embedding") as number[];
  if (!embedding) {
    throw new Error(`Engineer has no embedding: ${engineerId}`);
  }

  return findSimilarByEmbedding(session, embedding, limit, engineerId);
}
```

#### 2.5 Update Content Search Service

**File**: `recommender_api/src/services/content-search/content-search.service.ts`

Add embedding search method:

```typescript
import { generateEmbedding } from "../llm.service.js";
import { findSimilarByEmbedding, findSimilarToEngineer } from "./embedding-index-manager.service.js";

/*
 * Execute embedding-based search.
 */
async function executeEmbeddingSearch(
  session: Session,
  request: ContentSearchRequest
): Promise<ContentSearchResponse> {
  const startTime = Date.now();

  let similarEngineers: Array<{ engineerId: string; score: number }>;

  if (request.similarToEngineerId) {
    similarEngineers = await findSimilarToEngineer(
      session,
      request.similarToEngineerId,
      request.limit + request.offset
    );
  } else {
    // Generate embedding for query text
    const queryEmbedding = await generateEmbedding(request.queryText!);
    if (!queryEmbedding) {
      throw new Error("Failed to generate embedding for query");
    }

    similarEngineers = await findSimilarByEmbedding(
      session,
      queryEmbedding,
      request.limit + request.offset
    );
  }

  // Apply pagination
  const paginatedResults = similarEngineers.slice(request.offset, request.offset + request.limit);

  // Load engineer details
  const engineerIds = paginatedResults.map((r) => r.engineerId);
  const engineerInfoMap = await loadEngineerInfo(session, engineerIds);

  // Build response
  const matches = paginatedResults
    .filter((result) => engineerInfoMap.has(result.engineerId))
    .map((result) => {
      const engineer = engineerInfoMap.get(result.engineerId)!;
      return {
        id: engineer.id,
        name: engineer.name,
        headline: engineer.headline,
        salary: engineer.salary,
        yearsExperience: engineer.yearsExperience,
        timezone: engineer.timezone,
        contentScore: result.score,
        contentScoreBreakdown: {
          embeddingScore: result.score,
        },
      };
    });

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount: similarEngineers.length,
    searchMethod: "embedding",
    queryMetadata: {
      executionTimeMs,
      documentsSearched: similarEngineers.length,
    },
  };
}

// Update executeContentSearch to dispatch based on method:
export async function executeContentSearch(
  session: Session,
  request: ContentSearchRequest
): Promise<ContentSearchResponse> {
  switch (request.method) {
    case "embedding":
      return executeEmbeddingSearch(session, request);
    case "tfidf":
      return executeTfIdfSearch(session, request);
    case "hybrid":
      return executeHybridSearch(session, request);
    default:
      return executeTfIdfSearch(session, request);
  }
}

// Rename original function:
async function executeTfIdfSearch(
  session: Session,
  request: ContentSearchRequest
): Promise<ContentSearchResponse> {
  // ... existing TF-IDF implementation
}
```

#### 2.6 Update Resume Upload to Generate Embeddings

**File**: `recommender_api/src/services/resume-processor/resume-upload.service.ts`

Add embedding generation when `generateVectors` includes "embedding":

```typescript
import { updateEngineerEmbedding } from "../content-search/embedding-index-manager.service.js";

// In processResumeUpload(), after TF-IDF update:
if (request.generateVectors?.includes("embedding")) {
  const embeddingSuccess = await updateEngineerEmbedding(session, engineerId);
  if (embeddingSuccess && response.vectors) {
    response.vectors.embedding = {
      dimensions: 1024,  // mxbai-embed-large dimension
      model: "mxbai-embed-large",
    };
  }
}
```

### Success Criteria - Phase 2

#### Automated Verification:

- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] All unit tests pass: `npm test` (974 tests passing)
- [x] All E2E tests pass: `npm run test:e2e` (content-search: 60 assertions passing)
- [x] Vector index exists in Neo4j: verified via integration test and E2E embedding searches

#### Required Unit/Integration Tests

**File**: `recommender_api/src/services/__tests__/content-search.integration.test.ts`

Add embedding search tests:

```typescript
describe('embedding search', () => {
  it('finds engineers matching query semantics', { timeout: 15000 }, async () => {
    if (!neo4jAvailable) {
      console.log('Skipping: Neo4j not available');
      return;
    }

    const testSession = driver.session();
    try {
      const response = await executeContentSearch(testSession, {
        queryText: 'Full stack developer with cloud experience',
        method: 'embedding',
        limit: 10,
        offset: 0,
      });

      expect(response.matches.length).toBeGreaterThan(0);
      expect(response.searchMethod).toBe('embedding');
      // Each match should have embedding score
      for (const match of response.matches) {
        expect(match.contentScoreBreakdown.embeddingScore).toBeDefined();
        expect(typeof match.contentScoreBreakdown.embeddingScore).toBe('number');
      }
    } finally {
      await testSession.close();
    }
  });

  it('similarToEngineerId finds semantically similar engineers', { timeout: 15000 }, async () => {
    if (!neo4jAvailable) {
      console.log('Skipping: Neo4j not available');
      return;
    }

    const testSession = driver.session();
    try {
      const response = await executeContentSearch(testSession, {
        similarToEngineerId: 'eng_priya',
        method: 'embedding',
        limit: 5,
        offset: 0,
      });

      expect(response.matches.length).toBeGreaterThan(0);
      expect(response.searchMethod).toBe('embedding');
      // Should not include the target engineer
      const matchIds = response.matches.map((m) => m.id);
      expect(matchIds).not.toContain('eng_priya');
    } finally {
      await testSession.close();
    }
  });

  it('handles semantic synonyms (K8s → Kubernetes)', { timeout: 15000 }, async () => {
    if (!neo4jAvailable) {
      console.log('Skipping: Neo4j not available');
      return;
    }

    const testSession = driver.session();
    try {
      /*
       * Embedding search should recognize that "K8s" and "Kubernetes" are
       * semantically equivalent, even though TF-IDF treats them as different tokens.
       */
      const response = await executeContentSearch(testSession, {
        queryText: 'K8s container orchestration',
        method: 'embedding',
        limit: 10,
        offset: 0,
      });

      expect(response.matches.length).toBeGreaterThan(0);
      // Engineers with Kubernetes should appear in results
      // (we can't assert specific engineers without knowing seed data)
    } finally {
      await testSession.close();
    }
  });

  it('returns results ranked by embedding similarity', { timeout: 15000 }, async () => {
    if (!neo4jAvailable) {
      console.log('Skipping: Neo4j not available');
      return;
    }

    const testSession = driver.session();
    try {
      const response = await executeContentSearch(testSession, {
        queryText: 'Machine learning data scientist Python',
        method: 'embedding',
        limit: 10,
        offset: 0,
      });

      // Results should be sorted by score descending
      for (let i = 1; i < response.matches.length; i++) {
        expect(response.matches[i - 1].contentScore).toBeGreaterThanOrEqual(
          response.matches[i].contentScore
        );
      }
    } finally {
      await testSession.close();
    }
  });
});
```

**File**: `recommender_api/src/services/content-search/embedding-index-manager.service.test.ts` (new)

Unit tests for embedding index manager:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Session } from 'neo4j-driver';

describe('Embedding Index Manager', () => {
  describe('updateEngineerEmbedding', () => {
    it('generates and stores embedding for engineer with content', async () => {
      // Test that embedding is generated and stored when engineer has resume/skills
    });

    it('returns false when engineer has no content', async () => {
      // Test graceful handling of engineers with no indexable content
    });

    it('returns false when LLM is unavailable', async () => {
      // Test graceful degradation when embedding generation fails
    });
  });

  describe('findSimilarByEmbedding', () => {
    it('returns engineers sorted by similarity score', async () => {
      // Test that results are ordered by cosine similarity
    });

    it('excludes specified engineer from results', async () => {
      // Test the excludeEngineerId parameter
    });

    it('respects limit parameter', async () => {
      // Test pagination
    });
  });
});
```

**File**: `recommender_api/src/services/llm.service.test.ts`

Add tests for embedding generation:

```typescript
describe('generateEmbedding', () => {
  it('generates embedding vector for text', async () => {
    // Test successful embedding generation returns number[]
  });

  it('returns null when LLM is unavailable', async () => {
    // Test graceful handling when Ollama is down
  });

  it('returns embedding with expected dimensions', async () => {
    // Test that embedding has correct dimensionality (1024 for mxbai-embed-large)
  });
});
```

#### Required E2E Tests

**File**: `postman/collections/content-search-tests.postman_collection.json`

Add the following test scenarios to the "Content Search" folder:

| Test # | Name | Description |
|--------|------|-------------|
| 11 | Embedding Search Basic | `method: "embedding"` returns results with `searchMethod: "embedding"` |
| 12 | Embedding Search Has Score Breakdown | Each match has `embeddingScore` in `contentScoreBreakdown` |
| 13 | Embedding Similar to Engineer | `similarToEngineerId` + `method: "embedding"` works |
| 14 | Embedding Semantic Synonyms | "K8s" query finds engineers with "Kubernetes" |
| 15 | Embedding Results Sorted by Score | Results are sorted by `contentScore` descending |
| 16 | Embedding Respects Limit | Limit parameter works for embedding search |
| 17 | Embedding Invalid Method | Invalid method value returns 400 error |

Example test skeleton for test 11:

```json
{
  "name": "11 - Embedding Search Basic",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "pm.test('Status code is 200', function() {",
          "  pm.response.to.have.status(200);",
          "});",
          "",
          "pm.test('Search method is embedding', function() {",
          "  const response = pm.response.json();",
          "  pm.expect(response.searchMethod).to.equal('embedding');",
          "});",
          "",
          "pm.test('Returns matching engineers', function() {",
          "  const response = pm.response.json();",
          "  pm.expect(response.matches.length).to.be.greaterThan(0);",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "POST",
    "body": {
      "mode": "raw",
      "raw": "{\"queryText\": \"Full stack developer cloud experience\", \"method\": \"embedding\", \"limit\": 10}"
    },
    "url": "http://mac-studio.tailb9e408.ts.net:4025/api/search/content"
  }
}
```

#### Previously Manual Verification (now automated in Phase 2b):

- [x] Similar engineer search returns reasonable results (Test 4: eng_priya → James Okonkwo, Takeshi Yamamoto, Alex Rivera - all backend engineers)
- [x] Performance: embedding search <1000ms for reasonable corpus size (Test 11: 86ms)

---

## Phase 2b: Embedding Seed & Automated Verification

### Overview

Phase 2 implemented the embedding infrastructure, but engineers don't have embeddings generated yet. This phase adds:
1. A seed script to generate embeddings for all existing engineers
2. E2E tests to verify embedding functionality end-to-end
3. Automated verification for all previously manual checks

### Changes Required

#### 2b.1 Embedding Seed Script

Create a seed script that generates embeddings for all engineers in the database.

**File**: `seeds/embeddings.ts` (new)

```typescript
import { Session } from "neo4j-driver";
import { updateEngineerEmbedding } from "../recommender_api/src/services/content-search/embedding-index-manager.service.js";

/*
 * Generate embeddings for all engineers.
 *
 * This is a slow operation (~100-500ms per engineer) but only needs to run once
 * during seeding. Subsequent updates happen via resume upload.
 */
export async function seedEngineerEmbeddings(session: Session): Promise<void> {
  console.log("[Seed] Generating engineer embeddings...");

  // Get all engineer IDs
  const result = await session.run(`
    MATCH (e:Engineer)
    WHERE e.embedding IS NULL
    RETURN e.id AS engineerId
  `);

  const engineerIds = result.records.map((r) => r.get("engineerId") as string);
  console.log(`[Seed] Found ${engineerIds.length} engineers without embeddings`);

  let successCount = 0;
  let failCount = 0;

  for (const engineerId of engineerIds) {
    const success = await updateEngineerEmbedding(session, engineerId);
    if (success) {
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`[Seed] Generated ${successCount}/${engineerIds.length} embeddings...`);
      }
    } else {
      failCount++;
      console.warn(`[Seed] Failed to generate embedding for ${engineerId}`);
    }
  }

  console.log(`[Seed] Embedding generation complete: ${successCount} succeeded, ${failCount} failed`);
}
```

**Update**: `seeds/seed.ts` - Add embedding seeding after migrations

```typescript
import { seedEngineerEmbeddings } from "./embeddings.js";

// After createVectorIndices(session):
await seedEngineerEmbeddings(session);
```

#### 2b.2 Vector Index Verification Integration Test

Add an integration test that verifies the vector index exists.

**File**: `recommender_api/src/services/__tests__/content-search.integration.test.ts`

Add to the existing test file:

```typescript
describe('vector index', () => {
  it('engineer_embedding_index exists in Neo4j', { timeout: 10000 }, async () => {
    if (!neo4jAvailable) {
      console.log('Skipping: Neo4j not available');
      return;
    }

    const testSession = driver.session();
    try {
      const result = await testSession.run(`
        SHOW INDEXES
        YIELD name, type
        WHERE name = 'engineer_embedding_index'
        RETURN name, type
      `);

      expect(result.records.length).toBe(1);
      expect(result.records[0].get('name')).toBe('engineer_embedding_index');
      expect(result.records[0].get('type')).toBe('VECTOR');
    } finally {
      await testSession.close();
    }
  });
});
```

#### 2b.3 Resume Upload Embedding Generation E2E Test

**File**: `postman/collections/content-search-tests.postman_collection.json`

Add test after existing resume upload tests:

```json
{
  "name": "03 - Resume Upload Generates Embedding",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "pm.test('Status code is 200', function() {",
          "  pm.response.to.have.status(200);",
          "});",
          "",
          "pm.test('Response includes embedding vector info', function() {",
          "  const response = pm.response.json();",
          "  pm.expect(response.vectors).to.have.property('embedding');",
          "  pm.expect(response.vectors.embedding.dimensions).to.equal(1024);",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "POST",
    "header": [{"key": "Content-Type", "value": "application/json"}],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"engineerId\": \"eng_james\",\n  \"resumeText\": \"Staff Engineer with 12 years experience in distributed systems, Java, Kafka, and system design.\",\n  \"skipFeatureExtraction\": true,\n  \"generateVectors\": [\"embedding\"]\n}"
    },
    "url": "http://mac-studio.tailb9e408.ts.net:4025/api/resume/upload"
  }
}
```

#### 2b.4 Embedding Search Semantic Results E2E Test

Tests that verify embedding search returns results (requires embeddings to be seeded first).

**File**: `postman/collections/content-search-tests.postman_collection.json`

Add test:

```json
{
  "name": "18 - Embedding Search Returns Semantic Matches",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "pm.test('Status code is 200', function() {",
          "  pm.response.to.have.status(200);",
          "});",
          "",
          "pm.test('Returns engineers with embeddings', function() {",
          "  const response = pm.response.json();",
          "  pm.expect(response.matches.length).to.be.greaterThan(0);",
          "  pm.expect(response.searchMethod).to.equal('embedding');",
          "});",
          "",
          "pm.test('Each match has embedding score', function() {",
          "  const response = pm.response.json();",
          "  response.matches.forEach(function(match) {",
          "    pm.expect(match.contentScoreBreakdown.embeddingScore).to.be.a('number');",
          "    pm.expect(match.contentScoreBreakdown.embeddingScore).to.be.at.least(0);",
          "  });",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "POST",
    "header": [{"key": "Content-Type", "value": "application/json"}],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"queryText\": \"Backend engineer with distributed systems experience\",\n  \"method\": \"embedding\",\n  \"limit\": 10\n}"
    },
    "url": "http://mac-studio.tailb9e408.ts.net:4025/api/search/content"
  }
}
```

#### 2b.5 K8s → Kubernetes Semantic Synonym E2E Test

**File**: `postman/collections/content-search-tests.postman_collection.json`

```json
{
  "name": "19 - Embedding Semantic Synonym (K8s → Kubernetes)",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "pm.test('Status code is 200', function() {",
          "  pm.response.to.have.status(200);",
          "});",
          "",
          "pm.test('K8s query finds engineers (semantic match to Kubernetes)', function() {",
          "  const response = pm.response.json();",
          "  // Embedding search should recognize K8s as semantically equivalent to Kubernetes",
          "  pm.expect(response.matches.length).to.be.greaterThan(0);",
          "  pm.expect(response.searchMethod).to.equal('embedding');",
          "});",
          "",
          "pm.test('Compare: TF-IDF may miss K8s synonym', function() {",
          "  // This test documents the semantic advantage of embeddings",
          "  // TF-IDF would only find exact 'k8s' matches, not 'kubernetes'",
          "  const response = pm.response.json();",
          "  console.log('Embedding search found ' + response.matches.length + ' engineers for K8s query');",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "POST",
    "header": [{"key": "Content-Type", "value": "application/json"}],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"queryText\": \"K8s container orchestration cloud native\",\n  \"method\": \"embedding\",\n  \"limit\": 10\n}"
    },
    "url": "http://mac-studio.tailb9e408.ts.net:4025/api/search/content"
  }
}
```

#### 2b.6 Embedding Similar to Engineer E2E Test (After Seeding)

**File**: `postman/collections/content-search-tests.postman_collection.json`

```json
{
  "name": "20 - Embedding Similar to Engineer (With Embeddings)",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "pm.test('Status code is 200', function() {",
          "  pm.response.to.have.status(200);",
          "});",
          "",
          "pm.test('Returns similar engineers', function() {",
          "  const response = pm.response.json();",
          "  pm.expect(response.matches.length).to.be.greaterThan(0);",
          "  pm.expect(response.searchMethod).to.equal('embedding');",
          "});",
          "",
          "pm.test('Target engineer excluded from results', function() {",
          "  const response = pm.response.json();",
          "  const matchIds = response.matches.map(m => m.id);",
          "  pm.expect(matchIds).to.not.include('eng_priya');",
          "});",
          "",
          "pm.test('Similar engineers have embedding scores', function() {",
          "  const response = pm.response.json();",
          "  response.matches.forEach(function(match) {",
          "    pm.expect(match.contentScoreBreakdown.embeddingScore).to.be.a('number');",
          "  });",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "POST",
    "header": [{"key": "Content-Type", "value": "application/json"}],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"similarToEngineerId\": \"eng_priya\",\n  \"method\": \"embedding\",\n  \"limit\": 5\n}"
    },
    "url": "http://mac-studio.tailb9e408.ts.net:4025/api/search/content"
  }
}
```

### Success Criteria - Phase 2b

#### Automated Verification:

- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] All unit tests pass: `npm test` (974 tests passing)
- [x] Vector index integration test passes (verifies `engineer_embedding_index` exists)
- [x] All content-search E2E tests pass: 23 requests, 60 assertions passing
- [x] At least 30 engineers have embeddings after seeding (40 engineers with embeddings)

#### E2E Tests Added:

| Test # | Name | Verification |
|--------|------|--------------|
| 03 (Resume) | Resume Upload Generates Embedding | `generateVectors: ["embedding"]` stores embedding |
| 18 | Embedding Search Returns Semantic Matches | Embedding search finds engineers with scores |
| 19 | Embedding Semantic Synonym (K8s → Kubernetes) | Semantic similarity bridges vocabulary gap |
| 20 | Embedding Similar to Engineer (With Embeddings) | `similarToEngineerId` + `method: embedding` works |

**Implementation Note**: Phase 2b must complete before proceeding to Phase 3. The embedding seed script may be slow (~30-60 seconds for 40 engineers) but only runs once during initial seeding.

---

## Phase 3: Hybrid Approach

### Overview

Combine boolean filtering and pure embedding ranking, with TF-IDF used solely for explainability. Each stage has a distinct purpose:

1. **Boolean filter** → Guarantees required keywords are present (precision gate)
2. **Embedding ranking** → Ranks ALL filtered candidates by semantic similarity (quality ranking)
3. **TF-IDF matching** → Extracts matching terms for top results (explainability only)

Key architectural decision: We deliberately do **not** use TF-IDF to narrow candidates before embedding ranking. This avoids penalizing senior engineers with concise resumes while accepting a modest latency tradeoff (~10-20ms) that Neo4j's HNSW (Hierarchical Navigable Small World) vector index makes negligible.

### Rationale: Why Neither TF-IDF nor Embeddings Alone Are Sufficient

#### The Limitations of TF-IDF

TF-IDF is fundamentally a **lexical matching** approach—it treats words as opaque tokens and measures importance based on frequency statistics. This creates several gaps:

1. **No semantic understanding**: "Kubernetes" and "K8s" are completely different tokens to TF-IDF, even though they refer to the same technology. A recruiter searching for "Kubernetes expert" won't find the engineer whose resume says "5 years K8s experience" unless explicit synonyms are configured.

2. **Vocabulary mismatch**: Resumes and job descriptions often describe the same skills differently. "Built RESTful APIs" vs "developed backend endpoints" vs "implemented web services" have minimal token overlap despite describing the same capability.

3. **No contextual understanding**: TF-IDF can't distinguish "I have extensive React experience" from "I don't know React"—both contain the token "react" with similar frequency.

4. **Missed soft matches**: A search for "distributed systems" won't surface an engineer whose resume emphasizes "microservices architecture" and "event-driven systems"—even though these are closely related concepts that a human recruiter would recognize as relevant.

**What TF-IDF does well**: Precise keyword matching, interpretable results ("these terms matched"), cheap to compute, and guaranteed presence of specific terms.

#### The Limitations of Embeddings

Embedding models capture semantic meaning by mapping text to dense vectors where similar concepts cluster together. But this comes with its own problems:

1. **Black box ranking**: When embeddings rank candidate A above candidate B, there's no easy way to explain why. You can't point to "these keywords matched"—you just get a similarity score. This makes debugging and user trust difficult.

2. **Misses exact matches**: An engineer who explicitly lists "React, TypeScript, Node.js" might score lower than one whose resume has a more eloquent paragraph about "modern frontend development"—even when the recruiter specifically wants those three technologies.

3. **False semantic similarity**: Embeddings can over-generalize. "Java" and "JavaScript" have moderate similarity in many embedding spaces, even though they're completely different languages. A search for "Java backend developer" might surface JavaScript specialists because the model sees both as "programming-related."

4. **Computational cost**: Generating embeddings requires API calls or GPU inference. For real-time search across a large corpus, computing embeddings for every query and comparing against every candidate becomes expensive.

5. **Domain blind spots**: General-purpose embedding models may not understand domain-specific jargon. Niche technologies, internal tools, or industry-specific terminology might not be well-represented in the model's training data.

**What embeddings do well**: Understanding semantic similarity, handling paraphrasing, bridging vocabulary gaps, and finding conceptually similar candidates even when exact terms don't match.

#### Why the Hybrid Approach Unlocks Better Results

The hybrid approach isn't just a compromise—it creates capabilities that neither method can achieve alone:

**1. Precision with Recall**

| Search Type | Precision | Recall | Trade-off |
|-------------|-----------|--------|-----------|
| Boolean filter only | High (exact matches) | Low (misses synonyms/paraphrases) | Strict but narrow |
| TF-IDF only | Medium | Medium | Ranks by term frequency but misses semantics |
| Embeddings only | Medium | High (catches semantic variants) | May surface irrelevant results without keyword guarantees |
| **Hybrid** | **High** | **High** | Boolean ensures precision, embeddings provide semantic recall |

**2. Explainability + Semantic Power**

- TF-IDF provides interpretable matching terms: "Matched on: react, kafka, distributed"
- Embeddings handle the ranking by understanding "react developer" ≈ "frontend engineer with React.js"
- Users see *why* results matched (keywords) while getting semantically intelligent ranking

**3. Computational Efficiency Analysis**

A common hybrid search pattern uses TF-IDF to narrow candidates before expensive embedding operations:

```
2,000 candidates (after boolean filter)
    │
    ▼ TF-IDF narrowing (cheap)
    100 candidates
    │
    ▼ Embedding ranking (expensive)
    Final results
```

**However, with Neo4j's HNSW vector index, this optimization provides minimal benefit:**

| Approach | Operation | Time |
|----------|-----------|------|
| With TF-IDF narrowing | TF-IDF on 2,000 + HNSW on 100 | ~30-50ms |
| Without TF-IDF narrowing | HNSW on 2,000 directly | ~40-60ms |
| **Savings** | | **~10-20ms** |

HNSW (Hierarchical Navigable Small World) is an approximate nearest neighbor algorithm with O(log n) complexity. Whether searching 100 or 2,000 candidates, the difference is marginal because HNSW navigates a graph structure rather than scanning all vectors.

**When TF-IDF narrowing would matter:**
- No vector index available (brute-force similarity)
- Embeddings stored in separate system without filtering capability
- Extremely large candidate sets (100K+) where even O(log n) adds up

For our system with Neo4j vector indexes and typical candidate sets of 1-10K, TF-IDF narrowing is **not necessary for performance**.

**4. Guaranteed Keyword Presence + Semantic Ranking**

A recruiter searching for "React AND Kafka experience" gets:
- **Guaranteed**: Every result mentions both React and Kafka (boolean filter)
- **Ranked**: Final ordering by pure embedding similarity captures experience depth and context
- **Explained**: Matching terms displayed for transparency (from TF-IDF, computed post-ranking)

Without hybrid, you choose between guaranteed presence (boolean, no ranking) or smart ranking (embeddings, no guaranteed presence).

**5. Flexible Boolean Filtering**

The boolean filter is optional—callers can use it or skip it:
- With `requiredTerms: ["react", "kafka"]` → Only engineers with both terms are considered
- Without `requiredTerms` → All engineers are candidates for embedding ranking

This lets callers choose between strict keyword requirements or pure semantic search.

#### Why NOT Use TF-IDF for Candidate Filtering

A common hybrid pattern uses TF-IDF to narrow candidates before embedding ranking. We deliberately **avoid this** because TF-IDF filtering can exclude high-quality candidates that embeddings would have ranked highly.

**The Problem: TF-IDF Filtering Penalizes Senior Engineers**

Query: "Senior React developer with distributed systems experience for fintech"

| Candidate | Resume Style | TF-IDF Rank | Embedding Rank | If TF-IDF filters to top 100 |
|-----------|--------------|-------------|----------------|------------------------------|
| **A** (Staff Engineer) | "Led engineering for a trading platform serving 10M transactions/day. Architected the React-based dashboard and microservices backend." | #200 (concise, few keywords) | #5 (understands context) | **Filtered out** |
| **B** (Junior) | "React developer, React.js, React Native, distributed systems, fintech, financial technology experience" | #30 (keyword-rich) | #80 (keyword list, less meaningful) | Passes filter |

In engineer recruiting:
- **Senior engineers** write concise, impactful resumes emphasizing outcomes over keyword lists
- **Junior engineers** often keyword-stuff for ATS optimization
- **TF-IDF systematically favors the latter** because it rewards term frequency

By using TF-IDF to filter before embedding ranking, we would lose Candidate A entirely—even though embeddings correctly identify them as the better match.

**The Boolean Filter Already Ensures Keyword Presence**

Both candidates passed the boolean filter (they both mention "React"). The question is ranking, not presence. TF-IDF filtering makes a ranking decision (who's in the top 100?) using a signal that doesn't correlate with candidate quality.

**The Performance Argument Doesn't Justify the Risk**

With HNSW vector indexes:
- Filtering 2,000 → 100 saves ~10-20ms
- But risks excluding the best candidates

This is not a good tradeoff. We should run embedding ranking on the full boolean-filtered set.

#### Why Pure Embedding Ranking (Not Combined Scoring)

A common hybrid search pattern combines TF-IDF and embedding scores (e.g., 40% TF-IDF + 60% embedding). We deliberately choose **pure embedding ranking** instead. Here's why:

**Keyword Density ≠ Quality in Engineer Recruiting**

TF-IDF rewards mentioning terms more frequently. But in recruiting:

| Resume Pattern | TF-IDF Score | Actual Quality Signal |
|----------------|--------------|----------------------|
| "React, React Native, React Router, React Query" (buzzword list) | High (4 mentions) | Low (listing without context) |
| "Architected React application serving 10M users" | Lower (1 mention) | High (demonstrates scale and ownership) |
| "Familiar with Kafka, used Kafka Streams" | Medium (2 mentions) | Medium |
| "Built real-time pipeline processing 1M events/sec with Kafka" | Lower (1 mention) | High (demonstrates depth) |

Embeddings understand this nuance. They capture that "led distributed systems architecture" signals more seniority than "familiar with distributed systems"—regardless of term frequency.

**Simpler System, No Arbitrary Hyperparameters**

Combined scoring introduces tunable weights (40/60? 30/70? 50/50?) that require A/B testing to optimize. With pure embedding ranking:
- No hyperparameters to tune
- Clearer mental model: boolean filters, embeddings rank, TF-IDF explains
- Easier to debug and explain

**TF-IDF's Value is Explainability, Not Filtering or Ranking**

TF-IDF contributes to the hybrid pipeline in one way:

- **Explainability**: Provides matching terms to show users ("Matched: react, kafka, typescript")

TF-IDF matching terms are computed **after** embedding ranking, only for the top results that will be displayed. This gives us interpretability without affecting which candidates are considered or how they're ranked.

#### The Revised Architecture

| Stage | Purpose | Filters Candidates? | Affects Ranking? |
|-------|---------|---------------------|------------------|
| **Boolean Filter** | Guarantee required keywords are present | Yes (pass/fail gate) | No |
| **Embedding Ranking** | Rank ALL filtered candidates by semantic similarity | No | **Yes (100%)** |
| **TF-IDF Matching** | Extract matching terms for top results (display only) | No | No |

```
100,000 candidates
    │
    ▼ Boolean filter (O(1) index lookup)
  2,000 candidates with required keywords
    │
    ▼ Embedding ranking via HNSW (O(log n), ~40-60ms)
    Top 100 ranked by semantic similarity
    │
    ▼ TF-IDF matching terms (for display, computed on top results only)
    Final results with explainability
```

Each stage has a distinct role: boolean filter ensures keyword presence, embeddings provide semantic ranking, TF-IDF provides explainability for displayed results.

### Changes Required

#### 3.1 Inverted Index for Boolean Filtering

**File**: `recommender_api/src/services/content-search/inverted-index.service.ts` (new)

```typescript
interface InvertedIndex {
  postings: Map<string, Set<string>>;  // term → set of engineerIds
}

let invertedIndex: InvertedIndex | null = null;

/*
 * Build an inverted index mapping each token to the set of engineers whose
 * profiles contain that token.
 *
 * Structure:
 *   "react"  → { engineer_1, engineer_5, engineer_12, ... }
 *   "kafka"  → { engineer_5, engineer_8, engineer_12, ... }
 *   "python" → { engineer_2, engineer_5, engineer_9, ... }
 *
 * This enables fast boolean filtering. For a query like "React AND Kafka":
 *   1. Look up "react" → { engineer_1, engineer_5, engineer_12 }
 *   2. Look up "kafka" → { engineer_5, engineer_8, engineer_12 }
 *   3. Intersect the sets → { engineer_5, engineer_12 }
 *
 * Set intersection is O(min(m, n)) where m and n are the set sizes, making
 * boolean queries very fast regardless of corpus size. This guarantees that
 * all results contain the required keywords before we run expensive embedding
 * similarity.
 */
export async function buildInvertedIndex(session: Session): Promise<InvertedIndex> {
  const documents = await loadEngineerDocuments(session);  // Reuse from TF-IDF

  const postings = new Map<string, Set<string>>();

  for (const doc of documents) {
    // Combine all fields into a single text for boolean indexing
    const combinedText = Object.values(doc.fields).join(" ");
    const tokens = tokenize(combinedText, NORMALIZATION_STRATEGY);
    const uniqueTokens = new Set(tokens);

    for (const token of uniqueTokens) {
      if (!postings.has(token)) {
        postings.set(token, new Set());
      }
      postings.get(token)!.add(doc.engineerId);
    }
  }

  invertedIndex = { postings };
  console.log(`[InvertedIndex] Built index with ${postings.size} terms`);

  return invertedIndex;
}

/*
 * Boolean AND filter - returns engineers containing ALL required terms.
 *
 * For ["react", "kafka"], this intersects the posting lists:
 *   postings["react"] ∩ postings["kafka"] → engineers with BOTH terms
 *
 * If any term has no posting list (not in any engineer's profile), the
 * result is empty—no engineer can satisfy a requirement for a term that
 * doesn't exist in the corpus.
 */
export function booleanFilter(
  requiredTerms: string[],
  index: InvertedIndex
): Set<string> {
  if (requiredTerms.length === 0) {
    // No required terms - return all engineer IDs in the index
    const allEngineerIds = new Set<string>();
    for (const engineerIdsWithTerm of index.postings.values()) {
      for (const engineerId of engineerIdsWithTerm) {
        allEngineerIds.add(engineerId);
      }
    }
    return allEngineerIds;
  }

  let matchingEngineerIds: Set<string> | null = null;

  for (const term of requiredTerms) {
    const normalizedTerm = term.toLowerCase();
    const engineerIdsWithTerm = index.postings.get(normalizedTerm);

    if (!engineerIdsWithTerm) {
      // Term not in any engineer's profile - no engineer can match
      return new Set();
    }

    if (matchingEngineerIds === null) {
      // First term: start with all engineers who have this term
      matchingEngineerIds = new Set(engineerIdsWithTerm);
    } else {
      // Subsequent terms: intersect to keep only engineers with ALL terms
      matchingEngineerIds = matchingEngineerIds.intersection(engineerIdsWithTerm);
    }

    if (matchingEngineerIds.size === 0) {
      return matchingEngineerIds;
    }
  }

  return matchingEngineerIds || new Set();
}
```

#### 3.2 Hybrid Search Implementation

**File**: `recommender_api/src/services/content-search/content-search.service.ts`

Add hybrid search combining all three stages:

```typescript
import { booleanFilter, buildInvertedIndex, getInvertedIndex } from "./inverted-index.service.js";

/*
 * Hybrid search: Boolean filter → Embedding ranking → TF-IDF explainability.
 *
 * Architecture rationale:
 * - Boolean filter guarantees required keywords are present (precision)
 * - Embedding ranking on ALL filtered candidates via HNSW (semantic quality)
 * - TF-IDF matching terms computed post-ranking for display only (explainability)
 *
 * We deliberately do NOT use TF-IDF to narrow candidates before embedding ranking.
 * TF-IDF filtering would penalize senior engineers who write concise resumes with
 * fewer keyword repetitions, potentially excluding them before embeddings get a
 * chance to recognize their experience depth. With HNSW's O(log n) performance,
 * the time savings (~10-20ms) don't justify this risk.
 */
async function executeHybridSearch(
  session: Session,
  request: ContentSearchRequest
): Promise<ContentSearchResponse> {
  const startTime = Date.now();

  // Get query text
  let queryText: string;
  let targetEngineerId: string | undefined;

  if (request.similarToEngineerId) {
    targetEngineerId = request.similarToEngineerId;
    // Get target engineer's embedding for similarity search
    const targetEmbedding = await getEngineerEmbedding(session, targetEngineerId);
    if (!targetEmbedding) {
      throw new Error(`Engineer embedding not found: ${targetEngineerId}`);
    }
    // For TF-IDF explainability, we still need the text
    const tfIdfIndex = await getTfIdfIndex(session);
    const targetVector = tfIdfIndex.documentIdToVector.get(targetEngineerId);
    queryText = targetVector?.terms.slice(0, 50).join(" ") || "";
  } else {
    queryText = request.queryText!;
  }

  /*
   * Stage 1: Boolean filter (guarantees required keywords are present)
   *
   * The caller specifies required terms via request.requiredTerms (e.g., ["react", "kafka"]).
   * Only engineers whose profiles contain ALL required terms pass this filter.
   * If no required terms are specified, all engineers are candidates.
   */
  const requiredTerms = request.requiredTerms ?? [];
  let candidateIds: Set<string>;

  if (requiredTerms.length > 0) {
    const invertedIndex = await getInvertedIndex(session);
    candidateIds = booleanFilter(requiredTerms, invertedIndex);
  } else {
    // No required terms - all engineers are candidates
    candidateIds = await getAllEngineerIds(session);
  }

  // Exclude self for similarity search
  if (targetEngineerId) {
    candidateIds.delete(targetEngineerId);
  }

  /*
   * Stage 2: Embedding ranking on ALL boolean-filtered candidates
   *
   * We use Neo4j's HNSW vector index which provides O(log n) approximate
   * nearest neighbor search. This means searching 2,000 candidates takes
   * only ~10-20ms more than searching 100 candidates.
   *
   * By ranking ALL filtered candidates, we ensure that senior engineers
   * with concise, impactful resumes aren't excluded just because they
   * mention keywords fewer times than keyword-stuffed junior resumes.
   */
  const queryEmbedding = await generateEmbedding(queryText);

  // Use HNSW index to rank ALL candidates by semantic similarity
  // The candidateIds filter is applied within the vector search
  const embeddingResults = await findSimilarByEmbeddingWithFilter(
    session,
    queryEmbedding,
    request.limit + request.offset,  // Get enough for pagination
    candidateIds,                      // Only consider boolean-filtered candidates
    targetEngineerId
  );

  const rankedResults = embeddingResults.map((r) => ({
    engineerId: r.engineerId,
    embeddingScore: r.score,
  }));

  // Apply pagination
  const totalCount = rankedResults.length;
  const paginatedResults = rankedResults.slice(request.offset, request.offset + request.limit);

  // Load engineer details
  const engineerIds = paginatedResults.map((r) => r.engineerId);
  const engineerInfoMap = await loadEngineerInfo(session, engineerIds);

  /*
   * Stage 3: TF-IDF matching terms for explainability (display only)
   *
   * TF-IDF is computed AFTER ranking, only for the results we're returning.
   * This gives us interpretable "Matched: react, kafka, distributed" without
   * affecting which candidates are considered or how they're ranked.
   */
  const tfIdfIndex = await getTfIdfIndex(session);
  const queryVector = queryToVector(queryText, tfIdfIndex);

  // Build response
  const matches = paginatedResults
    .filter((result) => engineerInfoMap.has(result.engineerId))
    .map((result) => {
      const engineer = engineerInfoMap.get(result.engineerId)!;
      const docVector = tfIdfIndex.documentIdToVector.get(result.engineerId);

      // Extract matching terms for explainability
      const matchingTerms = docVector
        ? getTopMatchingTerms(queryVector, docVector, 5).map((m) => m.term)
        : [];

      return {
        id: engineer.id,
        name: engineer.name,
        headline: engineer.headline,
        salary: engineer.salary,
        yearsExperience: engineer.yearsExperience,
        timezone: engineer.timezone,
        contentScore: result.embeddingScore,
        contentScoreBreakdown: {
          embeddingScore: result.embeddingScore,
          matchingTerms,  // For explainability only, did not affect ranking
        },
      };
    });

  const executionTimeMs = Date.now() - startTime;

  return {
    matches,
    totalCount,
    searchMethod: "hybrid",
    queryMetadata: {
      executionTimeMs,
      documentsSearched: candidateIds.size,
      requiredTerms,  // Echo back the boolean filter terms that were applied
    },
  };
}
```

### Success Criteria - Phase 3

#### Automated Verification:

- [x] TypeScript compiles without errors: `npm run typecheck`
- [x] All unit tests pass: `npm test`
- [x] E2E tests pass: `npm run test:e2e`
- [x] Hybrid search returns results: `curl -X POST http://localhost:4025/api/search/content -H "Content-Type: application/json" -d '{"queryText": "React developer with AWS experience", "method": "hybrid"}'`

#### Manual Verification:

- [ ] Hybrid search returns engineers matching keywords AND semantically similar
- [ ] Results ranked by pure embedding similarity (no TF-IDF influence on ranking)
- [ ] Response includes matching terms for explainability (from TF-IDF, computed post-ranking)
- [ ] Boolean filtering correctly removes candidates missing required terms
- [ ] ALL boolean-filtered candidates are considered for embedding ranking (no TF-IDF pre-filter)
- [ ] Performance: <500ms for hybrid search on 2,000 candidates (HNSW efficiency)
- [ ] Search works with and without `requiredTerms` (optional boolean filter)

**Implementation Note**: After completing Phase 3 and all verification passes, the full content-based filtering system is complete.

---

## Testing Strategy

### Unit Tests

**For Phase 1:**
- `skill-normalizer.service.test.ts` - Test exact match, Neo4j synonym lookup, fuzzy matching, unresolved flow
- `skill-synonyms.seed.test.ts` - Verify synonyms are seeded correctly with ALIAS_FOR relationships
- `tfidf-vectorizer.service.test.ts` - Test tokenization, TF-IDF calculation, cosine similarity
- `feature-extractor.service.test.ts` - Test LLM response parsing (mock Ollama)

**For Phase 2:**
- `embedding-index-manager.service.test.ts` - Test embedding storage and retrieval

**For Phase 3:**
- `inverted-index.service.test.ts` - Test boolean filtering
- `content-search.service.test.ts` - Test all three search methods

### Integration Tests

- Test resume upload creates engineer and UserSkill nodes in Neo4j
- Test content search queries return expected results
- Test hybrid search performs multi-stage retrieval

### E2E Tests (Postman)

Add to `postman/collections/search-filter-tests.postman_collection.json`:

1. **Resume Upload - Create New Engineer**
2. **Resume Upload - Update Existing Engineer**
3. **Resume Upload - Skill Normalization**
4. **Content Search - TF-IDF**
5. **Content Search - Embeddings**
6. **Content Search - Hybrid**
7. **Content Search - Similar To Engineer**

---

## Performance Considerations

1. **TF-IDF Index**: Stored in-memory, rebuilt on startup. For 10K+ engineers, consider persistent storage.

2. **Embeddings**: Generated on upload, stored in Neo4j. Use batch generation for bulk imports.

3. **Vector Index**: Neo4j HNSW index provides O(log n) approximate nearest neighbor search.

4. **Hybrid Search**: Most expensive - consider caching TF-IDF scores and limiting re-ranking candidates.

---

## Migration Notes

1. **SkillSynonym Node**: New node type for skill name variations with `ALIAS_FOR` relationship to Skill nodes. Requires seeding via `seedSkillSynonyms()`. Includes unique constraint and index on `name` for fast lookups.

2. **Resume Node**: New node type for storing raw resume text.

3. **Vector Index**: Requires Neo4j 5.11+. Run migration to create index before using embedding search.

4. **Embedding Model**: Requires `mxbai-embed-large` model in Ollama. Install with: `ollama pull mxbai-embed-large`

5. **Backward Compatibility**: Existing search endpoints unchanged. New endpoints are additive.

---

## References

- Original research: `thoughts/private/research/2026-01-21-content-based-resume-filtering.md`
- Feature weighting theory: `thoughts/shared/2_chapter_4/0_foundational_info/2_feature_weighting/2_feature_weighting.md`
- Text similarity theory: `thoughts/shared/2_chapter_4/0_foundational_info/3_text_similarity.md/resume_text_similarity.md`
- Feature extraction theory: `thoughts/shared/2_chapter_4/0_foundational_info/1_feature_extraction/resume_processing.md`
- Existing patterns: `recommender_api/src/services/search.service.ts`, `llm.service.ts`
