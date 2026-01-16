# Vector Database Considerations for RAG

## Context

During planning for the Local LLM Integration (Project 2.5), we considered whether a vector database is needed for the RAG-enhanced conflict explanations. This document captures the analysis for future reference.

## Current Approach: Structured Data Retrieval

Our "RAG" implementation passes structured query results to the LLM:

```
Database statistics:
- Engineers at staff level: 15
- Minimum salary at staff level: $175,000
- Engineers at staff level within $100,000 budget: 0
```

This approach is:
- **Deterministic**: We know exactly what to query based on the conflict type
- **Structured**: Counts, min/max values, specific fields
- **Precise**: Cypher queries return exact matches

We're doing `SELECT COUNT(*) WHERE seniority = 'staff'`, not "find documents semantically similar to 'staff engineer salary expectations'".

## Why We Don't Need Vector Embeddings

Vector embeddings + similarity search solve a different problem: **"I have a natural language query and need to find semantically related content in a large unstructured corpus."**

Our data doesn't fit that pattern:
- **Structured engineer records** (name, seniority, salary, skills)
- **Explicit relationships** (HAS_SKILL with proficiency level)
- **Known constraint types** (seniority, budget, skills)

When a conflict occurs, we know *exactly* what statistics are relevant. There's no ambiguity requiring semantic search.

## When Vector Databases Would Be Useful

| Scenario | Why Vectors Help |
|----------|------------------|
| "Find engineers who've worked on problems like distributed caching" | Need to match project descriptions semantically, not keyword match |
| Search a knowledge base of 10,000 hiring decision write-ups | Find relevant past decisions similar to current situation |
| "What skills are similar to Kubernetes?" | Semantic similarity between skill descriptions |
| Engineer wrote "I built real-time data pipelines" - does this match "streaming architecture" skill? | Fuzzy matching of unstructured text |

## Future Use Cases That Would Require Vectors

If we later added these features, vector embeddings would become valuable:

1. **Unstructured engineer bios/summaries**
   - "Find engineers whose experience is similar to this job description"
   - Requires embedding job descriptions and engineer profiles

2. **Project descriptions**
   - "Find engineers who've worked on similar problems"
   - Semantic matching of project work to search criteria

3. **Skills taxonomy expansion**
   - User asked for "container orchestration" - find semantically similar skills like Kubernetes, Docker Swarm
   - Could improve skill matching beyond exact ID matches

4. **Historical hiring decisions**
   - "What did we recommend in similar past searches?"
   - Learn from past successful/unsuccessful recommendations

5. **Natural language search**
   - "Find a senior backend engineer who can mentor juniors and has startup experience"
   - Parse intent and match against unstructured data

## Recommendation

For Project 2.5 (conflict explanations): **No vector database needed.** Structured Cypher queries provide all necessary context.

For future features involving unstructured text or semantic similarity: Consider adding vector embeddings. Options include:
- Neo4j's native vector index (available in Neo4j 5.11+)
- Dedicated vector DB (Pinecone, Weaviate, Qdrant)
- Postgres with pgvector

## Related Documents

- Plan: `thoughts/shared/1_chapter_5/2.5_project_2.5/plans/2026-01-15-local-llm-integration-for-explanations.md`
