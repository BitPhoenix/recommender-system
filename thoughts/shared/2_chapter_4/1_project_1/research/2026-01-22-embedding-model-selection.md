---
date: 2026-01-22T12:00:00-05:00
researcher: Claude
git_commit: 3ba63a9d833ddd2f5b5b68837067160e5e63316b
branch: chapter-4-project-1
repository: recommender_system
topic: "Best free embedding model for Phase 2 dense embeddings on M3 Ultra"
tags: [research, embeddings, ollama, phase-2, m3-ultra, apple-silicon]
status: complete
last_updated: 2026-01-22
last_updated_by: Claude
---

# Research: Best Free Embedding Model for M3 Ultra Mac Studio

**Date**: 2026-01-22
**Researcher**: Claude
**Git Commit**: 3ba63a9d833ddd2f5b5b68837067160e5e63316b
**Branch**: chapter-4-project-1
**Repository**: recommender_system

## Research Question

For Phase 2 of the content-based resume filtering implementation, which free embedding model is best to run locally on an M3 Ultra Mac Studio with 96GB RAM via Ollama?

## Summary

**Primary Recommendation: `mxbai-embed-large`** - This model offers the best balance of performance, dimensions, and resource usage for your use case.

For semantic similarity of engineer profiles/resumes (English technical content), mxbai-embed-large provides:
- State-of-the-art performance (outperforms OpenAI text-embedding-3-large)
- 1024 dimensions (good semantic richness)
- Only 670MB (trivial for 96GB RAM)
- Fast inference on Apple Silicon

**Note:** The Phase 2 plan specifies `nomic-embed-text` with 768 dimensions, but mxbai-embed-large with 1024 dimensions would be a better choice based on MTEB benchmarks. Update the plan's vector index dimensions from 768 to 1024.

## Detailed Findings

### Ollama Embedding Models Comparison

| Model | Dimensions | Size | Context | MTEB Score | Best For |
|-------|------------|------|---------|------------|----------|
| **mxbai-embed-large** | 1024 | 670MB | 512 tokens | 64.68 | General-purpose, high quality |
| nomic-embed-text | 768 | 274MB | 8K tokens | 53.01 | Long documents, speed |
| snowflake-arctic-embed2 | MRL (128-1024) | 1.2GB | 8K tokens | ~63 | Multilingual, compression |
| bge-m3 | 1024 | 1.2GB | 8K tokens | 63.0 | Multilingual, hybrid retrieval |
| qwen3-embedding:4b | 32-4096 | 2.5GB | 40K tokens | **70.58** | Top MTEB, multilingual |
| all-minilm | 384 | 45MB | 512 tokens | ~50 | Minimal resources |

### Top Candidates Deep Dive

#### 1. mxbai-embed-large (Recommended)

**Specifications:**
- **Dimensions**: 1024 (fixed, with Matryoshka support down to 512)
- **Parameters**: 335M
- **Size**: 670MB
- **Context**: 512 tokens
- **License**: Apache 2.0

**Performance:**
- Outperforms OpenAI text-embedding-3-large on MTEB
- Matches performance of models 20x its size
- Trained on 700M+ pairs, fine-tuned on 30M+ triplets
- MTEB Retrieval Score: 64.68

**Why it fits your use case:**
- Engineer profiles (headline, skills, work history) typically fit within 512 tokens
- 1024 dimensions captures nuanced semantic relationships between technical skills
- Fast inference (sub-100ms on your M3 Ultra)
- Production-proven (6.7M+ downloads on Ollama)

#### 2. nomic-embed-text (Current Plan Default)

**Specifications:**
- **Dimensions**: 768 (variable 64-768 with Matryoshka)
- **Parameters**: 137M
- **Size**: 274MB
- **Context**: 8192 tokens

**Performance:**
- Surpasses OpenAI ada-002 and text-embedding-3-small
- MTEB Retrieval Score: 53.01
- Excels on long-context tasks

**Trade-offs:**
- Lower MTEB score than mxbai-embed-large (53.01 vs 64.68)
- Better for very long documents where 8K context matters
- Faster and smaller if resource constraints exist (not an issue with 96GB)

#### 3. Qwen3-Embedding:4b (Top MTEB Performer)

