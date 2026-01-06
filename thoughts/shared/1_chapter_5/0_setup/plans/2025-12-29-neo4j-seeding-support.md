# Neo4j Seeding Support Implementation Plan

## Overview

Add seeding support to the recommender_system project with upsert behavior, automatic Tilt triggering on file changes, Kubernetes Job execution, and category-based selective seeding.

## Current State Analysis

**Existing Implementation:**
- `seeds/seed.ts` uses CREATE statements (not idempotent)
- `clearDatabase()` wipes all data before each seed run
- No Tilt integration - seeds run manually via `npm run seed`
- 20+ seed functions for Skills, Engineers, Stories, Assessments

**Key Constraints:**
- Seeds must execute inside Kubernetes cluster (K8s Job)
- Tilt must watch seed files and trigger re-runs automatically
- Must support running selective categories

### Key Discoveries:
- `seeds/seed.ts:16-19` - clearDatabase() must be removed for upsert
- `seeds/seed.ts:47-418` - All 20 seed functions use CREATE (need MERGE)
- `Tiltfile:14-27` - Neo4j already configured with port forwards
- `helm_charts/recommender-api/` - Provides Helm chart patterns to follow

## Desired End State

1. Modifying any seed data file triggers automatic re-seeding via Tilt
2. Database updates incrementally using MERGE (no full wipe)
3. Seeds execute inside Kubernetes cluster as a Job
4. Category-based execution: `SEED_CATEGORIES=skills,engineers`
5. Seed job visible in Tilt UI with logs

### How to Verify:
- Modify a seed file → Job re-runs automatically
- Run seed twice → No duplicate nodes
- Check Tilt UI → neo4j-seed resource shows success

## What We're NOT Doing

- File-level incremental detection (always runs all seeds in category)
- Seed versioning or rollback
- Production seed automation
- Deletion of removed seed data (only upserts)

## Implementation Approach

Convert CREATE to MERGE for idempotency, containerize seeds with Dockerfile, create Helm chart for K8s Job, integrate with Tilt using local_resource for file watching.

---

## Phase 1: Convert seed.ts to MERGE (Upsert Pattern)

### Overview
Convert all CREATE statements to MERGE for idempotent upserts and add category-based execution support.

### Changes Required:

#### 1. Add Category Configuration
**File**: `seeds/seed.ts`
**Changes**: Add after line 10

```typescript
// Category definitions
type SeedCategory = 'skills' | 'engineers' | 'stories' | 'assessments' | 'all';

const SEED_CATEGORIES = (process.env.SEED_CATEGORIES?.split(',') || ['all']) as SeedCategory[];

function shouldSeedCategory(category: SeedCategory): boolean {
  return SEED_CATEGORIES.includes('all') || SEED_CATEGORIES.includes(category);
}
```

#### 2. Remove clearDatabase()
**File**: `seeds/seed.ts`
**Changes**:
- Delete function at lines 16-19
- Delete invocation at line 437

#### 3. Convert seedSkills() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 51-66

```typescript
await session.run(
  `MERGE (s:Skill {id: $id})
   ON CREATE SET
     s.name = $name,
     s.skillType = $skillType,
     s.isCategory = $isCategory,
     s.description = $description
   ON MATCH SET
     s.name = $name,
     s.skillType = $skillType,
     s.isCategory = $isCategory,
     s.description = $description`,
  {
    id: skill.id,
    name: skill.name,
    skillType: skill.skillType,
    isCategory: skill.isCategory,
    description: skill.description || null,
  }
);
```

#### 4. Convert seedSkillHierarchy() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 75-83 (change CREATE to MERGE)

```typescript
await session.run(
  `MATCH (child:Skill {id: $childId})
   MATCH (parent:Skill {id: $parentId})
   MERGE (child)-[:CHILD_OF]->(parent)`,
  {
    childId: rel.childSkillId,
    parentId: rel.parentSkillId,
  }
);
```

#### 5. Convert seedSkillCorrelations() to MERGE with properties
**File**: `seeds/seed.ts`
**Changes**: Replace lines 92-105

```typescript
await session.run(
  `MATCH (from:Skill {id: $fromId})
   MATCH (to:Skill {id: $toId})
   MERGE (from)-[r:CORRELATES_WITH]->(to)
   ON CREATE SET r.strength = $strength, r.correlationType = $correlationType
   ON MATCH SET r.strength = $strength, r.correlationType = $correlationType`,
  {
    fromId: corr.fromSkillId,
    toId: corr.toSkillId,
    strength: corr.strength,
    correlationType: corr.correlationType,
  }
);
```

