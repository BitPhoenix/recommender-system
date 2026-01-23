# TF-IDF Vectorizer SRP Refactoring Plan

## Overview

Refactor the planned `tfidf-vectorizer.service.ts` (from the content-based resume filtering plan) to follow the Single Responsibility Principle and proper function ordering. The current design bundles text normalization, TF-IDF computation, and vector math into a single ~450-line file.

## Current State Analysis

### What Exists (in the plan)

The planned `tfidf-vectorizer.service.ts` (Section 1.7 of `2026-01-21-content-based-resume-filtering.md`) combines four distinct responsibilities:

| Responsibility | Lines | Elements |
|----------------|-------|----------|
| **Text normalization config** | ~80 | `ENGLISH_STOPWORDS`, `RESUME_FILLER_WORDS`, `TECH_COMPOUND_PATTERNS`, `PHRASE_TO_TOKEN` |
| **Text normalization logic** | ~40 | `tokenize()` function with 5-step pipeline |
| **TF-IDF computation** | ~100 | `buildFieldWeightedTfIdfIndex()`, `queryToVector()` |
| **Vector math utilities** | ~50 | `cosineSimilarity()`, `getMatchingTerms()` |

### Key Issues

1. **SRP Violation**: A single file handling tokenization, TF-IDF math, and vector operations
2. **Function Ordering**: Helper functions (`tokenize`) appear before the main functions that call them (`buildFieldWeightedTfIdfIndex`)
3. **Constant Placement**: `NORMALIZATION_STRATEGY` constant appears after the `tokenize()` function instead of with other constants
4. **Large Functions**: `buildFieldWeightedTfIdfIndex()` handles 5 operations; `tokenize()` has 5 inline pipeline steps
5. **Reusability**: Vector math operations could be shared with future embedding similarity

## Desired End State

After this refactor:

1. **3 focused services** instead of 1 monolithic file
2. **Constants grouped at top** of each file
3. **Main/parent functions first**, helper functions below
4. **Each function does one thing** - large functions split into composable helpers
5. **Reusable components** - vector math and text normalization usable elsewhere

### New File Structure

```
recommender_api/src/services/content-search/
├── text-normalizer.service.ts     # Text normalization pipeline
├── tfidf-vectorizer.service.ts    # TF-IDF indexing and querying (simplified)
└── sparse-vector.service.ts       # Generic sparse vector math
```

### Verification

- TypeScript compiles without errors: `npm run typecheck`
- All imports resolve correctly
- Unit tests pass (when written)
- No functionality changes - pure refactoring

## What We're NOT Doing

- Changing any algorithms or behavior
- Adding new features
- Modifying the TF-IDF index manager (`tfidf-index-manager.service.ts`)
- Updating tests (this is a structural refactor of planned code)

## Implementation Approach

Update Section 1.7 of the content-based resume filtering plan to define 3 separate services instead of 1, with proper function ordering in each.

---

## Phase 1: Extract Text Normalization Service

### Overview

Extract all text normalization logic into `text-normalizer.service.ts`. This service is domain-agnostic and could be reused for embedding input preparation, search query processing, etc.

### Changes Required

#### 1.1 Replace Section 1.7 Header

**Current** (line ~1023-1028):
```markdown
#### 1.7 TF-IDF Vectorizer Service (Field-Weighted)

**File**: `recommender_api/src/services/content-search/tfidf-vectorizer.service.ts` (new)

This implementation uses **field-weighted TF-IDF** where the same term gets different weights depending on its source field.
```

**Replace with**:
```markdown
#### 1.7 Text Normalization Service

**File**: `recommender_api/src/services/content-search/text-normalizer.service.ts` (new)

Handles text tokenization and normalization for TF-IDF and embedding processing. Separated from TF-IDF computation to enable reuse and follow SRP.
```

#### 1.2 New `text-normalizer.service.ts` Content

Replace the code block starting at line ~1029 with:

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

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] File structure is correct

---

## Phase 2: Extract Sparse Vector Service

### Overview

Extract generic vector math operations into `sparse-vector.service.ts`. These are reusable for any sparse representation (TF-IDF, one-hot encodings, etc.) and potentially for comparing dense embeddings later.

### Changes Required

#### 2.1 Add New Section After 1.7

Insert after the text-normalizer section:

```markdown
#### 1.7b Sparse Vector Service

**File**: `recommender_api/src/services/content-search/sparse-vector.service.ts` (new)

Generic sparse vector operations for similarity computation. Separated from TF-IDF to enable reuse with other sparse representations.
```

#### 2.2 New `sparse-vector.service.ts` Content

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
  const bTermToWeight = buildTermToWeightMap(b);
  return calculateDotProduct(a, bTermToWeight);
}

