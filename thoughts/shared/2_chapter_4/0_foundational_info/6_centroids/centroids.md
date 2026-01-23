# Centroids: Summarizing Sets of Vectors

A **centroid** is the average of a set of vectors - the "center point" that represents the entire set.

## The Basic Idea

Think of a centroid as the "center of mass" or "balance point" of a group of points. If you had physical objects at each point, the centroid is where you could balance them all on a pin.

## Simple 2D Example

Given three points:

```
Point A: [2, 4]
Point B: [4, 2]
Point C: [6, 6]
```

The centroid is calculated by averaging each dimension:

```
x-coordinate: (2 + 4 + 6) / 3 = 4
y-coordinate: (4 + 2 + 6) / 3 = 4

Centroid = [4, 4]
```

Visually:

```
    y
    6 |         C
    5 |
    4 | A    [*]        ← centroid at [4,4]
    3 |
    2 |     B
    1 |
      +------------------ x
        1  2  3  4  5  6
```

## Why Centroids Matter for Embeddings

When comparing skill sets between engineers, we face a problem: Engineer A might have 8 skills, Engineer B might have 15. How do we compare them?

**Option 1: Compare every skill pair**
- 8 × 15 = 120 comparisons
- Computationally expensive
- What single number summarizes the result?

**Option 2: Use centroids**
- Compute 1 centroid for each engineer's skills
- Compare 2 vectors (1 comparison)
- Fast and produces a single similarity score

## Centroid Calculation for Skill Embeddings

If an engineer has three skills, each represented as a 1024-dimensional embedding:

```
React:      [0.82, 0.15, 0.33, -0.21, 0.45, ...]  (1024 dimensions)
Vue:        [0.78, 0.22, 0.41, -0.18, 0.52, ...]
TypeScript: [0.65, 0.31, 0.28, -0.25, 0.38, ...]
```

The centroid averages each dimension independently:

```
Dimension 1: (0.82 + 0.78 + 0.65) / 3 = 0.75
Dimension 2: (0.15 + 0.22 + 0.31) / 3 = 0.227
Dimension 3: (0.33 + 0.41 + 0.28) / 3 = 0.34
...and so on for all 1024 dimensions

Centroid = [0.75, 0.227, 0.34, ...]
```

This single vector now represents the engineer's entire skill profile.

## Comparing Skill Profiles with Centroids

**Engineer A's skills:** React, Vue, TypeScript, Node.js
**Engineer B's skills:** Angular, React, JavaScript, Express, MongoDB

Instead of comparing all skill pairs:

1. Compute centroid A from Engineer A's skill embeddings
2. Compute centroid B from Engineer B's skill embeddings
3. Calculate cosine similarity between centroid A and centroid B

```
similarity = cosine(centroid_A, centroid_B)
```

If both engineers have frontend-heavy skills, their centroids will be in a similar region of the embedding space, resulting in high similarity.

## What the Centroid Represents

The centroid captures the "average meaning" of a skill set:

- **Frontend developer** (React, Vue, CSS, HTML) → centroid in "frontend region" of embedding space
- **Backend developer** (Node.js, PostgreSQL, Redis, Kafka) → centroid in "backend region"
- **Full-stack developer** (React, Node.js, PostgreSQL, TypeScript) → centroid somewhere between frontend and backend regions

```
Embedding Space (simplified to 2D)

                Backend
                   ↑
                   |
        Backend    |
        centroid ● |
                   |
    ───────────────┼───────────────→ Frontend
                   |          ● Frontend centroid
                   |
             ●     |
         Fullstack |
         centroid  |
```

## Trade-offs of the Centroid Approach

### Advantages

1. **Efficiency**: O(1) comparison instead of O(n×m)
2. **Simplicity**: Produces a single similarity score
3. **Handles different set sizes**: 5 skills vs 20 skills both become single vectors

### Disadvantages

1. **Information loss**: Individual skill matches are hidden
   - "Kafka matched RabbitMQ with 0.85 similarity" is lost
   - You just get an overall score

2. **Averaging can obscure outliers**:
   - An engineer with [React, Vue, Angular, PostgreSQL]
   - The PostgreSQL embedding gets "diluted" by averaging with three frontend skills
   - The centroid looks very frontend-heavy

3. **No explainability**:
   - Can't tell users "why" two profiles are similar
   - Just a number without breakdown

## When to Use Centroids

**Good fit:**
- You need a quick similarity score
- You'll combine it with other features in a scoring model
- Explainability will be added separately (e.g., Eightfold Phase 14)

**Poor fit:**
- You need to explain which specific skills matched
- Individual skill matches matter more than overall similarity
- You need precise matching (e.g., "must have Kubernetes experience")

## The Eightfold Approach

Eightfold uses centroids for skill similarity (Phase 4.3):

```python
# Aggregate candidate skills → single vector
candidate_skill_vector = mean([embed(s) for s in candidate.skills])

# Compare to job requirements
skill_similarity = cosine(candidate_skill_vector, job_skill_vector)
```

Explainability is deferred to Phase 14, where feature contributions are analyzed after the scoring model is built. The centroid approach produces a clean scalar feature that the model can learn to weight appropriately.

## Code Example

```typescript
function computeCentroid(vectors: number[][]): number[] {
  const dimensions = vectors[0].length;
  const centroid = new Array(dimensions).fill(0);

  // Sum all vectors
  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += vector[i];
    }
  }

  // Divide by count to get average
  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}
```

## Summary

| Concept | Description |
|---------|-------------|
| **Centroid** | The element-wise average of a set of vectors |
| **Purpose** | Summarize multiple embeddings into one representative vector |
| **Use case** | Comparing skill sets without O(n×m) pairwise comparisons |
| **Trade-off** | Efficiency vs. explainability |
| **In Eightfold** | Used in Phase 4.3 for skill similarity scoring |