#### 6. Convert seedEngineers() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 114-127

```typescript
await session.run(
  `MERGE (e:Engineer {id: $id})
   ON CREATE SET
     e.name = $name, e.email = $email, e.headline = $headline,
     e.hourlyRate = $hourlyRate, e.yearsExperience = $yearsExperience,
     e.availability = $availability, e.timezone = $timezone,
     e.createdAt = datetime($createdAt)
   ON MATCH SET
     e.name = $name, e.email = $email, e.headline = $headline,
     e.hourlyRate = $hourlyRate, e.yearsExperience = $yearsExperience,
     e.availability = $availability, e.timezone = $timezone`,
  eng
);
```

#### 7. Convert seedManagers() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 136-146

```typescript
await session.run(
  `MERGE (m:EngineeringManager {id: $id})
   ON CREATE SET
     m.name = $name, m.email = $email, m.company = $company,
     m.title = $title, m.createdAt = datetime($createdAt)
   ON MATCH SET
     m.name = $name, m.email = $email, m.company = $company, m.title = $title`,
  mgr
);
```

#### 8. Convert seedEngineerSkills() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 155-168

```typescript
await session.run(
  `MATCH (e:Engineer {id: $engineerId})
   MATCH (s:Skill {id: $skillId})
   MERGE (es:EngineerSkill {id: $id})
   ON CREATE SET
     es.proficiencyLevel = $proficiencyLevel, es.yearsUsed = $yearsUsed,
     es.confidenceScore = $confidenceScore, es.lastValidated = datetime($lastValidated)
   ON MATCH SET
     es.proficiencyLevel = $proficiencyLevel, es.yearsUsed = $yearsUsed,
     es.confidenceScore = $confidenceScore, es.lastValidated = datetime($lastValidated)
   MERGE (e)-[:HAS]->(es)
   MERGE (es)-[:FOR]->(s)`,
  es
);
```

#### 9. Convert seedInterviewStories() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 177-192

```typescript
await session.run(
  `MATCH (e:Engineer {id: $engineerId})
   MERGE (s:InterviewStory {id: $id})
   ON CREATE SET
     s.interviewId = $interviewId, s.questionPrompt = $questionPrompt,
     s.situation = $situation, s.task = $task, s.action = $action,
     s.result = $result, s.durationSeconds = $durationSeconds,
     s.createdAt = datetime($createdAt)
   ON MATCH SET
     s.interviewId = $interviewId, s.questionPrompt = $questionPrompt,
     s.situation = $situation, s.task = $task, s.action = $action,
     s.result = $result, s.durationSeconds = $durationSeconds
   MERGE (e)-[:TOLD]->(s)`,
  story
);
```

#### 10. Convert seedStoryAnalyses() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 201-216

```typescript
await session.run(
  `MATCH (s:InterviewStory {id: $storyId})
   MERGE (a:StoryAnalysis {id: $id})
   ON CREATE SET
     a.analyzerModel = $analyzerModel, a.analyzedAt = datetime($analyzedAt),
     a.clarityScore = $clarityScore, a.impactScore = $impactScore,
     a.ownershipScore = $ownershipScore, a.overallScore = $overallScore,
     a.reasoning = $reasoning, a.flags = $flags
   ON MATCH SET
     a.analyzerModel = $analyzerModel, a.clarityScore = $clarityScore,
     a.impactScore = $impactScore, a.ownershipScore = $ownershipScore,
     a.overallScore = $overallScore, a.reasoning = $reasoning, a.flags = $flags
   MERGE (s)-[:ANALYZED_BY]->(a)`,
  analysis
);
```

#### 11. Convert seedStoryDemonstrations() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 225-232

```typescript
await session.run(
  `MATCH (s:InterviewStory {id: $storyId})
   MATCH (skill:Skill {id: $skillId})
   MERGE (s)-[r:DEMONSTRATES]->(skill)
   ON CREATE SET r.strength = $strength, r.notes = $notes
   ON MATCH SET r.strength = $strength, r.notes = $notes`,
  demo
);
```

#### 12. Convert seedAssessments() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 242-251