/*
 * Get the top matching terms between query and document for explainability.
 */
export function getMatchingTerms(
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

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] No duplicate type definitions

---

## Phase 3: Simplify TF-IDF Vectorizer Service

### Overview

Refactor `tfidf-vectorizer.service.ts` to only handle TF-IDF computation, importing text normalization and vector math from the extracted services. Apply proper function ordering: main API first, helpers below.

### Changes Required

#### 3.1 Add New Section

Insert after the sparse-vector section:

```markdown
#### 1.7c TF-IDF Vectorizer Service (Simplified)

**File**: `recommender_api/src/services/content-search/tfidf-vectorizer.service.ts` (new)

Field-weighted TF-IDF indexing and querying. Imports text normalization and vector math from dedicated services.
```

#### 3.2 New `tfidf-vectorizer.service.ts` Content

```typescript
import { fieldWeights, type FieldName } from "../../config/knowledge-base/field-weights.config.js";
import { tokenize, NORMALIZATION_STRATEGY } from "./text-normalizer.service.js";
import { type SparseVector, l2Normalize } from "./sparse-vector.service.js";

/*
 * =============================================================================
 * TYPES
 * =============================================================================
 */

export interface FieldWeightedDocument {
  id: string;
  fields: Record<FieldName, string>;
}

export interface TfIdfIndex {
  termToIndex: Map<string, number>;
  termToIdf: Map<string, number>;
  documentIdToVector: Map<string, SparseVector>;
  totalDocuments: number;
}

interface TermData {
  count: number;
  maxFieldWeight: number;
}

interface VocabularyStats {
  termToIndex: Map<string, number>;
  termToDocumentCount: Map<string, number>;
  documentTermData: Map<string, Map<string, TermData>>;
}

/*
 * =============================================================================
 * MAIN API (parent functions)
 * =============================================================================
 */

/*
 * Build a field-weighted TF-IDF index from documents with separate fields.
 *
 * Key insight from Aggarwal's feature weighting (Section 4.3.1.1):
 * - Field weights give context to WHERE a term appears
 * - IDF weights give context to HOW COMMON a term is
 * - Final weight = field_weight × tf × idf
 */
export function buildFieldWeightedTfIdfIndex(documents: FieldWeightedDocument[]): TfIdfIndex {
  const vocabularyStats = buildVocabularyAndStats(documents);
  const termToIdf = calculateIdfValues(vocabularyStats.termToDocumentCount, documents.length);
  const documentIdToVector = buildDocumentVectors(
    documents,
    vocabularyStats.documentTermData,
    termToIdf
  );

  return {
    termToIndex: vocabularyStats.termToIndex,
    termToIdf,
    documentIdToVector,
    totalDocuments: documents.length,
  };
}

/*
 * Convert a query string to a TF-IDF vector using an existing index.
 */
export function queryToVector(query: string, index: TfIdfIndex): SparseVector {
  const tokens = tokenize(query, NORMALIZATION_STRATEGY);
  const termCounts = countKnownTerms(tokens, index.termToIndex);
  const vector = buildQueryVector(termCounts, tokens.length, index.termToIdf);
  return l2Normalize(vector);
}

// Re-export types and utilities for consumers
export { type SparseVector } from "./sparse-vector.service.js";
export { cosineSimilarity, getMatchingTerms } from "./sparse-vector.service.js";
export { tokenize } from "./text-normalizer.service.js";

/*
 * =============================================================================
 * INDEX BUILDING HELPERS
 * =============================================================================
 */

function buildVocabularyAndStats(documents: FieldWeightedDocument[]): VocabularyStats {
  const termToIndex = new Map<string, number>();
  const termToDocumentCount = new Map<string, number>();
  const documentTermData = new Map<string, Map<string, TermData>>();

  for (const doc of documents) {
    const { termData, uniqueTerms } = processDocumentFields(doc);
    documentTermData.set(doc.id, termData);

    for (const term of uniqueTerms) {
      if (!termToIndex.has(term)) {
        termToIndex.set(term, termToIndex.size);
      }
      termToDocumentCount.set(term, (termToDocumentCount.get(term) || 0) + 1);
    }
  }

  return { termToIndex, termToDocumentCount, documentTermData };
}

function processDocumentFields(
  doc: FieldWeightedDocument
): { termData: Map<string, TermData>; uniqueTerms: Set<string> } {
  const termData = new Map<string, TermData>();
  const uniqueTerms = new Set<string>();

  for (const [fieldName, fieldText] of Object.entries(doc.fields)) {
    const fieldWeight = fieldWeights[fieldName as FieldName] ?? 0.3;
    const tokens = tokenize(fieldText, NORMALIZATION_STRATEGY);

    for (const token of tokens) {
      uniqueTerms.add(token);
      const existing = termData.get(token);
      if (existing) {
        existing.count += 1;
        existing.maxFieldWeight = Math.max(existing.maxFieldWeight, fieldWeight);
      } else {
        termData.set(token, { count: 1, maxFieldWeight: fieldWeight });
      }
    }
  }

  return { termData, uniqueTerms };
}

function calculateIdfValues(
  termToDocumentCount: Map<string, number>,
  totalDocs: number
): Map<string, number> {
  const termToIdf = new Map<string, number>();
  for (const [term, docCount] of termToDocumentCount) {
    termToIdf.set(term, Math.log(totalDocs / (docCount + 1)) + 1); // Smoothed IDF
  }
  return termToIdf;
}

function buildDocumentVectors(
  documents: FieldWeightedDocument[],
  documentTermData: Map<string, Map<string, TermData>>,
  termToIdf: Map<string, number>
): Map<string, SparseVector> {
  const documentIdToVector = new Map<string, SparseVector>();

  for (const doc of documents) {
    const termData = documentTermData.get(doc.id)!;
    const vector = buildSingleDocumentVector(termData, termToIdf);
    documentIdToVector.set(doc.id, l2Normalize(vector));
  }

  return documentIdToVector;
}

function buildSingleDocumentVector(
  termData: Map<string, TermData>,
  termToIdf: Map<string, number>
): SparseVector {
  const totalTerms = calculateTotalTermCount(termData);
  const terms: string[] = [];
  const weights: number[] = [];

  for (const [term, { count, maxFieldWeight }] of termData) {
    const tf = count / totalTerms;
    const idf = termToIdf.get(term) || 0;
    const fieldWeightedTfIdf = maxFieldWeight * tf * idf;

    if (fieldWeightedTfIdf > 0) {
      terms.push(term);
      weights.push(fieldWeightedTfIdf);
    }
  }

  return { terms, weights };
}

function calculateTotalTermCount(termData: Map<string, TermData>): number {
  let total = 0;
  for (const { count } of termData.values()) {
    total += count;
  }
  return total;
}

/*
 * =============================================================================
 * QUERY PROCESSING HELPERS
 * =============================================================================
 */

function countKnownTerms(
  tokens: string[],
  termToIndex: Map<string, number>
): Map<string, number> {
  const termCounts = new Map<string, number>();
  for (const token of tokens) {
    if (termToIndex.has(token)) {
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
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Imports resolve correctly
- [ ] No functionality changes from original monolithic version

---

## Phase 4: Update Index Manager Imports

### Overview

Update `tfidf-index-manager.service.ts` to use the correct imports from the refactored services.

### Changes Required

#### 4.1 Update Section 1.8

Change the imports in Section 1.8 from:

```typescript
import {
  buildFieldWeightedTfIdfIndex,
  tokenize,
  type FieldWeightedDocument,
  type TfIdfIndex,
} from "./tfidf-vectorizer.service.js";
```

To:

```typescript
import {
  buildFieldWeightedTfIdfIndex,
  tokenize,
  type FieldWeightedDocument,
  type TfIdfIndex,
} from "./tfidf-vectorizer.service.js";
// Note: tokenize is re-exported from tfidf-vectorizer for convenience
```

No other changes needed - the re-exports maintain backward compatibility.

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Index manager works correctly

---

## Summary of Changes to Plan Document

| Section | Action | Description |
|---------|--------|-------------|
| 1.7 | **Replace** | Rename to "Text Normalization Service", replace code with `text-normalizer.service.ts` |
| 1.7b | **Add** | New section for `sparse-vector.service.ts` |
| 1.7c | **Add** | New section for simplified `tfidf-vectorizer.service.ts` |
| 1.8 | **Update** | Minor import comment update |

## Benefits of This Refactor

| Before | After |
|--------|-------|
| 1 file, ~450 lines | 3 files, ~150 lines each |
| Text normalization tightly coupled to TF-IDF | Text normalization reusable for embeddings |
| Vector math embedded in TF-IDF | Vector math reusable for any sparse representation |
| Helper functions before callers | Main API at top, helpers below |
| Constants scattered | Constants grouped at top of each file |
| `buildFieldWeightedTfIdfIndex` does 5 things | Split into 6 focused functions |
| `tokenize` has inline pipeline | Split into 4 pipeline functions |

## References

- Original plan: `thoughts/private/plans/2026-01-21-content-based-resume-filtering.md`
- Code style rules: `.claude/rules/code-style.md` (function ordering)
