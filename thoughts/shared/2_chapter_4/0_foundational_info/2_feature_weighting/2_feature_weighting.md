# Feature Weighting (Section 4.3.1.1)

Aggarwal presents two approaches to handling the problem that different keywords carry different weight in predictions.

## The Two Approaches

### 1. Domain-Specific Heuristics (Hand-Tuned Weights)

You use your knowledge of the domain to assign importance weights manually through trial and error.

**Aggarwal's example:** In movie recommendations, the primary actor's name might matter more than a random word from the synopsis.

**In a talent marketplace**, you might decide based on intuition and testing:

| Field Source | Weight | Rationale |
|--------------|--------|-----------|
| Job title | 1.0 | Strong signal of seniority and function |
| Skills listed explicitly | 0.9 | Direct, intentional signal |
| Company names | 0.7 | Implies certain tech stacks, scale, culture |
| Project descriptions | 0.5 | Useful but noisy, varies in quality |
| "About me" prose | 0.3 | Often generic, less predictive |
| Education institution | 0.4 | Matters for some roles, not others |

So if "distributed systems" appears in someone's skills section, it gets weighted higher than if it appears in a rambling paragraph about a side project.

**The process:** You deploy, observe which recommendations succeed (messages sent, interviews scheduled), and manually adjust weights. This is the "start simple with hand-tuned weights" approach.

### 2. Learned Feature Weighting (Automated)

Instead of guessing, you let the data tell you which features predict successful matches.

This is closely related to **feature selection** (section 4.3.4 covers Gini index, entropy, χ²-statistic)—but weighting is the "soft" version where features get continuous importance scores rather than binary keep/discard decisions.

**How it works in practice:**

You collect labeled examples:
- **Positive:** Engineer A was recommended to Manager B → Manager messaged → Interview happened
- **Negative:** Engineer C was recommended to Manager D → Manager ignored

Then you train a model that learns: "When 'Kubernetes' appears in the skills section and the job mentions 'infrastructure,' that's highly predictive of a message. When 'Python' appears anywhere, it's weakly predictive because everyone has it."

**Hypothetical learned weights:**

```
"staff engineer" in title        → 0.92  (strong signal)
"Python" in skills               → 0.15  (too common, low discriminative power)
"Kafka" in skills                → 0.78  (specific, predictive for certain roles)
years_experience match within ±2 → 0.85
salary overlap > 80%             → 0.91
"led" or "built" in descriptions → 0.45  (action verbs matter somewhat)
school name                      → 0.12  (managers don't actually filter on this much)
```

## The Practical Reality

### Start with Approach 1 (Heuristics) when:

- You don't have engagement data yet
- You understand the domain well
- You can iterate quickly based on user feedback

### Graduate to Approach 2 (Learned) when:

- You have sufficient positive/negative examples (hundreds to thousands of interactions)
- You want to discover non-obvious patterns (e.g., "managers at Series A startups heavily weight open source contributions, but enterprise managers don't")
- You need to justify weights with data rather than intuition

## Concrete Example

An engineer's profile:

```
Title: "Senior Software Engineer"
Skills: ["TypeScript", "React", "Node.js", "PostgreSQL"]
Resume: "I built a real-time collaboration feature that reduced
        latency by 40%. Previously worked on payment systems at Stripe."
About:  "I love solving hard problems and working with great people."
```

### With Heuristic Weights

| Token | Source | Weight | Signal Strength |
|-------|--------|--------|-----------------|
| "Senior" | title | 1.0 | Strong |
| "TypeScript" | skills | 0.9 | Strong |
| "React" | skills | 0.9 | Strong |
| "Stripe" | resume | 0.7 | Moderate (company reputation) |
| "real-time" | resume | 0.5 | Moderate |
| "latency" | resume | 0.5 | Moderate |
| "love" | about me | 0.3 | Weak |
| "great people" | about me | 0.3 | Noise |

### With Learned Weights (After Collecting Data)

The model might discover:

- **"Stripe"** in a resume is actually a very strong predictor for fintech roles (weight **0.88**)
- **"real-time"** only matters when the job posting also mentions "real-time" or "WebSocket" (interaction effect)

## Connection to ML Models

This connects directly to the progression from linear models to **Gradient Boosted Decision Trees**—GBDTs excel at learning these non-linear feature interactions automatically, which is why they're the industry standard once you have sufficient training data.

---

## Two Different Things Can Be Weighted

### 1. Field/Section Weights (Metadata-Level)

The *source* of a keyword gets a multiplier. Same word, different weight depending on where it came from.

```typescript
// Field weights - you define these
const fieldWeights = {
  title: 1.0,
  skills: 0.9,
  resumeText: 0.5,
  aboutMe: 0.3
};

// Engineer profile (raw)
const engineer = {
  title: "Senior Software Engineer",
  skills: ["TypeScript", "React", "Kubernetes"],
  resumeText: "Built React dashboards for Kubernetes clusters at Stripe",
  aboutMe: "I love React and building great products"
};

// Extract keywords with field-weighted scores
function extractWeightedKeywords(profile: EngineerProfile): Map<string, number> {
  const keywordScores = new Map<string, number>();

  for (const [field, weight] of Object.entries(fieldWeights)) {
    const text = profile[field];
    const keywords = tokenize(text); // ["senior", "software", "engineer"] etc.

    for (const keyword of keywords) {
      const currentScore = keywordScores.get(keyword) || 0;
      // Take the max if keyword appears in multiple fields
      keywordScores.set(keyword, Math.max(currentScore, weight));
    }
  }

  return keywordScores;
}

// Result:
// "typescript" → 0.9  (from skills)
// "react" → 0.9       (appears in skills AND resumeText AND aboutMe, but max is 0.9)
// "kubernetes" → 0.9  (from skills)
// "stripe" → 0.5      (only in resumeText)
// "senior" → 1.0      (from title)
// "love" → 0.3        (only in aboutMe)
```

