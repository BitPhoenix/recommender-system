---
paths:
  - "seeds/**"
---

# Seeding

**Seeding runs automatically via Tilt.** The `neo4j-seed` local_resource watches these files and triggers a rebuild/redeploy when any change:

```
seeds/seed.ts
seeds/skills.ts
seeds/engineers.ts
seeds/stories.ts
seeds/assessments.ts
seeds/resumes.ts
seeds/types.ts
seeds/index.ts
seeds/embeddings.ts
```

**Do not ask the user to run seeds manually.** After modifying seed files, verify the seed completed successfully by running Cypher queries against Neo4j:

```bash
# Example verification queries (run via curl or Neo4j browser at localhost:7474)
curl -X POST http://localhost:7474/db/neo4j/tx/commit \
  -H "Content-Type: application/json" \
  -d '{"statements": [{"statement": "MATCH (e:Engineer) RETURN count(e) AS total"}]}'
```

Common verification queries:
- `MATCH (e:Engineer) RETURN count(e)` - Count engineers
- `MATCH (s:Skill) RETURN count(s)` - Count skills
- `MATCH (e:Engineer {id: 'eng_james'}) RETURN e.timezone` - Check specific field