**Specifications:**
- **Dimensions**: Configurable 32-4096 (use 1024 for consistency)
- **Parameters**: 4B
- **Size**: 2.5GB
- **Context**: 40K tokens

**Performance:**
- #1 on MTEB multilingual leaderboard (70.58 score as of June 2025)
- 100+ language support
- Inherits Qwen3's multilingual and long-text understanding

**Trade-offs:**
- Newer model (less battle-tested)
- Larger size (still easy for M3 Ultra)
- Overkill context length for this use case

#### 4. bge-m3 (Hybrid Retrieval)

**Specifications:**
- **Dimensions**: 1024
- **Parameters**: 567M
- **Size**: 1.2GB
- **Context**: 8K tokens

**Unique Feature:**
- Supports dense, sparse, AND multi-vector retrieval in one model
- Could enable more sophisticated hybrid search in Phase 3

### Apple Silicon Considerations

Your M3 Ultra with 96GB unified memory can easily handle any of these models:

| Model | Memory @ Inference | M3 Ultra Headroom |
|-------|-------------------|-------------------|
| mxbai-embed-large | ~1.5GB | 94.5GB free |
| qwen3-embedding:8b | ~10GB | 86GB free |
| All models concurrently | ~15GB | 81GB free |

**MLX Framework Note:** While Ollama works well, Apple's MLX framework offers native Apple Silicon optimization. There's an `mlx-embedding-models` library that supports BERT/RoBERTa-based models with GPU acceleration. For maximum performance, you could use MLX directly, though Ollama's simplicity is valuable for development.

### Dimension Considerations for Neo4j

The Phase 2 plan creates a vector index with 768 dimensions. This should be updated:

```cypher
-- Current plan (for nomic-embed-text):
OPTIONS { indexConfig: { `vector.dimensions`: 768, ... } }

-- Recommended (for mxbai-embed-large):
OPTIONS { indexConfig: { `vector.dimensions`: 1024, ... } }
```

Higher dimensions generally capture more semantic nuance but increase storage. With Neo4j's native vector indices:
- 768 dims = ~3KB per engineer
- 1024 dims = ~4KB per engineer

For 1000 engineers, the difference is only 1MB - negligible.

## Recommendations

### Primary: Use mxbai-embed-large

```bash
ollama pull mxbai-embed-large
```

Update `config.ts`:
```typescript
LLM_EMBEDDING_MODEL: process.env.LLM_EMBEDDING_MODEL || "mxbai-embed-large",
```

Update vector index dimension to 1024.

### Alternative: Qwen3-Embedding for Best Quality

If you want the absolute best embedding quality and don't mind slightly higher resource usage:

```bash
ollama pull qwen3-embedding:4b
```

Configure output dimension to 1024 for consistency with mxbai-embed-large if you want to switch between them.

### Keep nomic-embed-text as Fallback

For scenarios where:
- Resume text is very long (>512 tokens)
- Speed is critical
- You want the smallest model

## Code References

- `recommender_api/src/config.ts:19-22` - Current LLM configuration (no embedding model yet)
- `recommender_api/src/services/llm.service.ts` - Ollama client integration
- `thoughts/private/plans/2026-01-21-content-based-resume-filtering.md:2989` - Phase 2 specifies nomic-embed-text

## Open Questions

1. **Should we support multiple embedding models?** Could add an endpoint parameter to choose between models for A/B testing.

2. **Quantization:** mxbai-embed-large supports binary quantization (32x storage savings, 40x faster retrieval with 96% performance). Worth implementing if engineer count grows significantly.

3. **MLX vs Ollama:** For production, MLX might offer better M3 Ultra utilization. Worth benchmarking both.

## Sources

- [Ollama Embedding Models](https://ollama.com/search?c=embedding)
- [mxbai-embed-large on Ollama](https://ollama.com/library/mxbai-embed-large)
- [nomic-embed-text on Ollama](https://ollama.com/library/nomic-embed-text)
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)
- [Best Embedding Models 2026 - Elephas](https://elephas.app/blog/best-embedding-models)
- [Open Source Embedding Models - BentoML](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models)
- [MLX Transformers GitHub](https://github.com/ToluClassics/mlx-transformers)
- [Qwen3-Embedding on Ollama](https://ollama.com/library/qwen3-embedding)
