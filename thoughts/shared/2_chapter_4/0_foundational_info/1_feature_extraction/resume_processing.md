# Resume Processing: From Raw Text to Usable Features

This document covers what you can do with a developer's resume to make it useful for matching and recommendation.

## Two Distinct Goals

When processing a resume, you're trying to accomplish two different things:

1. **Feature Extraction** — Pull out discrete, structured facts (skills, years of experience, job titles)
2. **Semantic Representation** — Create a vector that captures the "meaning" for similarity comparison

These serve different purposes and use different techniques.

---

## Part 1: Feature Extraction

### What Can Be Extracted

| Category | Examples | Why It's Useful |
|----------|----------|-----------------|
| **Skills** | "TypeScript", "Kubernetes", "System Design" | Hard constraint matching, skill-based filtering |
| **Experience per skill** | "5 years React, 2 years Go" | Proficiency inference, seniority signals |
| **Job progression** | Junior → Senior → Staff | Seniority level, growth trajectory |
| **Leadership signals** | "Led team of 8", "Mentored 3 engineers" | Management fit, team lead roles |
| **Project complexity** | "Scaled to 1M users", "Built from scratch" | Seniority validation, capability assessment |
| **Domain experience** | "Fintech", "Healthcare", "E-commerce" | Industry-specific matching |
| **Company signals** | FAANG, startup, agency | Culture fit, work style inference |

### Two Extraction Approaches: NLP/ML vs LLM

#### Option A: Traditional NLP/ML Pipeline

**How it works:**
```
Resume Text
    │
    ▼
┌─────────────────┐
│ Preprocessing   │ → Tokenization, sentence splitting, cleaning
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ NER Model       │ → Named Entity Recognition (spaCy, BERT-NER)
│                 │   Detects: SKILL, ORG, DATE, TITLE, LOCATION
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Relation        │ → Links entities: "Python" → "5 years"
│ Extraction      │   "Senior Engineer" → "Google"
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Post-processing │ → Normalize skills, resolve dates, validate
└─────────────────┘
```

**Example with spaCy + custom NER:**
```python
import spacy
from spacy.matcher import Matcher

nlp = spacy.load("en_core_web_lg")
# Add custom skill NER trained on tech resumes
nlp.add_pipe("skill_ner")

doc = nlp(resume_text)

skills = [ent.text for ent in doc.ents if ent.label_ == "SKILL"]
# ["Python", "Kubernetes", "React"]

# Pattern matching for experience
matcher = Matcher(nlp.vocab)
matcher.add("YEARS_EXP", [[{"LIKE_NUM": True}, {"LOWER": "years"}]])
matches = matcher(doc)
```

**Pros:**
- Predictable, deterministic output
- Fast inference (milliseconds)
- No API costs after training
- Full control over model behavior
- Can run entirely on-premise
- Interpretable — you can inspect why something was extracted

**Cons:**
- Requires labeled training data (expensive to create)
- Brittle to format variations (different resume layouts break it)
- Each entity type needs separate training
- Poor at inference/reasoning ("led team of 5" → leadership experience)
- Struggles with implicit information
- Maintenance burden — need to retrain as job market evolves

#### Option B: LLM Extraction

**How it works:**
```
Resume Text + Schema Prompt
    │
    ▼
┌─────────────────┐
│ LLM API Call    │ → Single inference produces structured JSON
│ (GPT-4, Claude) │
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ Validation      │ → Check against schema, normalize values
└─────────────────┘
```

**Pros:**
- No training data required — works out of the box
- Handles format variations gracefully
- Can reason about implicit information ("led team" → leadership)
- Single model handles all entity types
- Easy to modify extraction schema (just change the prompt)
- Understands context and nuance

**Cons:**
- Non-deterministic — same input may give different outputs
- API costs per extraction ($0.01-0.10 per resume)
- Latency (1-5 seconds per call)
- Hallucination risk — may infer skills not explicitly mentioned
- Vendor dependency
- Harder to debug ("why did it extract X?")

#### Head-to-Head Comparison

| Dimension | Traditional NLP/ML | LLM |
|-----------|-------------------|-----|
| **Setup cost** | High (training data, model training) | Low (prompt engineering) |
| **Per-unit cost** | Near zero (self-hosted inference) | $0.01-0.10 per resume |
| **Latency** | Milliseconds | 1-5 seconds |
| **Format flexibility** | Low (trained on specific formats) | High (handles varied layouts) |
| **Implicit reasoning** | Poor ("5 engineers" → team size) | Good |
| **Determinism** | High | Low (temperature-dependent) |
| **Hallucination** | Rare (only extracts what it sees) | Possible |
| **Maintenance** | High (retrain for new skills/patterns) | Low (update prompt) |
| **Explainability** | High (inspect model decisions) | Low (black box) |
| **Offline capability** | Yes | No (requires API) |

