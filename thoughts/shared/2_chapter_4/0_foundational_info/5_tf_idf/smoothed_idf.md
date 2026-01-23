# Smoothed IDF

## Standard IDF Formula

```
idf(t) = log(N / df(t))
```

Where:
- N = total number of documents in the corpus
- df(t) = number of documents containing term t

## Problems with Standard IDF

1. **Division by zero**: If a term doesn't appear in any document (df=0), you get division by zero
2. **Zero IDF for universal terms**: If a term appears in ALL documents (df=N), you get `log(1) = 0`, completely eliminating that term's contribution

## Smoothed IDF Formula

```
idf(t) = log(N / (df(t) + 1)) + 1
```

This formula has two "+1" adjustments:

```
log(N / (df(t) + 1)) + 1
    └──────────────┘   └─┘
     Laplace smoothing  Floor shift
```

| Adjustment | Purpose |
|------------|---------|
| `df(t) + 1` | **Laplace smoothing** - prevents division by zero for unseen terms, and ensures terms appearing in all documents still get a small positive IDF |
| `+ 1` at end | **Floor shift** - ensures IDF is always >= 1, so even common terms contribute *something* to the score |

## Comparison

Example with 100 documents:

| Term appears in | Standard IDF | Smoothed IDF |
|-----------------|--------------|--------------|
| 0 docs | undefined (division by zero) | log(100/1) + 1 = 5.6 |
| 1 doc | log(100) = 4.6 | log(100/2) + 1 = 4.9 |
| 50 docs | log(2) = 0.69 | log(100/51) + 1 = 1.67 |
| 100 docs | log(1) = 0 | log(100/101) + 1 = 0.99 |

## Usage

This is the "smoothed IDF" variant commonly used in scikit-learn's `TfidfVectorizer` and similar libraries.

```typescript
const idf = Math.log(totalDocs / (docCount + 1)) + 1;
```
