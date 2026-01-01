# Talent Marketplace Knowledge Graph

A Neo4j-based knowledge graph for an engineering talent marketplace, implementing concepts from Chapter 5 (Knowledge-Based Recommender Systems) of "Recommender Systems: The Textbook" by Charu Aggarwal.

## Schema Overview

### Core Entities

- **Skill** - Technical, behavioral, and domain knowledge skills with hierarchical taxonomy
- **Engineer** - Software engineers with profiles, rates, and availability
- **EngineeringManager** - Hiring managers who search for talent
- **UserSkill** - Junction entity connecting engineers to skills with proficiency and confidence scores

### Evidence Types

- **InterviewStory** - STAR-format stories from AI interviews
- **StoryAnalysis** - AI analysis of story quality
- **Assessment** - Reusable assessment templates (coding challenges, system design)
- **AssessmentQuestion** - Individual questions within assessments
- **AssessmentAttempt** - An engineer's attempt at an assessment
- **QuestionPerformance** - Performance on a specific question
- **Certification** - External certifications (AWS, CKA, etc.)

### Key Relationships

```
(:Engineer)-[:HAS]->(:UserSkill)-[:FOR]->(:Skill)
(:Skill)-[:CHILD_OF]->(:Skill)
(:Skill)-[:CORRELATES_WITH {strength, correlationType}]->(:Skill)
(:UserSkill)-[:EVIDENCED_BY {relevanceScore, isPrimary}]->(:Evidence)
(:InterviewStory)-[:DEMONSTRATES {strength}]->(:Skill)
(:InterviewStory)-[:ANALYZED_BY]->(:StoryAnalysis)
(:AssessmentQuestion)-[:TESTS {weight}]->(:Skill)
(:Engineer)-[:ATTEMPTED]->(:AssessmentAttempt)-[:OF]->(:Assessment)
(:AssessmentAttempt)-[:INCLUDES]->(:QuestionPerformance)-[:FOR_QUESTION]->(:AssessmentQuestion)
(:Certification)-[:VALIDATES]->(:Skill)
(:Engineer)-[:HOLDS]->(:Certification)
```

## Setup

### Prerequisites

- Node.js 18+
- Neo4j 5.x (local or cloud)

### Installation

```bash
npm install
```

### Configuration

Set environment variables:

```bash
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=your-password
```

### Seed the Database

```bash
npm run seed
```

This will:
1. Clear existing data
2. Create constraints and indexes
3. Seed all skills (technical, behavioral, domain knowledge)
4. Seed skill hierarchy and correlations
5. Seed 5 engineers with skills
6. Seed 1 engineering manager
7. Seed interview stories with AI analyses
8. Seed assessments with questions and performances
9. Seed certifications
10. Link all evidence to engineer skills

## Sample Data

### Engineers

| Name | Headline | Rate | Experience |
|------|----------|------|------------|
| Priya Sharma | Senior Backend Engineer, Fintech | $145/hr | 8 years |
| Marcus Chen | Full Stack Engineer, React & Node.js | $125/hr | 5 years |
| Sofia Rodriguez | Platform Engineer, Kubernetes & AWS | $160/hr | 7 years |
| James Okonkwo | Staff Engineer, Distributed Systems | $185/hr | 12 years |
| Emily Nakamura | Frontend Engineer, React & Design Systems | $115/hr | 4 years |

### Skill Categories

- **Technical**: Languages, Databases, Infrastructure, Design & Architecture, Engineering Practices
- **Behavioral**: Leadership, Communication, Problem Solving, Execution, Collaboration, Growth
- **Domain Knowledge**: Fintech, Healthcare, E-commerce, SaaS, Marketplaces

## Example Queries

### Find engineers with a skill (including children in hierarchy)

```cypher
MATCH (category:Skill {name: 'Backend'})<-[:CHILD_OF*0..]-(skill:Skill)
MATCH (eng:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(skill)
WHERE us.confidenceScore >= 0.7
RETURN eng.name, skill.name, us.proficiencyLevel, us.confidenceScore
ORDER BY us.confidenceScore DESC
```

### Get engineer's skills with their best evidence

```cypher
MATCH (eng:Engineer {id: 'eng_priya'})-[:HAS]->(us:UserSkill)-[:FOR]->(skill:Skill)
OPTIONAL MATCH (us)-[ev:EVIDENCED_BY {isPrimary: true}]->(evidence)
RETURN skill.name, skill.skillType, us.proficiencyLevel, us.confidenceScore,
       labels(evidence)[0] as evidenceType
```

### Find engineers with correlated skills

```cypher
MATCH (skill:Skill {name: 'React'})-[:CORRELATES_WITH]-(related:Skill)
MATCH (eng:Engineer)-[:HAS]->(us:UserSkill)-[:FOR]->(related)
WHERE us.confidenceScore >= 0.7
RETURN eng.name, collect(related.name) as correlatedSkills
```

### Stories that demonstrate a skill

```cypher
MATCH (skill:Skill {name: 'Technical Leadership'})<-[d:DEMONSTRATES]-(story:InterviewStory)
MATCH (story)-[:ANALYZED_BY]->(analysis:StoryAnalysis)
WHERE d.strength >= 0.8
RETURN story.situation, story.result, d.strength, analysis.overallScore
ORDER BY d.strength DESC
```

### Assessment performance for a skill

```cypher
MATCH (skill:Skill {name: 'System Design'})<-[t:TESTS]-(q:AssessmentQuestion)
MATCH (p:QuestionPerformance)-[:FOR_QUESTION]->(q)
MATCH (att:AssessmentAttempt)-[:INCLUDES]->(p)
MATCH (eng:Engineer)-[:ATTEMPTED]->(att)
RETURN eng.name, q.summary, p.score * t.weight as weightedScore, p.technicalDepth
ORDER BY weightedScore DESC
```

## Project Structure

```
src/
├── types.ts          # TypeScript type definitions
├── seed.ts           # Main seed script
└── data/
    ├── index.ts      # Data exports
    ├── skills.ts     # Skills, hierarchy, correlations
    ├── engineers.ts  # Engineers, managers, engineer skills
    ├── stories.ts    # Interview stories, analyses, demonstrations
    └── assessments.ts # Assessments, questions, performances, certs
```

## License

MIT