#### When to Use Which

**Use Traditional NLP/ML when:**
- Processing millions of resumes (cost-sensitive at scale)
- Need deterministic, reproducible results
- Operating in regulated environments requiring explainability
- Have existing labeled training data
- Latency is critical (real-time parsing)

**Use LLM when:**
- Processing hundreds to thousands of resumes
- Resume formats vary widely
- Need to extract nuanced information (leadership signals, project complexity)
- Moving fast without labeled data
- Accuracy matters more than cost

**Hybrid approach:**
```
Resume Text
    │
    ▼
┌─────────────────┐
│ Fast NLP Pass   │ → Extract obvious entities (skills, dates, companies)
│ (spaCy)         │   Takes: 50ms
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ LLM Pass        │ → Extract nuanced info (leadership, complexity, fit)
│ (only if needed)│   Takes: 2s, costs $0.03
└─────────────────┘
```

This gives you speed and cost efficiency for straightforward extraction, with LLM power for the hard cases.

### LLM Extraction in Practice

Send the resume to an LLM with a structured output schema:

```typescript
const extractionPrompt = `
Extract structured information from this resume.

Resume:
${resumeText}

Return JSON matching this schema:
{
  "skills": [
    { "name": string, "yearsUsed": number | null, "context": string }
  ],
  "totalYearsExperience": number,
  "seniorityProgression": string[],  // e.g., ["Junior", "Mid", "Senior"]
  "leadershipExperience": {
    "hasManaged": boolean,
    "largestTeamSize": number | null,
    "hasMentored": boolean
  },
  "domains": string[],
  "companyTypes": ("faang" | "startup" | "enterprise" | "agency" | "consultancy")[],
  "notableAccomplishments": string[]  // brief phrases, not full sentences
}
`;
```

### LLM Extraction Challenges

| Challenge | Example | Mitigation |
|-----------|---------|------------|
| **Hallucination** | Inferring "Kubernetes" from "containerized deployments" | Require exact matches or explicit mentions |
| **Ambiguity** | "5+ years experience" — is that total or per skill? | Design prompts to ask for clarification signals |
| **Inconsistent output** | Sometimes returns `null`, sometimes `0`, sometimes omits field | Use structured output (JSON mode) + validation |
| **Skill normalization** | "React.js" vs "ReactJS" vs "React" | Post-process with a canonical skill list |

### Validation Layer

The validation layer handles the gap between "what the LLM returned" and "what your system can actually use."

#### The Problem

LLM returns raw strings:
```json
{
  "skills": [
    { "name": "React.js", "yearsUsed": 5 },
    { "name": "K8s", "yearsUsed": 3 },
    { "name": "REST APIs", "yearsUsed": null },
    { "name": "Machine Learning", "yearsUsed": 1 }
  ],
  "totalYearsExperience": 7
}
```

But your system has a canonical skill taxonomy in Neo4j:
```
(:Skill {id: "react", name: "React"})
(:Skill {id: "kubernetes", name: "Kubernetes"})
(:Skill {id: "rest", name: "REST"})
```

"React.js" ≠ "React" as strings — you need to map them.

#### What the Validation Layer Does

**1. Skill Normalization**

```typescript
const synonymToCanonicalSkillId: Record<string, string> = {
  "react.js": "react",
  "reactjs": "react",
  "react": "react",
  "k8s": "kubernetes",
  "kube": "kubernetes",
  "rest apis": "rest",
  "restful": "rest",
  // ... hundreds of these
};

function normalizeSkill(extractedSkillName: string): string | null {
  const canonicalSkillId = synonymToCanonicalSkillId[extractedSkillName.toLowerCase()];
  if (canonicalSkillId) return canonicalSkillId;

  // Fuzzy match as fallback
  const fuzzyMatch = findClosestCanonicalSkill(extractedSkillName);
  if (fuzzyMatch.similarity > 0.85) return fuzzyMatch.skillId;

  return null;  // Unknown skill — flag for review
}
```

**2. Confidence Scoring**

Not all extractions are equal. The LLM might:
- **Explicitly see** "5 years of Python" → high confidence
- **Infer** "probably knows Git" from seeing GitHub links → medium confidence
- **Guess** "likely has communication skills" from job titles → low confidence

