import { Engineer, EngineerSkill, EngineeringManager } from '../types';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

// ============================================
// ENGINEERS
// ============================================

export const engineers: Engineer[] = [
  {
    id: 'eng_priya',
    name: 'Priya Sharma',
    email: 'priya.sharma@email.com',
    headline: 'Senior Backend Engineer | Fintech & Payments',
    hourlyRate: 145,
    yearsExperience: 8,
    availability: 'two_weeks',
    timezone: 'America/New_York',
    createdAt: daysAgo(180),
  },
  {
    id: 'eng_marcus',
    name: 'Marcus Chen',
    email: 'marcus.chen@email.com',
    headline: 'Full Stack Engineer | React & Node.js',
    hourlyRate: 125,
    yearsExperience: 5,
    availability: 'immediate',
    timezone: 'America/Los_Angeles',
    createdAt: daysAgo(90),
  },
  {
    id: 'eng_sofia',
    name: 'Sofia Rodriguez',
    email: 'sofia.rodriguez@email.com',
    headline: 'Platform Engineer | Kubernetes & AWS',
    hourlyRate: 160,
    yearsExperience: 7,
    availability: 'one_month',
    timezone: 'America/Chicago',
    createdAt: daysAgo(120),
  },
  {
    id: 'eng_james',
    name: 'James Okonkwo',
    email: 'james.okonkwo@email.com',
    headline: 'Staff Engineer | Distributed Systems',
    hourlyRate: 185,
    yearsExperience: 12,
    availability: 'two_weeks',
    timezone: 'Europe/London',
    createdAt: daysAgo(60),
  },
  {
    id: 'eng_emily',
    name: 'Emily Nakamura',
    email: 'emily.nakamura@email.com',
    headline: 'Frontend Engineer | React & Design Systems',
    hourlyRate: 115,
    yearsExperience: 4,
    availability: 'immediate',
    timezone: 'America/Los_Angeles',
    createdAt: daysAgo(45),
  },
];

// ============================================
// ENGINEERING MANAGER
// ============================================

export const managers: EngineeringManager[] = [
  {
    id: 'mgr_david',
    name: 'David Park',
    email: 'david.park@techcorp.com',
    company: 'TechCorp',
    title: 'Engineering Manager',
    createdAt: daysAgo(200),
  },
];

// ============================================
// ENGINEER SKILLS
// ============================================

