# Our System vs Eightfold: Learning Progress and Gap Analysis

This document tracks how our talent matching system compares to Eightfold's architecture, identifies gaps, and outlines the path toward production-quality matching.

**Reference**: `docs/learning_through_imitation/eightfold/eightfold_learning_plan.md`

---

## Eightfold's Architecture: Multi-Signal Feature Extraction

Eightfold doesn't choose between content-based and structure-based search. They **extract multiple signals from both** and combine them in a learned scoring model:

```
Candidate + Job
    │
    ├─→ Dense semantic embedding similarity (content)
    ├─→ Skill token embedding similarity (content)
    ├─→ Title token embedding similarity (content)
    ├─→ Career trajectory prediction fit (content + learned)
    ├─→ Company embedding similarity (content)
    ├─→ Years of experience match (structure)
    ├─→ Education level match (structure)
    ├─→ Location match (structure)
    ├─→ Salary alignment (structure)
    │
    ▼
    Learned Scoring Model (GBDT)
    │
    ▼
    Calibrated Score + Explanations
```

### Key Insight: The False Dichotomy

The question "content-first vs structure-first?" is the wrong framing. Eightfold shows:

| Wrong Framing | Right Framing |
|---------------|---------------|
| Content OR structure | Content AND structure as feature sources |
| Choose primary search method | Extract all signals, learn combination |
| Hand-tune weights | Learn weights from outcome data |

**Bottom line**: Content features are signal extraction, not the final answer. You still need to combine them with structured features in a unified scoring model.

---

## Feature-by-Feature Comparison

### What Eightfold Has That We Don't

| Feature | Eightfold | Our System | Gap |
|---------|-----------|------------|-----|
| Dense semantic embedding | ✅ | ✅ (mxbai-embed-large) | None |
| Skill token embeddings | ✅ (skill → vector) | ✅ (1024-dim on Skill nodes) | None |
| Skill recency weighting | ✅ | ✅ (recentSkillEmbeddingSimilarity) | None |
| Title token embeddings | ✅ | ❌ | **Gap** |
| Career trajectory RNN | ✅ (predicts next title/company) | ❌ | **Gap** |
| Company embeddings | ✅ | ❌ (companies are graph nodes) | **Gap** |
| Learned scoring weights | ✅ (GBDT on outcomes) | Partial (hand-tuned 50/50 weighting) | **Gap** |
| Calibrated probabilities | ✅ (isotonic regression) | ❌ | **Gap** |
| Boolean filtering | Implicit | ✅ | We're ahead |
| Skill hierarchy expansion | Unknown | ✅ | We're ahead |
| Explainable matching terms | Unknown | ✅ (TF-IDF) | We're ahead |

### What We Have That Aligns

| Feature | Status | Notes |
|---------|--------|-------|
| Dense embeddings for profiles | ✅ | 1024-dim via Ollama (mxbai-embed-large) |
| Skill token embeddings | ✅ | 1024-dim on Skill nodes, centroid-based similarity |
| Skill recency weighting | ✅ | Recent (3yr) vs all-time skill similarity |
| Structured constraints | ✅ | Skills, seniority, timezone, budget, domains |
| Boolean filtering | ✅ | Inverted index for required terms |
| TF-IDF explainability | ✅ | Matching terms extraction |
| Skill normalization | ✅ | Exact → synonym → fuzzy → unresolved |
| Work history structure | ✅ | WorkExperience nodes with dates, titles, companies |
| Company normalization | ✅ | Aliases, type classification |
| Hybrid search | ✅ | Boolean filter → Embedding ranking → TF-IDF explain |
| Combined embedding scoring | ✅ | 50/50 profile + skill similarity weighting |

---

## Mental Model Shift

### Before: Layered Approach (Content vs Structure)

```
Input (Job Description or Search Query)
    ↓
Parse into structured requirements
    ↓
Constraint Search (primary)
    ↓
Content Search (enhancement/re-ranking)
    ↓
Results
```

**Problem**: Treats content and structure as competing approaches rather than complementary signals.

### After: Multi-Signal Approach (Eightfold-Aligned)

```
Input (Job Description or Search Query)
    ↓
    ├─→ Parse requirements (structure signals)
    │     - Required skills, seniority, domains
    │     - Budget, timezone, timeline
    │
    ├─→ Generate embedding (content signal)
    │     - Dense semantic similarity
    │
    ├─→ Compute skill similarity (token signal) ✅
    │     - Centroid-based skill embedding similarity
    │     - Recent skill similarity (last 3 years)
    │
    └─→ Predict career fit (trajectory signal) [FUTURE]
    ↓
Combine ALL signals in scoring model
    ↓
Ranked candidates with explanations
```