```typescript
interface SkillExtraction {
  name: string;
  yearsUsed: number | null;
  confidence: "explicit" | "inferred" | "uncertain";
  evidence: string;  // Quote from resume supporting this
}
```

The LLM prompt should ask for confidence:
```
For each skill, indicate:
- "explicit" if the resume directly states the skill
- "inferred" if you deduced it from context (e.g., "Kubernetes" from "deployed to EKS")
- "uncertain" if it's a guess

Also provide the exact quote from the resume that supports each skill.
```

**Optional: Evidence Verification**

If the LLM provides evidence quotes, you *can* verify they actually appear in the source text. This catches hallucinations where the LLM invents plausible-sounding quotes.

```typescript
function verifyEvidence(
  resumeText: string,
  evidence: string
): { verified: boolean; matchType: "exact" | "fuzzy" | "not_found" } {
  // Exact match
  if (resumeText.toLowerCase().includes(evidence.toLowerCase())) {
    return { verified: true, matchType: "exact" };
  }

  // Fuzzy match (LLM might paraphrase slightly)
  const similarityScore = computeSimilarity(resumeText, evidence);
  if (similarityScore > 0.8) {
    return { verified: true, matchType: "fuzzy" };
  }

  // Evidence not found — possible hallucination
  return { verified: false, matchType: "not_found" };
}
```

**Is this worth implementing?** This is a sensible safeguard rather than an established best practice. Evidence verification is more common in RAG/search systems (where models generate prose with citations) than in structured extraction pipelines.

For extraction, the more established safeguards are:
- Constrained output formats (JSON mode, function calling)
- Normalizing against a predefined skill taxonomy (rejects unknown skills)
- Human review for flagged items

If your normalization step already rejects unknown skills, and humans review flagged items, you may catch hallucinations through those existing gates without quote verification. Consider adding evidence verification if:
- You're seeing hallucinations slip through other validation steps
- The cost of bad data is high (e.g., making hiring decisions based on skills)
- You have the engineering bandwidth to implement and maintain it

**3. Flagging for Human Review**

```typescript
interface ExtractedProfile {
  skills: SkillExtraction[];
  totalYearsExperience: number;
  // ...
}

interface ValidatedProfile {
  skills: CanonicalSkill[];  // Mapped to your skill taxonomy
  confidence: Record<string, number>;  // How certain are we about each field
  needsReview: string[];  // Fields that should be human-verified
}

function validateProfile(extracted: ExtractedProfile): ValidatedProfile {
  const validated: ValidatedProfile = {
    skills: [],
    confidence: {},
    needsReview: [],
  };

  for (const skill of extracted.skills) {
    const canonicalId = normalizeSkill(skill.name);

    if (!canonicalId) {
      /*
       * Unknown skill — human needs to either:
       * - Map it to an existing canonical skill
       * - Add it to the taxonomy
       * - Mark it as invalid/hallucinated
       */
      validated.needsReview.push(`Unknown skill: "${skill.name}"`);
      continue;
    }

    if (skill.confidence === "uncertain") {
      validated.needsReview.push(`Uncertain extraction: ${skill.name}`);
    }

    validated.skills.push({
      skillId: canonicalId,
      yearsUsed: skill.yearsUsed,
    });
    validated.confidence[canonicalId] = confidenceToScore(skill.confidence);
  }

  // Flag suspicious patterns
  if (extracted.totalYearsExperience < 5 && extracted.skills.length > 20) {
    validated.needsReview.push("Unusually high skill count for experience level");
  }

  return validated;
}
```

#### The Full Validation Flow

```
LLM Response (raw)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ Validation Layer                                        │
│                                                         │
│  1. Parse & schema validate (did LLM return valid JSON?)│
│  2. Normalize skills → canonical IDs                    │
│  3. Score confidence per field                          │
│  4. (Optional) Verify evidence quotes exist in source   │
│  5. Flag unknowns and uncertainties for human review    │
│  6. Detect hallucination patterns                       │
└─────────────────────────────────────────────────────────┘
    │
    ├─── needsReview.length > 0? ───► Human Review Queue
    │                                      │
    │                                      ▼
    │                               Human corrects/confirms
    │                                      │
    ▼                                      │
Store in Neo4j ◄───────────────────────────┘
```

#### Why This Matters

**Without validation:**
- "React.js" creates a new orphan skill node instead of linking to existing "React"
- You trust hallucinated skills and make bad recommendations
- You can't query "all engineers who know React" because data is inconsistent

**With validation:**
- All skills map to your canonical taxonomy
- Confidence scores let you weight matches ("explicit Python" > "inferred Python")
- Human review catches errors before they pollute your data