Here, "React" gets 0.9 because its *highest-weighted occurrence* is in the skills field, even though it also appears in the lower-weighted aboutMe.

---

### 2. Keyword/Term Weights (Value-Level)

The *keyword itself* gets a weight based on how predictive it is, regardless of where it appears. This is what TF-IDF does, and what learned feature selection does.

```typescript
// Learned or computed keyword importance (independent of field)
const keywordImportance = {
  "kubernetes": 0.85,    // Specific, discriminative
  "typescript": 0.70,    // Useful but common
  "react": 0.50,         // Very common, less discriminative
  "senior": 0.80,        // Strong seniority signal
  "python": 0.20,        // Everyone lists it, low signal
  "love": 0.05,          // Noise word
  "stripe": 0.75,        // Company reputation signal
};

function getKeywordWeight(keyword: string): number {
  return keywordImportance[keyword] || 0.1; // default for unknown
}
```

---

## In Practice: You Combine Both

The final weight for a keyword is typically the **product** of field weight and keyword importance:

```typescript
function computeFinalScore(
  keyword: string,
  field: string
): number {
  const fieldWeight = fieldWeights[field];
  const keywordWeight = getKeywordWeight(keyword);
  return fieldWeight * keywordWeight;
}

// "kubernetes" in skills section:
// 0.9 (field) × 0.85 (keyword) = 0.765

// "kubernetes" in aboutMe section:
// 0.3 (field) × 0.85 (keyword) = 0.255

// "love" in aboutMe section:
// 0.3 (field) × 0.05 (keyword) = 0.015 (basically noise)
```

---

## Full Working Example

```typescript
interface EngineerProfile {
  title: string;
  skills: string[];
  resumeText: string;
  aboutMe: string;
}

interface WeightedKeywordVector {
  [keyword: string]: number;
}

const fieldWeights: Record<string, number> = {
  title: 1.0,
  skills: 0.9,
  resumeText: 0.5,
  aboutMe: 0.3
};

// This could be learned from data or use TF-IDF across your corpus
const globalKeywordIDF: Record<string, number> = {
  "senior": 0.7,
  "staff": 0.9,
  "software": 0.1,      // appears everywhere
  "engineer": 0.1,      // appears everywhere
  "typescript": 0.6,
  "react": 0.4,
  "kubernetes": 0.85,
  "stripe": 0.8,
  "built": 0.3,
  "love": 0.05,
};

function tokenize(text: string | string[]): string[] {
  const raw = Array.isArray(text) ? text.join(" ") : text;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function buildWeightedVector(profile: EngineerProfile): WeightedKeywordVector {
  const vector: WeightedKeywordVector = {};

  const fieldsToProcess: Array<{ name: keyof typeof fieldWeights; value: string | string[] }> = [
    { name: "title", value: profile.title },
    { name: "skills", value: profile.skills },
    { name: "resumeText", value: profile.resumeText },
    { name: "aboutMe", value: profile.aboutMe },
  ];

  for (const { name, value } of fieldsToProcess) {
    const fieldWeight = fieldWeights[name];
    const tokens = tokenize(value);

    for (const token of tokens) {
      const keywordWeight = globalKeywordIDF[token] ?? 0.2; // default for unknown terms
      const score = fieldWeight * keywordWeight;

      // Keep max score if keyword appears in multiple fields
      vector[token] = Math.max(vector[token] || 0, score);
    }
  }

  return vector;
}

// Usage
const engineer: EngineerProfile = {
  title: "Senior Software Engineer",
  skills: ["TypeScript", "React", "Kubernetes"],
  resumeText: "Built React dashboards for Kubernetes monitoring at Stripe",
  aboutMe: "I love building great products with React"
};

const vector = buildWeightedVector(engineer);
console.log(vector);

// Output:
// {
//   "senior": 0.7,        // 1.0 × 0.7 (title)
//   "software": 0.1,      // 1.0 × 0.1 (title)
//   "engineer": 0.1,      // 1.0 × 0.1 (title)
//   "typescript": 0.54,   // 0.9 × 0.6 (skills)
//   "react": 0.36,        // 0.9 × 0.4 (skills, even though it appears elsewhere)
//   "kubernetes": 0.765,  // 0.9 × 0.85 (skills)
//   "built": 0.15,        // 0.5 × 0.3 (resumeText)
//   "stripe": 0.4,        // 0.5 × 0.8 (resumeText)
//   "dashboards": 0.1,    // 0.5 × 0.2 (resumeText, unknown term default)
//   "monitoring": 0.1,    // 0.5 × 0.2 (resumeText, unknown term default)
//   "love": 0.015,        // 0.3 × 0.05 (aboutMe)
//   "building": 0.06,     // 0.3 × 0.2 (aboutMe, unknown)
//   "great": 0.06,        // 0.3 × 0.2 (aboutMe, unknown)
//   "products": 0.06,     // 0.3 × 0.2 (aboutMe, unknown)
// }
```

---

## How This Connects to Matching

Now you can compute similarity between an engineer vector and a job posting vector:

```typescript
function cosineSimilarity(a: WeightedKeywordVector, b: WeightedKeywordVector): number {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const key of allKeys) {
    const valA = a[key] || 0;
    const valB = b[key] || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

The weights ensure that a match on "kubernetes" (high weight) contributes more to similarity than a match on "love" (near-zero weight).

---

## Key Insight

Aggarwal's "field weighting" is really about giving the same token different importance based on *where* it was found, which you then combine with how important that token is *globally*.
