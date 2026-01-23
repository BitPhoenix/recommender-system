# Dense vs Sparse Vector Representations

## The Core Difference

| Representation | Storage per entry | How meaning is encoded |
|----------------|-------------------|------------------------|
| **Dense** | Just the number | Position in array (index 0 = "react", index 1 = "python", etc.) |
| **Sparse** | Term + number | Explicitly stored with each value |

## Dense Vectors

In a dense vector, every dimension has an explicit value. Position encodes meaning - all vectors must agree that index 0 means "react", index 1 means "python", etc.

```typescript
// Both vectors must agree on what each position means
// Index: [0: "react", 1: "python", 2: "kubernetes", 3: "nodejs", ...]

const job = [0.8, 0, 0.5, 0, 0, 0, ...];      // 10,000 numbers
const dev = [0, 0.6, 0, 0.4, 0, 0, ...];      // 10,000 numbers
```

**Dot product is trivial** - just multiply corresponding positions:

```typescript
let sum = 0;
for (let i = 0; i < job.length; i++) {
  sum += job[i] * dev[i];
}
```

## Sparse Vectors

Sparse vectors only store non-zero entries. Each entry is a (term, weight) pair because there's no fixed position.

```typescript
// Each vector carries its own term labels
const job = { terms: ["react", "kubernetes"], weights: [0.8, 0.5] };
const dev = { terms: ["python", "nodejs"], weights: [0.6, 0.4] };
```

**The absence of a term IS the zero value.** If "react" isn't in the developer's `terms` array, it's implicitly 0.

### Cosine Similarity Formula

Cosine similarity measures the angle between two vectors:

```
                      A · B                    dot product of A and B
cosine(A, B) = ─────────────────── = ─────────────────────────────────────────
                ||A|| × ||B||         length of A  ×  length of B
```

The **dot product** (numerator) measures how much the vectors point in the same direction. Dividing by the lengths (denominator) normalizes for magnitude - so a document that mentions "react" 10 times isn't artificially more similar than one that mentions it twice.

### What is "Length" of a Vector?

The length (also called magnitude or norm) is the distance from the origin to the point the vector represents. For a 2D vector [3, 4], it's the hypotenuse of a right triangle:

```
        |
      4 |      * (3, 4)
        |    /|
        |   / |
        |  /  | 4
        | /   |
        |/____|_______
           3

length = √(3² + 4²) = √(9 + 16) = √25 = 5
```

This extends to any number of dimensions. For a vector with weights [w₁, w₂, w₃, ...]:

```
length = √(w₁² + w₂² + w₃² + ...)
```

This is called the **L2 norm** (or Euclidean norm). The "L2" just means we're squaring each value before summing - there are other norms (L1 sums absolute values) but L2 is most common for similarity.

```typescript
function calculateLength(weights: number[]): number {
  const sumOfSquares = weights.reduce((sum, w) => sum + w * w, 0);
  return Math.sqrt(sumOfSquares);
}

// Example
calculateLength([3, 4])       // √(9 + 16) = 5
calculateLength([0.8, 0.6])   // √(0.64 + 0.36) = √1 = 1
```

### What is "Normalizing" a Vector?

Normalizing means scaling a vector so its length becomes exactly 1, while preserving its direction. You divide each component by the length:

```
Original: [3, 4]           length = 5
Normalized: [3/5, 4/5] = [0.6, 0.8]    length = √(0.36 + 0.64) = √1 = 1
```

The vector still points in the same direction, but now has length 1. This is called a **unit vector**.

```typescript
function l2Normalize(weights: number[]): number[] {
  const length = calculateLength(weights);
  if (length === 0) return weights;
  return weights.map(w => w / length);
}

// Example
l2Normalize([3, 4])      // [0.6, 0.8]
l2Normalize([0.8, 0.6])  // [0.8, 0.6] - already length 1, unchanged
```

### Why Normalize to Length 1?

Look at the cosine similarity formula again:

```
cosine(A, B) = (A · B) / (||A|| × ||B||)
```

If both vectors are pre-normalized to length 1:

```
cosine(A, B) = (A · B) / (1 × 1) = A · B
```

**Cosine similarity becomes just the dot product.** The expensive denominator calculation disappears.