**Key change**: Every signal source (content, structure, learned predictions) becomes a **feature** fed into a unified scoring model.

---

## Eightfold's "Critical Path"

Their recommended implementation order:

```
Phase 2  → TF-IDF baseline                    ✅ Done
Phase 3  → Dense embeddings (big improvement) ✅ Done
Phase 4  → Skill token embeddings             ✅ Done
Phase 5  → Title token embeddings             ← NEXT
Phase 9  → Feature combination                Partial (50/50 profile + skill weighting)
Phase 10 → Hand-tuned scoring
    ↓
Phase 6  → Title trajectory RNN
Phase 11 → Learned scoring weights
Phase 12 → GBDT scoring model
Phase 13 → Calibration
Phase 14 → Explainability
```

**Key observation**: They start with content (TF-IDF → embeddings → token embeddings) but immediately move to **feature combination** before adding complexity like trajectory prediction.

---

## Our Implementation Roadmap (Eightfold-Aligned)

### Phase 1: Current State (Eightfold Phases 2-3) ✅

What we have:
- TF-IDF baseline with tech-specific normalization
- Dense profile embeddings (1024-dim)
- Hybrid search (boolean + embedding + TF-IDF explain)
- Hand-tuned utility scoring

### Phase 2: Skill Token Embeddings (Eightfold Phase 4) ✅ Complete

**Implemented**: Skill embeddings stored on all Skill nodes with centroid-based similarity scoring.

**What was built**:
- 1024-dimensional embeddings on all Skill nodes (via `seeds/skill-embeddings.ts`)
- Vector index `skill_embedding_index` for efficient similarity queries
- Centroid-based skill-set similarity (`computeSkillSetSimilarity`)
- Recency weighting (skills used in last 3 years vs all-time)
- Content search integration with re-ranking

**New signals in content search response**:
- `skillEmbeddingSimilarity` - centroid similarity of all skills
- `recentSkillEmbeddingSimilarity` - centroid similarity of recent skills
- `skillCount` / `recentSkillCount` - number of skills in each calculation

**Combined scoring**: `contentScore = 0.5 * profileEmbeddingScore + 0.5 * skillEmbeddingSimilarity`

**Value**: "Kafka" requirement matches "RabbitMQ" experience (both message queues) even without explicit CORRELATES_WITH edge.

See: `thoughts/shared/2_chapter_4/1_project_1/plans/2026-01-23-skill-embedding-similarity.md`

### Phase 3: Title Token Embeddings (Eightfold Phase 5)

**Goal**: Add embeddings to job titles for role similarity.

```typescript
// Embed job titles
const titleEmbedding = await generateEmbedding("Senior Software Engineer");

// Compare current title to target role
const titleSimilarity = cosine(
  candidateCurrentTitleEmbedding,
  jobTitleEmbedding
);
```

**New signal**: `titleEmbeddingSimilarity` - how similar is candidate's current role to target role.

**Value**: "Staff Engineer" naturally matches "Principal Engineer" searches.

### Phase 4: Multi-Signal Feature Combination (Eightfold Phases 9-10)

**Goal**: Combine all signals in unified scoring.

```typescript
interface MatchFeatures {
  // Content signals
  profileEmbeddingSimilarity: number;  // Dense semantic match
  tfidfSimilarity: number;             // Keyword overlap
  skillEmbeddingSimilarity: number;    // Skill-set similarity
  titleEmbeddingSimilarity: number;    // Role similarity

  // Structure signals
  exactSkillMatchScore: number;        // Graph-based skill match
  experienceMatch: number;             // Years vs requirement
  seniorityMatch: number;              // Level alignment
  domainOverlap: number;               // Business/technical domains
  budgetFit: number;                   // Salary vs budget
  timezoneMatch: number;               // Location compatibility
}

// Hand-tuned weights (initial)
const weights = {
  profileEmbeddingSimilarity: 0.15,
  skillEmbeddingSimilarity: 0.20,
  exactSkillMatchScore: 0.20,
  experienceMatch: 0.15,
  seniorityMatch: 0.10,
  // ... etc
};
```

### Phase 5: Learned Scoring (Eightfold Phases 11-13)

**Goal**: Learn optimal feature weights from outcome data.

**Prerequisites**:
- Outcome data collection (clicks, interviews, hires)
- Enough labeled examples (hundreds minimum)

```python
from lightgbm import LGBMClassifier
from sklearn.calibration import CalibratedClassifierCV

# Train on outcomes
model = LGBMClassifier(n_estimators=500, learning_rate=0.05)
model.fit(X_features, y_outcomes)

# Calibrate probabilities
calibrated = CalibratedClassifierCV(model, method='isotonic')
calibrated.fit(X_val, y_val)

# Convert to star ratings
def prob_to_stars(prob):
    return max(0.5, min(5.0, round(prob * 10) / 2))
```

