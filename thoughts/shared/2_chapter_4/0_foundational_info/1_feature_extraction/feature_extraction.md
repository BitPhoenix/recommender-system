# Feature Extraction (Section 4.3.1)

Aggarwal distinguishes between two fundamentally different ways to represent item attributes.

## Two Approaches to Feature Representation

### 1. Bag of Keywords (Unstructured → Text Vectors)

This works when you have free-form text that needs to be converted into a searchable/comparable format. You extract words, weight them (TF-IDF, etc.), and create sparse vectors.

**In a talent marketplace:**

- **Engineer's resume:** Job descriptions, project summaries, "About Me" sections → extract terms like "distributed systems," "React," "led team of 5," "microservices migration"
- **Job posting text:** The prose description of the role → "We're looking for someone passionate about building scalable infrastructure..."
- **Interview transcripts:** Unstructured responses about past experiences

### 2. Multidimensional Structured Representation

This is necessary when attributes are:

- **Numerical** (continuous values where magnitude matters)
- **Categorical with small cardinality** (finite set of discrete options)

**In a talent marketplace:**

| Attribute | Type | Why Bag-of-Words Fails |
|-----------|------|------------------------|
| Salary preference | Numerical | "$150,000" isn't meaningfully similar to "$149,000" as keywords—you need numeric comparison |
| Years of experience | Numerical | "7 years" vs "8 years" need proximity scoring, not keyword matching |
| Location preference | Categorical (small) | "Remote" / "Hybrid" / "On-site" — treating these as keywords loses the semantic structure |
| Visa status | Categorical (small) | "US Citizen" / "Green Card" / "H1B" — finite options with specific meanings |
| Seniority level | Ordinal | "Junior" < "Mid" < "Senior" < "Staff" — ordering matters |
| Company size preference | Categorical | "Startup" / "Mid-size" / "Enterprise" |

## The Practical Hybrid

A talent marketplace naturally has both types, which means you need a combined representation:

```typescript
EngineerProfileVector = {
  // Structured fields (numerical/categorical)
  years_experience: 7,
  salary_min: 140000,
  salary_max: 180000,
  location: "hybrid",           // encoded categorically
  seniority: "senior",          // ordinal encoding
  visa_status: "us_citizen",

  // Bag-of-words from unstructured text
  skill_keywords: {
    "typescript": 0.85,
    "react": 0.72,
    "distributed_systems": 0.91,
    "team_lead": 0.65,
    // ...
  },

  // Behavioral/values from interviews (structured from unstructured)
  behavioral_scores: {
    "autonomy": 0.8,
    "mentorship": 0.7,
    "growth_mindset": 0.9,
    // ...
  }
}
```

## Why This Matters for Matching

**Bag-of-words alone fails for:**

- "Engineer wants $200K, job offers $120K" → keywords match ("salary," "compensation") but it's a terrible fit
- "Engineer wants remote, job is on-site in NYC" → you need constraint satisfaction, not text similarity

**Structured alone fails for:**

- Understanding what kind of TypeScript work they've done
- Capturing nuance like "built observability platform from scratch" vs "maintained existing dashboards"

This is exactly why Eightfold's approach uses three steps:
1. **Semantic embeddings** for the unstructured understanding
2. **Structured features** for the hard constraints and comparable attributes
3. **Explainable inference** to combine them

## Neo4j Advantage

A knowledge graph naturally handles the structured representation well—nodes with typed properties, relationships with cardinality. The interesting design question is: where do you put the bag-of-words representation?

**Options:**

1. **Vector index in Neo4j** (they support this now) for the text embeddings
2. **Separate vector store** (Pinecone, etc.) with Neo4j IDs as foreign keys
3. **Hybrid queries** that filter on structured constraints first (Cypher), then rank by text similarity