```typescript
await session.run(
  `MERGE (a:Assessment {id: $id})
   ON CREATE SET
     a.name = $name, a.assessmentType = $assessmentType,
     a.description = $description, a.totalQuestions = $totalQuestions,
     a.createdAt = datetime($createdAt)
   ON MATCH SET
     a.name = $name, a.assessmentType = $assessmentType,
     a.description = $description, a.totalQuestions = $totalQuestions`,
  assess
);
```

#### 13. Convert seedAssessmentQuestions() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 261-271

```typescript
await session.run(
  `MATCH (a:Assessment {id: $assessmentId})
   MERGE (q:AssessmentQuestion {id: $id})
   ON CREATE SET
     q.questionNumber = $questionNumber, q.summary = $summary,
     q.maxScore = $maxScore, q.evaluationCriteria = $evaluationCriteria
   ON MATCH SET
     q.questionNumber = $questionNumber, q.summary = $summary,
     q.maxScore = $maxScore, q.evaluationCriteria = $evaluationCriteria
   MERGE (a)-[:CONTAINS]->(q)`,
  q
);
```

#### 14. Convert seedQuestionSkillTests() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 281-285

```typescript
await session.run(
  `MATCH (q:AssessmentQuestion {id: $questionId})
   MATCH (s:Skill {id: $skillId})
   MERGE (q)-[r:TESTS]->(s)
   ON CREATE SET r.weight = $weight
   ON MATCH SET r.weight = $weight`,
  test
);
```

#### 15. Convert seedAssessmentAttempts() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 295-307

```typescript
await session.run(
  `MATCH (e:Engineer {id: $engineerId})
   MATCH (a:Assessment {id: $assessmentId})
   MERGE (att:AssessmentAttempt {id: $id})
   ON CREATE SET
     att.startedAt = datetime($startedAt), att.completedAt = datetime($completedAt),
     att.overallScore = $overallScore, att.overallFeedback = $overallFeedback
   ON MATCH SET
     att.startedAt = datetime($startedAt), att.completedAt = datetime($completedAt),
     att.overallScore = $overallScore, att.overallFeedback = $overallFeedback
   MERGE (e)-[:ATTEMPTED]->(att)
   MERGE (att)-[:OF]->(a)`,
  attempt
);
```

#### 16. Convert seedQuestionPerformances() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 317-329

```typescript
await session.run(
  `MATCH (att:AssessmentAttempt {id: $attemptId})
   MATCH (q:AssessmentQuestion {id: $questionId})
   MERGE (p:QuestionPerformance {id: $id})
   ON CREATE SET
     p.score = $score, p.technicalDepth = $technicalDepth,
     p.feedback = $feedback, p.evaluatedAt = datetime($evaluatedAt)
   ON MATCH SET
     p.score = $score, p.technicalDepth = $technicalDepth,
     p.feedback = $feedback, p.evaluatedAt = datetime($evaluatedAt)
   MERGE (att)-[:INCLUDES]->(p)
   MERGE (p)-[:FOR_QUESTION]->(q)`,
  perf
);
```

#### 17. Convert seedCertifications() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 339-350

```typescript
await session.run(
  `MERGE (c:Certification {id: $id})
   ON CREATE SET
     c.name = $name, c.issuingOrg = $issuingOrg,
     c.issueDate = datetime($issueDate), c.expiryDate = datetime($expiryDate),
     c.verificationUrl = $verificationUrl, c.verified = $verified
   ON MATCH SET
     c.name = $name, c.issuingOrg = $issuingOrg,
     c.issueDate = datetime($issueDate), c.expiryDate = datetime($expiryDate),
     c.verificationUrl = $verificationUrl, c.verified = $verified`,
  cert
);
```

#### 18. Convert seedCertificationValidations() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 359-363

```typescript
await session.run(
  `MATCH (c:Certification {id: $certificationId})
   MATCH (s:Skill {id: $skillId})
   MERGE (c)-[:VALIDATES]->(s)`,
  val
);
```

#### 19. Convert seedEngineerCertifications() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 373-377

```typescript
await session.run(
  `MATCH (e:Engineer {id: $engineerId})
   MATCH (c:Certification {id: $certificationId})
   MERGE (e)-[:HOLDS]->(c)`,
  ec
);
```

#### 20. Convert seedSkillEvidence() to MERGE
**File**: `seeds/seed.ts`
**Changes**: Replace lines 402-414