In practice, we normalize vectors once when building the index. Then every similarity calculation is just a dot product - no square roots needed at query time.

### Computing Dot Products with Sparse Vectors

Since sparse vectors don't share positional alignment, computing the dot product requires finding the **intersection of terms** present in both vectors.

**Naive approach:** For each term in vector A, scan all terms in vector B → O(n × m)

**Map approach:** Build a lookup map from one vector, then iterate the other → O(n + m)

```typescript
// Assumes vectors are already L2-normalized to length 1
function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  // Build map from b for O(1) lookups
  const bTermToWeight = new Map<string, number>();
  for (let i = 0; i < b.terms.length; i++) {
    bTermToWeight.set(b.terms[i], b.weights[i]);
  }

  // Iterate a's terms, look up in map
  let dotProduct = 0;
  for (let i = 0; i < a.terms.length; i++) {
    const bWeight = bTermToWeight.get(a.terms[i]);
    if (bWeight !== undefined) {
      dotProduct += a.weights[i] * bWeight;
    }
  }

  // Since vectors are pre-normalized, dot product = cosine similarity
  return dotProduct;
}
```

**Example:**

```
a: { terms: ["react", "typescript"], weights: [0.6, 0.8] }  // length = √(0.36 + 0.64) = 1 ✓
b: { terms: ["react", "nodejs"],     weights: [0.8, 0.6] }  // length = √(0.64 + 0.36) = 1 ✓

bTermToWeight = Map { "react" → 0.8, "nodejs" → 0.6 }

Iterate a's terms:
  "react"      → found in map → 0.6 × 0.8 = 0.48
  "typescript" → not in map   → skip (implicitly 0)

Result: 0.48 (only overlapping terms contribute to similarity)
```

### What About Missing Terms?

If a job description has "react" (0.8) but a developer doesn't have it at all:

```typescript
const job = { terms: ["react", "kubernetes"], weights: [0.8, 0.5] };
const dev = { terms: ["python", "java"], weights: [0.6, 0.4] };
```

The developer's sparse vector simply doesn't include "react" in its `terms` array. When we compute the dot product:

1. Build map from developer: `{ "python" → 0.6, "java" → 0.4 }`
2. Iterate job's terms:
   - "react" → not in map → skip (implicitly 0 × 0.8 = 0)
   - "kubernetes" → not in map → skip (implicitly 0 × 0.5 = 0)
3. Result: 0 (no overlap between job and developer)

The map lookup returning `undefined` is equivalent to the dimension being zero.

## When to Use Each

The choice depends on **how many zeros** your vectors typically have:

### Use Sparse: TF-IDF and Bag-of-Words

TF-IDF vectors are naturally sparse:
- Vocabulary might be 50,000 terms
- A single document uses maybe 200 unique words
- That's 99.6% zeros

```typescript
// Dense would waste space
const denseDoc = [0, 0, 0.5, 0, 0, 0.3, 0, 0, ...];  // 50,000 numbers, 99% zeros

// Sparse saves massive space
const sparseDoc = { terms: ["kubernetes", "docker"], weights: [0.5, 0.3] };
```

### Use Dense: Embeddings

Embedding vectors (from OpenAI, sentence transformers, etc.) are naturally dense:
- Fixed size, typically 768 or 1536 dimensions
- Every dimension has a non-zero floating point value
- There are no zeros to skip

```typescript
// Dense embedding - just use an array
const embedding = [0.023, -0.156, 0.892, ...];  // 768 values, position = dimension

// Sparse would be wasteful - storing 768 dimension labels for no benefit
const wastefulSparse = {
  terms: ["dim0", "dim1", "dim2", ... "dim767"],  // 768 labels we don't need
  weights: [0.023, -0.156, 0.892, ...]            // 768 values
};
```

With embeddings, every dimension is populated - there are no zeros to omit. Sparse representation would just add overhead (storing dimension names) without saving anything.

## Summary

| Aspect | Dense | Sparse |
|--------|-------|--------|
| Storage | Array of numbers | Array of (term, weight) pairs |
| Meaning encoded by | Position (index) | Explicit term label |
| Dot product | Simple loop over indices | Build map, find intersection |
| Best for | Embeddings (no zeros) | TF-IDF, BoW (mostly zeros) |
| Typical sparsity | 0% zeros | 95-99% zeros |