export const engineerSkills: EngineerSkill[] = [
  // Priya - Senior Backend, Fintech focus
  { id: 'es_priya_typescript', engineerId: 'eng_priya', skillId: 'skill_typescript', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.92, lastValidated: daysAgo(10) },
  { id: 'es_priya_nodejs', engineerId: 'eng_priya', skillId: 'skill_nodejs', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.91, lastValidated: daysAgo(10) },
  { id: 'es_priya_postgresql', engineerId: 'eng_priya', skillId: 'skill_postgresql', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.88, lastValidated: daysAgo(10) },
  { id: 'es_priya_api_design', engineerId: 'eng_priya', skillId: 'skill_api_design', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.87, lastValidated: daysAgo(10) },
  { id: 'es_priya_system_design', engineerId: 'eng_priya', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(10) },
  { id: 'es_priya_microservices', engineerId: 'eng_priya', skillId: 'skill_microservices', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.84, lastValidated: daysAgo(10) },
  { id: 'es_priya_aws', engineerId: 'eng_priya', skillId: 'skill_aws', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(10) },
  { id: 'es_priya_kafka', engineerId: 'eng_priya', skillId: 'skill_kafka', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.75, lastValidated: daysAgo(10) },
  { id: 'es_priya_tech_leadership', engineerId: 'eng_priya', skillId: 'skill_tech_leadership', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(10) },
  { id: 'es_priya_mentorship', engineerId: 'eng_priya', skillId: 'skill_mentorship', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(10) },
  { id: 'es_priya_fintech', engineerId: 'eng_priya', skillId: 'skill_fintech', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(10) },

  // Marcus - Full Stack, React/Node focus
  { id: 'es_marcus_typescript', engineerId: 'eng_marcus', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(15) },
  { id: 'es_marcus_react', engineerId: 'eng_marcus', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(15) },
  { id: 'es_marcus_nextjs', engineerId: 'eng_marcus', skillId: 'skill_nextjs', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(15) },
  { id: 'es_marcus_nodejs', engineerId: 'eng_marcus', skillId: 'skill_nodejs', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(15) },
  { id: 'es_marcus_express', engineerId: 'eng_marcus', skillId: 'skill_express', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.77, lastValidated: daysAgo(15) },
  { id: 'es_marcus_postgresql', engineerId: 'eng_marcus', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.72, lastValidated: daysAgo(15) },
  { id: 'es_marcus_graphql', engineerId: 'eng_marcus', skillId: 'skill_graphql', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.74, lastValidated: daysAgo(15) },
  { id: 'es_marcus_docker', engineerId: 'eng_marcus', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.70, lastValidated: daysAgo(15) },
  { id: 'es_marcus_ownership', engineerId: 'eng_marcus', skillId: 'skill_ownership', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(15) },
  { id: 'es_marcus_learning', engineerId: 'eng_marcus', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(15) },
  { id: 'es_marcus_saas', engineerId: 'eng_marcus', skillId: 'skill_saas', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.75, lastValidated: daysAgo(15) },

  // Sofia - Platform/Infrastructure
  { id: 'es_sofia_kubernetes', engineerId: 'eng_sofia', skillId: 'skill_kubernetes', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.90, lastValidated: daysAgo(20) },
  { id: 'es_sofia_docker', engineerId: 'eng_sofia', skillId: 'skill_docker', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.92, lastValidated: daysAgo(20) },
  { id: 'es_sofia_aws', engineerId: 'eng_sofia', skillId: 'skill_aws', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.88, lastValidated: daysAgo(20) },
  { id: 'es_sofia_terraform', engineerId: 'eng_sofia', skillId: 'skill_terraform', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.86, lastValidated: daysAgo(20) },
  { id: 'es_sofia_helm', engineerId: 'eng_sofia', skillId: 'skill_helm', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(20) },
  { id: 'es_sofia_go', engineerId: 'eng_sofia', skillId: 'skill_go', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.75, lastValidated: daysAgo(20) },
  { id: 'es_sofia_python', engineerId: 'eng_sofia', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.78, lastValidated: daysAgo(20) },
  { id: 'es_sofia_monitoring', engineerId: 'eng_sofia', skillId: 'skill_monitoring', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(20) },
  { id: 'es_sofia_system_design', engineerId: 'eng_sofia', skillId: 'skill_system_design', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.76, lastValidated: daysAgo(20) },
  { id: 'es_sofia_debugging', engineerId: 'eng_sofia', skillId: 'skill_debugging', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.88, lastValidated: daysAgo(20) },
  { id: 'es_sofia_documentation', engineerId: 'eng_sofia', skillId: 'skill_documentation', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.80, lastValidated: daysAgo(20) },

  // James - Staff Engineer, Distributed Systems
  { id: 'es_james_distributed', engineerId: 'eng_james', skillId: 'skill_distributed', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.95, lastValidated: daysAgo(5) },
  { id: 'es_james_system_design', engineerId: 'eng_james', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.94, lastValidated: daysAgo(5) },
  { id: 'es_james_java', engineerId: 'eng_james', skillId: 'skill_java', proficiencyLevel: 'expert', yearsUsed: 12, confidenceScore: 0.92, lastValidated: daysAgo(5) },
  { id: 'es_james_spring', engineerId: 'eng_james', skillId: 'skill_spring', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_james_kafka', engineerId: 'eng_james', skillId: 'skill_kafka', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(5) },
  { id: 'es_james_event_driven', engineerId: 'eng_james', skillId: 'skill_event_driven', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.91, lastValidated: daysAgo(5) },
  { id: 'es_james_postgresql', engineerId: 'eng_james', skillId: 'skill_postgresql', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_james_kubernetes', engineerId: 'eng_james', skillId: 'skill_kubernetes', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.75, lastValidated: daysAgo(5) },
  { id: 'es_james_tech_leadership', engineerId: 'eng_james', skillId: 'skill_tech_leadership', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.92, lastValidated: daysAgo(5) },
  { id: 'es_james_mentorship', engineerId: 'eng_james', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_james_tradeoffs', engineerId: 'eng_james', skillId: 'skill_tradeoffs', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.90, lastValidated: daysAgo(5) },
  { id: 'es_james_decision_making', engineerId: 'eng_james', skillId: 'skill_decision_making', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_james_fintech', engineerId: 'eng_james', skillId: 'skill_fintech', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.78, lastValidated: daysAgo(5) },

  // Emily - Frontend, Design Systems
  { id: 'es_emily_react', engineerId: 'eng_emily', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(12) },
  { id: 'es_emily_typescript', engineerId: 'eng_emily', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(12) },
  { id: 'es_emily_nextjs', engineerId: 'eng_emily', skillId: 'skill_nextjs', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.76, lastValidated: daysAgo(12) },
  { id: 'es_emily_graphql', engineerId: 'eng_emily', skillId: 'skill_graphql', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(12) },
  { id: 'es_emily_unit_testing', engineerId: 'eng_emily', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(12) },
  { id: 'es_emily_attention_detail', engineerId: 'eng_emily', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.90, lastValidated: daysAgo(12) },
  { id: 'es_emily_cross_functional', engineerId: 'eng_emily', skillId: 'skill_cross_functional', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.82, lastValidated: daysAgo(12) },
  { id: 'es_emily_curiosity', engineerId: 'eng_emily', skillId: 'skill_curiosity', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(12) },
  { id: 'es_emily_ecommerce', engineerId: 'eng_emily', skillId: 'skill_ecommerce', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.75, lastValidated: daysAgo(12) },
];