```typescript
await session.run(
  `MATCH (es:EngineerSkill {id: $engineerSkillId})
   MATCH (ev:${evidenceLabel} {id: $evidenceId})
   MERGE (es)-[r:EVIDENCED_BY]->(ev)
   ON CREATE SET r.relevanceScore = $relevanceScore, r.isPrimary = $isPrimary
   ON MATCH SET r.relevanceScore = $relevanceScore, r.isPrimary = $isPrimary`,
  {
    engineerSkillId: ev.engineerSkillId,
    evidenceId: ev.evidenceId,
    relevanceScore: ev.relevanceScore,
    isPrimary: ev.isPrimary,
  }
);
```

#### 21. Update main seed() function
**File**: `seeds/seed.ts`
**Changes**: Replace seed() function (lines 424-486)

```typescript
async function seed(): Promise<void> {
  console.log('Starting Neo4j seed process...\n');
  console.log(`   URI: ${NEO4J_URI}`);
  console.log(`   User: ${NEO4J_USER}`);
  console.log(`   Categories: ${SEED_CATEGORIES.join(', ')}\n`);

  const driver: Driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );

  const session: Session = driver.session();

  try {
    await createConstraints(session);

    if (shouldSeedCategory('skills')) {
      await seedSkills(session);
      await seedSkillHierarchy(session);
      await seedSkillCorrelations(session);
    }

    if (shouldSeedCategory('engineers')) {
      await seedEngineers(session);
      await seedManagers(session);
      await seedEngineerSkills(session);
    }

    if (shouldSeedCategory('stories')) {
      await seedInterviewStories(session);
      await seedStoryAnalyses(session);
      await seedStoryDemonstrations(session);
    }

    if (shouldSeedCategory('assessments')) {
      await seedAssessments(session);
      await seedAssessmentQuestions(session);
      await seedQuestionSkillTests(session);
      await seedAssessmentAttempts(session);
      await seedQuestionPerformances(session);
      await seedCertifications(session);
      await seedCertificationValidations(session);
      await seedEngineerCertifications(session);
      await seedSkillEvidence(session);
    }

    console.log('\nSeed completed successfully!');

    const result = await session.run(`
      MATCH (n)
      RETURN labels(n)[0] as label, count(n) as count
      ORDER BY count DESC
    `);

    console.log('\nDatabase summary:');
    result.records.forEach(record => {
      console.log(`   ${record.get('label')}: ${record.get('count')}`);
    });

  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `cd seeds && npm run build`
- [x] Seed runs locally: `npm run seed`
- [x] Category filtering works: `SEED_CATEGORIES=skills npm run seed`

#### Manual Verification:
- [x] Run seed twice, verify node counts unchanged in Neo4j Browser
- [ ] Modify a skill name, re-run seed, verify update applied

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Create Dockerfile for Seeds

### Overview
Containerize the seed script for Kubernetes Job execution.

### Changes Required:

#### 1. Create Dockerfile
**File**: `seeds/Dockerfile` (new file)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY seeds/package*.json ./
RUN npm ci

COPY seeds/ ./
RUN npm run build

CMD ["node", "dist/seed.js"]
```

#### 2. Verify tsconfig.json
**File**: `seeds/tsconfig.json`
**Changes**: Ensure outDir is set correctly

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "module": "commonjs",
    "target": "ES2020",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Success Criteria:

#### Automated Verification:
- [x] Docker builds successfully: `docker build -f seeds/Dockerfile -t neo4j-seed .`
- [x] Container runs with port-forward: `docker run -e NEO4J_URI=bolt://host.docker.internal:7687 neo4j-seed`

#### Manual Verification:
- [x] Seed completes successfully in container logs

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Create Helm Chart for Seed Job

### Overview
Create Kubernetes Job configuration for running seeds in the cluster.

### Changes Required:

#### 1. Create Chart.yaml
**File**: `helm_charts/neo4j-seed/Chart.yaml` (new file)

```yaml
apiVersion: v2
name: neo4j-seed
description: Neo4j database seeding job
type: application
version: 0.1.0
appVersion: "1.0"
```

#### 2. Create values.yaml
**File**: `helm_charts/neo4j-seed/values.yaml` (new file)

```yaml
image:
  repository: neo4j-seed
  tag: latest
  pullPolicy: IfNotPresent

neo4j:
  uri: "bolt://neo4j-db:7687"
  user: "neo4j"
  password: "password"

seed:
  categories: "all"

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi

backoffLimit: 3
ttlSecondsAfterFinished: 300
activeDeadlineSeconds: 600
```