**Value**: Model learns what actually predicts good matches, not what we guess.

### Phase 6: Career Trajectory (Eightfold Phases 6-8)

**Goal**: Predict career progression to assess "natural fit".

1. Build title transition graph from WorkExperience data
2. Train trajectory model (LSTM or Transformer) on career sequences
3. Predict next likely title for each candidate
4. Score fit: How similar is predicted next title to target role?

**New signal**: `trajectoryFit` - is this role a natural next step?

**Value**: "This Senior Engineer's career trajectory suggests Staff Engineer is a natural next step" vs "This candidate's history suggests they're pivoting careers."

---

## Infrastructure Foundations for Future Phases

The content-based resume filtering implementation built infrastructure that will accelerate future Eightfold phases:

| Infrastructure | Enables | Eightfold Phase |
|----------------|---------|-----------------|
| **WorkExperience nodes** with dates, titles, companies | Career trajectory analysis | Phase 6-8 (Trajectory RNNs) |
| **Company nodes** with types (faang/startup/enterprise) and aliases | Company embedding similarity | Phase 7 (Company Embeddings) |
| **UserSkill → USED_AT → WorkExperience links** | Skill recency weighting ("used Kafka in last 2 years" vs "used 5 years ago") | Phase 4.4 ✅ Complete |
| **Skill normalization** (exact → synonym → fuzzy → unresolved) | Clean skill token vocabulary | Phase 4 ✅ Complete |
| **Company normalization** (suffix stripping, alias resolution) | Clean company token vocabulary | Phase 7 (Company Embeddings) |
| **LLM feature extraction with RAG context** | Constrained extraction using our taxonomy | All phases (clean data foundation) |
| **Inverted index + HNSW embedding index** | Boolean filter → embedding ranking pipeline | Phase 9-10 (Feature Combination) |
| **Hybrid search architecture** | Three-stage pipeline (filter → rank → explain) | Phase 9-10, Phase 14 |

These foundations mean future phases can focus on the ML/embedding work rather than data modeling and pipeline infrastructure.

---

## Implementation Priority Matrix

| Phase | Effort | Value | Dependency | Status |
|-------|--------|-------|------------|--------|
| Phase 1: Baseline | Done | Done | - | ✅ Complete |
| Phase 2: Skill Embeddings | Low | High | None | ✅ Complete |
| Phase 3: Title Embeddings | Low | Medium | None | **Next** |
| Phase 4: Multi-Signal | Medium | High | Phases 2-3 | Partial (skill + profile combined) |
| Phase 5: Learned Scoring | High | Very High | Outcome data | Future |
| Phase 6: Trajectory | High | Medium | Work history data | Future |

**Recommendation**:
1. ~~Implement skill embeddings (Phase 2)~~ ✅ Done
2. Implement title embeddings (Phase 3) - low effort, enables role similarity
3. Build job description matching feature using skill + title + profile embeddings
4. Collect outcome data during usage
5. Add learned scoring (Phase 5) once you have enough data

---

## Outcome Data Collection Strategy

To enable learned scoring (Phase 5), we need to collect hiring outcomes. Options:

| Signal | Quality | Availability | Implementation |
|--------|---------|--------------|----------------|
| Manager views profile | Low | Easy | Track click-through |
| Manager contacts candidate | Medium | Easy | Track "contact" button |
| Interview scheduled | High | Medium | Integration with ATS |
| Actual hire | Very High | Hard | Manual or ATS integration |
| Explicit feedback | High | Medium | Thumbs up/down on results |

**Minimum viable approach**: Track manager click-through and explicit feedback (thumbs up/down) on recommended candidates. This gives positive and negative signals without ATS integration.

---

## Summary: Where We Are on the Eightfold Path

```
Eightfold Phase    Our Status
─────────────────────────────────
Phase 2 (TF-IDF)   ✅ Complete
Phase 3 (Dense)    ✅ Complete
Phase 4 (Skills)   ✅ Complete (with recency weighting)
Phase 5 (Titles)   🔜 Next up
Phase 9-10 (Combine) ⏳ Partial (50/50 profile + skill weighting)
Phase 6-8 (Trajectory) 🔮 Future
Phase 11-13 (Learn) 🔮 Future (needs data)
Phase 14 (Explain) ✅ Partial (TF-IDF terms + skill counts)
```

The critical insight from Eightfold: **extract all available signals, then learn the combination**. We now have:
- Dense profile embeddings (Phase 3) ✅
- Skill token embeddings with recency weighting (Phase 4) ✅
- Initial feature combination (50/50 weighting in content search) ✅

**Next steps**: Add title embeddings (Phase 5), then expand feature combination to include all signals before moving to learned scoring.