#### 3. Create values.dev.yaml
**File**: `helm_charts/neo4j-seed/values.dev.yaml` (new file)

```yaml
image:
  pullPolicy: Never

neo4j:
  uri: "bolt://neo4j-db.recommender.svc.cluster.local:7687"

ttlSecondsAfterFinished: 60
```

#### 4. Create _helpers.tpl
**File**: `helm_charts/neo4j-seed/templates/_helpers.tpl` (new file)

```yaml
{{- define "neo4j-seed.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "neo4j-seed.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "neo4j-seed.labels" -}}
app.kubernetes.io/name: {{ include "neo4j-seed.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
```

#### 5. Create job.yaml
**File**: `helm_charts/neo4j-seed/templates/job.yaml` (new file)

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "neo4j-seed.fullname" . }}-{{ now | date "20060102-150405" }}
  labels:
    {{- include "neo4j-seed.labels" . | nindent 4 }}
    app: neo4j-seed
spec:
  ttlSecondsAfterFinished: {{ .Values.ttlSecondsAfterFinished }}
  activeDeadlineSeconds: {{ .Values.activeDeadlineSeconds }}
  backoffLimit: {{ .Values.backoffLimit }}
  template:
    metadata:
      labels:
        app: neo4j-seed
    spec:
      restartPolicy: Never
      containers:
        - name: seed
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          env:
            - name: NEO4J_URI
              value: {{ .Values.neo4j.uri | quote }}
            - name: NEO4J_USER
              value: {{ .Values.neo4j.user | quote }}
            - name: NEO4J_PASSWORD
              value: {{ .Values.neo4j.password | quote }}
            - name: SEED_CATEGORIES
              value: {{ .Values.seed.categories | quote }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

### Success Criteria:

#### Automated Verification:
- [x] Helm lint passes: `helm lint helm_charts/neo4j-seed`
- [x] Template renders: `helm template neo4j-seed helm_charts/neo4j-seed`

#### Manual Verification:
- [x] Job YAML looks correct with proper env vars

**Implementation Note**: After completing this phase, pause for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Tilt Integration

### Overview
Add file watching and automatic job triggering to Tiltfile.

### Changes Required:

#### 1. Add seed job to Tiltfile
**File**: `Tiltfile`
**Changes**: Add after neo4j-db section (after line 27), before recommender-api section

```python
# ============================================
# Neo4j Seed Job
# ============================================

docker_build(
    'neo4j-seed',
    context='.',
    dockerfile='seeds/Dockerfile',
    only=['seeds/'],
)

local_resource(
    'neo4j-seed',
    cmd='kubectl delete job -n recommender -l app=neo4j-seed --ignore-not-found && helm upgrade --install neo4j-seed helm_charts/neo4j-seed --namespace recommender --values helm_charts/neo4j-seed/values.dev.yaml --set image.repository=neo4j-seed --set image.tag=latest --set image.pullPolicy=Never',
    deps=[
        'seeds/seed.ts',
        'seeds/skills.ts',
        'seeds/engineers.ts',
        'seeds/stories.ts',
        'seeds/assessments.ts',
        'seeds/types.ts',
        'seeds/index.ts',
    ],
    resource_deps=['neo4j-db'],
    labels=['recommender'],
    auto_init=True,
)
```

### Success Criteria:

#### Automated Verification:
- [x] Tilt starts without errors: `tilt up`
- [x] neo4j-seed resource appears in Tilt UI

#### Manual Verification:
- [x] Modify seeds/skills.ts → seed job re-runs
- [x] Job logs show successful completion
- [x] Neo4j Browser shows seeded data

---

## Testing Strategy

### Unit Tests:
- Category filtering: `SEED_CATEGORIES=skills npm run seed`
- Multiple categories: `SEED_CATEGORIES=skills,engineers npm run seed`
- All categories (default): `npm run seed`

### Integration Tests:
- Idempotency: Run seed twice, verify counts unchanged
- Upsert: Modify skill name, re-seed, verify update applied

### Manual Testing Steps:
1. Start Tilt: `tilt up`
2. Verify neo4j-seed job runs on startup
3. Modify `seeds/skills.ts` (add comment)
4. Verify seed job re-runs in Tilt UI
5. Check Neo4j Browser for correct data

## References

- Original research: `thoughts/shared/research/2025-12-29-neo4j-seeds-analysis.md`
- Current seed: `seeds/seed.ts`
- Helm patterns: `helm_charts/recommender-api/`
