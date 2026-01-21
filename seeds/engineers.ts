import {
  Engineer,
  UserSkill,
  EngineeringManager,
  EngineerBusinessDomainExperience,
  EngineerTechnicalDomainExperience,
} from './types';

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
    salary: 210000,
    yearsExperience: 8,
    startTimeline: 'two_weeks',
    timezone: 'Eastern',
    createdAt: daysAgo(180),
  },
  {
    id: 'eng_marcus',
    name: 'Marcus Chen',
    email: 'marcus.chen@email.com',
    headline: 'Full Stack Engineer | React & Node.js',
    salary: 155000,
    yearsExperience: 5,
    startTimeline: 'immediate',
    timezone: 'Pacific',
    createdAt: daysAgo(90),
  },
  {
    id: 'eng_sofia',
    name: 'Sofia Rodriguez',
    email: 'sofia.rodriguez@email.com',
    headline: 'Platform Engineer | Kubernetes & AWS',
    salary: 205000,
    yearsExperience: 7,
    startTimeline: 'three_months',
    timezone: 'Central',
    createdAt: daysAgo(120),
  },
  {
    id: 'eng_james',
    name: 'James Okonkwo',
    email: 'james.okonkwo@email.com',
    headline: 'Staff Engineer | Distributed Systems',
    salary: 295000,
    yearsExperience: 12,
    startTimeline: 'six_months',
    timezone: 'Eastern',
    createdAt: daysAgo(60),
  },
  {
    id: 'eng_emily',
    name: 'Emily Nakamura',
    email: 'emily.nakamura@email.com',
    headline: 'Frontend Engineer | React & Design Systems',
    salary: 140000,
    yearsExperience: 4,
    startTimeline: 'immediate',
    timezone: 'Pacific',
    createdAt: daysAgo(45),
  },

  // ============================================
  // Junior Engineers (0-3 years) — 6 new
  // ============================================
  {
    id: 'eng_maya',
    name: 'Maya Johnson',
    email: 'maya.johnson@email.com',
    headline: 'Frontend Engineer | React & TypeScript',
    salary: 95000,
    yearsExperience: 2,
    startTimeline: 'immediate',
    timezone: 'Eastern',
    createdAt: daysAgo(30),
  },
  {
    id: 'eng_kevin',
    name: 'Kevin Park',
    email: 'kevin.park@email.com',
    headline: 'Backend Engineer | Python & Django',
    salary: 105000,
    yearsExperience: 3,
    startTimeline: 'two_weeks',
    timezone: 'Pacific',
    createdAt: daysAgo(45),
  },
  {
    id: 'eng_jordan',
    name: 'Jordan Williams',
    email: 'jordan.williams@email.com',
    headline: 'Frontend Developer | React & Tailwind',
    salary: 90000,
    yearsExperience: 2,
    startTimeline: 'immediate',
    timezone: 'Central',
    createdAt: daysAgo(60),
  },
  {
    id: 'eng_carlos',
    name: 'Carlos Mendez',
    email: 'carlos.mendez@email.com',
    headline: 'Full Stack Developer | Node.js & React',
    salary: 85000,
    yearsExperience: 3,
    startTimeline: 'one_month',
    timezone: 'Mountain',
    createdAt: daysAgo(55),
  },
  {
    id: 'eng_ashley',
    name: 'Ashley Chen',
    email: 'ashley.chen@email.com',
    headline: 'Frontend Developer | Vue.js',
    salary: 88000,
    yearsExperience: 1,
    startTimeline: 'immediate',
    timezone: 'Pacific',
    createdAt: daysAgo(20),
  },
  {
    id: 'eng_tyler',
    name: 'Tyler Brooks',
    email: 'tyler.brooks@email.com',
    headline: 'Backend Developer | Java & Spring Boot',
    salary: 98000,
    yearsExperience: 3,
    startTimeline: 'two_weeks',
    timezone: 'Mountain',
    createdAt: daysAgo(35),
  },

  // ============================================
  // Mid-Level Engineers (4-5 years) — 8 new
  // ============================================

  // HIGH-PERFORMING MID-LEVEL: Ex-Stripe, senior-level React confidence
  {
    id: 'eng_rachel',
    name: 'Rachel Kim',
    email: 'rachel.kim@email.com',
    headline: 'Frontend Engineer | Ex-Stripe, React Performance',
    salary: 165000,
    yearsExperience: 5,
    startTimeline: 'two_weeks',
    timezone: 'Eastern',
    createdAt: daysAgo(45),
  },
  // HIGH-PERFORMING MID-LEVEL: Deep Go expertise from high-scale environment
  {
    id: 'eng_lisa',
    name: 'Lisa Wang',
    email: 'lisa.wang@email.com',
    headline: 'Backend Engineer | Ex-Cloudflare, Go & High-Scale Systems',
    salary: 160000,
    yearsExperience: 5,
    startTimeline: 'three_months',
    timezone: 'Pacific',
    createdAt: daysAgo(80),
  },
  // STARTUP GENERALIST: Broad skills, 0→1 experience
  {
    id: 'eng_zoe',
    name: 'Zoe Martinez',
    email: 'zoe.martinez@email.com',
    headline: 'Founding Engineer | 0→1 at Two YC Startups',
    salary: 155000,
    yearsExperience: 5,
    startTimeline: 'immediate',
    timezone: 'Pacific',
    createdAt: daysAgo(52),
  },
  // Standard mid-levels
  {
    id: 'eng_david',
    name: 'David Kim',
    email: 'david.kim@email.com',
    headline: 'Backend Engineer | Healthcare Systems & Python',
    salary: 145000,
    yearsExperience: 4,
    startTimeline: 'one_month',
    timezone: 'Pacific',
    createdAt: daysAgo(70),
  },
  {
    id: 'eng_mohammed',
    name: 'Mohammed Ali',
    email: 'mohammed.ali@email.com',
    headline: 'DevOps Engineer | Kubernetes & Terraform',
    salary: 140000,
    yearsExperience: 4,
    startTimeline: 'two_weeks',
    timezone: 'Central',
    createdAt: daysAgo(65),
  },
  {
    id: 'eng_aisha',
    name: 'Aisha Patel',
    email: 'aisha.patel@email.com',
    headline: 'ML Engineer | Healthcare & Python',
    salary: 150000,
    yearsExperience: 5,
    startTimeline: 'one_month',
    timezone: 'Central',
    createdAt: daysAgo(55),
  },
  {
    id: 'eng_ryan',
    name: 'Ryan Zhang',
    email: 'ryan.zhang@email.com',
    headline: 'Mobile Developer | React Native & Gaming',
    salary: 125000,
    yearsExperience: 4,
    startTimeline: 'two_weeks',
    timezone: 'Mountain',
    createdAt: daysAgo(48),
  },
  {
    id: 'eng_emma',
    name: 'Emma Wilson',
    email: 'emma.wilson@email.com',
    headline: 'Frontend Engineer | React & Design Systems',
    salary: 145000,
    yearsExperience: 5,
    startTimeline: 'immediate',
    timezone: 'Mountain',
    createdAt: daysAgo(35),
  },

  // ============================================
  // Senior Engineers (6-8 years) — 10 new
  // ============================================

  // COASTING SENIOR: Competent but not pushing boundaries
  {
    id: 'eng_greg',
    name: 'Greg Patterson',
    email: 'greg.patterson@email.com',
    headline: 'Senior Backend Engineer | Enterprise Java',
    salary: 155000,
    yearsExperience: 7,
    startTimeline: 'immediate',
    timezone: 'Central',
    createdAt: daysAgo(95),
  },
  // COASTING SENIOR: Comfortable, stable, not growing
  {
    id: 'eng_natasha',
    name: 'Natasha Williams',
    email: 'natasha.williams@email.com',
    headline: 'Senior Full Stack Engineer | EdTech',
    salary: 150000,
    yearsExperience: 8,
    startTimeline: 'immediate',
    timezone: 'Mountain',
    createdAt: daysAgo(80),
  },
  // BIG-TECH SPECIALIST: Deep expertise, narrow focus (renamed from Marcus Chen to avoid conflict)
  {
    id: 'eng_nathan',
    name: 'Nathan Chen',
    email: 'nathan.chen@email.com',
    headline: 'Ex-Meta Staff Engineer | Feed Ranking Infrastructure',
    salary: 210000,
    yearsExperience: 8,
    startTimeline: 'one_month',
    timezone: 'Pacific',
    createdAt: daysAgo(40),
  },
  // BIG-TECH SPECIALIST: Kafka/Spark depth from high-scale data team
  {
    id: 'eng_wei',
    name: 'Wei Chen',
    email: 'wei.chen@email.com',
    headline: 'Ex-Netflix Data Engineer | Real-Time Analytics at Scale',
    salary: 195000,
    yearsExperience: 8,
    startTimeline: 'one_month',
    timezone: 'Pacific',
    createdAt: daysAgo(85),
  },
  // STARTUP GENERALIST (Senior): Breadth, wore many hats
  {
    id: 'eng_derek',
    name: 'Derek Sullivan',
    email: 'derek.sullivan@email.com',
    headline: 'Head of Engineering (prev) | Seed to Series B',
    salary: 180000,
    yearsExperience: 7,
    startTimeline: 'two_weeks',
    timezone: 'Mountain',
    createdAt: daysAgo(38),
  },
  // Standard seniors
  {
    id: 'eng_takeshi',
    name: 'Takeshi Yamamoto',
    email: 'takeshi.yamamoto@email.com',
    headline: 'Senior Backend Engineer | Java & Distributed Systems',
    salary: 175000,
    yearsExperience: 7,
    startTimeline: 'two_weeks',
    timezone: 'Pacific',
    createdAt: daysAgo(90),
  },
  {
    id: 'eng_sarah',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    headline: 'Senior Frontend Engineer | React & Performance',
    salary: 165000,
    yearsExperience: 6,
    startTimeline: 'immediate',
    timezone: 'Eastern',
    createdAt: daysAgo(60),
  },
  {
    id: 'eng_ravi',
    name: 'Ravi Sharma',
    email: 'ravi.sharma@email.com',
    headline: 'Senior Full Stack Engineer | Healthcare Systems',
    salary: 170000,
    yearsExperience: 8,
    startTimeline: 'immediate',
    timezone: 'Central',
    createdAt: daysAgo(55),
  },
  {
    id: 'eng_olivia',
    name: 'Olivia Martinez',
    email: 'olivia.martinez@email.com',
    headline: 'Senior ML Engineer | NLP & Python',
    salary: 190000,
    yearsExperience: 7,
    startTimeline: 'two_weeks',
    timezone: 'Pacific',
    createdAt: daysAgo(70),
  },
  {
    id: 'eng_lucas',
    name: 'Lucas Thompson',
    email: 'lucas.thompson@email.com',
    headline: 'Senior Security Engineer | Cloud Security',
    salary: 185000,
    yearsExperience: 8,
    startTimeline: 'one_month',
    timezone: 'Eastern',
    createdAt: daysAgo(65),
  },

  // ============================================
  // Staff Engineers (9-11 years) — 8 new
  // ============================================

  // CRITICAL: Anika Patel unlocks the example query (Kafka + Kubernetes + 10 years + immediate)
  {
    id: 'eng_anika',
    name: 'Anika Patel',
    email: 'anika.patel@email.com',
    headline: 'Staff Platform Engineer | Kafka, Kubernetes & Distributed Systems',
    salary: 220000,
    yearsExperience: 10,
    startTimeline: 'immediate',
    timezone: 'Pacific',
    createdAt: daysAgo(100),
  },
  {
    id: 'eng_alex',
    name: 'Alex Rivera',
    email: 'alex.rivera@email.com',
    headline: 'Staff Backend Engineer | Java & System Design',
    salary: 210000,
    yearsExperience: 9,
    startTimeline: 'two_weeks',
    timezone: 'Eastern',
    createdAt: daysAgo(95),
  },
  {
    id: 'eng_dmitri',
    name: 'Dmitri Volkov',
    email: 'dmitri.volkov@email.com',
    headline: 'Staff ML Engineer | Deep Learning & MLOps',
    salary: 235000,
    yearsExperience: 10,
    startTimeline: 'one_month',
    timezone: 'Pacific',
    createdAt: daysAgo(88),
  },
  {
    id: 'eng_jennifer',
    name: 'Jennifer Park',
    email: 'jennifer.park@email.com',
    headline: 'Staff Frontend Engineer | React & Web Performance',
    salary: 200000,
    yearsExperience: 9,
    startTimeline: 'immediate',
    timezone: 'Central',
    createdAt: daysAgo(82),
  },
  {
    id: 'eng_michael',
    name: "Michael O'Connor",
    email: 'michael.oconnor@email.com',
    headline: 'Staff DevOps Engineer | AWS & Platform Engineering',
    salary: 215000,
    yearsExperience: 11,
    startTimeline: 'three_months',
    timezone: 'Mountain',
    createdAt: daysAgo(110),
  },
  {
    id: 'eng_sanjay',
    name: 'Sanjay Gupta',
    email: 'sanjay.gupta@email.com',
    headline: 'Staff Data Engineer | Spark & Real-time Systems',
    salary: 225000,
    yearsExperience: 10,
    startTimeline: 'two_weeks',
    timezone: 'Mountain',
    createdAt: daysAgo(92),
  },
  {
    id: 'eng_christine',
    name: 'Christine Kim',
    email: 'christine.kim@email.com',
    headline: 'Staff Full Stack Engineer | Healthcare & Fintech',
    salary: 205000,
    yearsExperience: 9,
    startTimeline: 'one_month',
    timezone: 'Pacific',
    createdAt: daysAgo(78),
  },
  {
    id: 'eng_hassan',
    name: 'Hassan Ahmed',
    email: 'hassan.ahmed@email.com',
    headline: 'Staff Security Engineer | AppSec & Cloud Security',
    salary: 230000,
    yearsExperience: 11,
    startTimeline: 'immediate',
    timezone: 'Eastern',
    createdAt: daysAgo(105),
  },

  // ============================================
  // Principal Engineers (12+ years) — 3 new
  // ============================================

  {
    id: 'eng_victoria',
    name: 'Victoria Chang',
    email: 'victoria.chang@email.com',
    headline: 'Principal Architect | Distributed Systems & Cloud',
    salary: 285000,
    yearsExperience: 14,
    startTimeline: 'three_months',
    timezone: 'Pacific',
    createdAt: daysAgo(150),
  },
  {
    id: 'eng_robert',
    name: 'Robert Mitchell',
    email: 'robert.mitchell@email.com',
    headline: 'Principal ML Architect | AI Systems & Strategy',
    salary: 320000,
    yearsExperience: 15,
    startTimeline: 'six_months',
    timezone: 'Eastern',
    createdAt: daysAgo(180),
  },
  {
    id: 'eng_elena',
    name: 'Elena Rodriguez',
    email: 'elena.rodriguez@email.com',
    headline: 'Principal Security Architect | Enterprise Security',
    salary: 290000,
    yearsExperience: 12,
    startTimeline: 'three_months',
    timezone: 'Central',
    createdAt: daysAgo(160),
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
// USER SKILLS
// ============================================

export const userSkills: UserSkill[] = [
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

  // Emily - Frontend, Design Systems
  { id: 'es_emily_react', engineerId: 'eng_emily', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(12) },
  { id: 'es_emily_typescript', engineerId: 'eng_emily', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(12) },
  { id: 'es_emily_nextjs', engineerId: 'eng_emily', skillId: 'skill_nextjs', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.76, lastValidated: daysAgo(12) },
  { id: 'es_emily_graphql', engineerId: 'eng_emily', skillId: 'skill_graphql', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(12) },
  { id: 'es_emily_unit_testing', engineerId: 'eng_emily', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(12) },
  { id: 'es_emily_attention_detail', engineerId: 'eng_emily', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.90, lastValidated: daysAgo(12) },
  { id: 'es_emily_cross_functional', engineerId: 'eng_emily', skillId: 'skill_cross_functional', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.82, lastValidated: daysAgo(12) },
  { id: 'es_emily_curiosity', engineerId: 'eng_emily', skillId: 'skill_curiosity', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(12) },

  // ============================================
  // Junior Engineer Skills (0.65-0.82 confidence range)
  // ============================================

  // Maya - Frontend Junior (React focus, NYC)
  { id: 'es_maya_react', engineerId: 'eng_maya', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.78, lastValidated: daysAgo(8) },
  { id: 'es_maya_typescript', engineerId: 'eng_maya', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(8) },
  { id: 'es_maya_javascript', engineerId: 'eng_maya', skillId: 'skill_javascript', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.80, lastValidated: daysAgo(8) },
  { id: 'es_maya_nextjs', engineerId: 'eng_maya', skillId: 'skill_nextjs', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.65, lastValidated: daysAgo(8) },
  { id: 'es_maya_unit_testing', engineerId: 'eng_maya', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(8) },
  { id: 'es_maya_learning', engineerId: 'eng_maya', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 2, confidenceScore: 0.85, lastValidated: daysAgo(8) },
  { id: 'es_maya_curiosity', engineerId: 'eng_maya', skillId: 'skill_curiosity', proficiencyLevel: 'expert', yearsUsed: 2, confidenceScore: 0.82, lastValidated: daysAgo(8) },
  { id: 'es_maya_attention_detail', engineerId: 'eng_maya', skillId: 'skill_attention_detail', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.78, lastValidated: daysAgo(8) },

  // Kevin - Backend Junior (Python focus, LA)
  { id: 'es_kevin_python', engineerId: 'eng_kevin', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(12) },
  { id: 'es_kevin_django', engineerId: 'eng_kevin', skillId: 'skill_django', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(12) },
  { id: 'es_kevin_postgresql', engineerId: 'eng_kevin', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(12) },
  { id: 'es_kevin_docker', engineerId: 'eng_kevin', skillId: 'skill_docker', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.65, lastValidated: daysAgo(12) },
  { id: 'es_kevin_api_design', engineerId: 'eng_kevin', skillId: 'skill_api_design', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.68, lastValidated: daysAgo(12) },
  { id: 'es_kevin_unit_testing', engineerId: 'eng_kevin', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(12) },
  { id: 'es_kevin_ownership', engineerId: 'eng_kevin', skillId: 'skill_ownership', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(12) },
  { id: 'es_kevin_learning', engineerId: 'eng_kevin', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.85, lastValidated: daysAgo(12) },

  // Jordan - Frontend Junior (React + Tailwind, Chicago)
  { id: 'es_jordan_react', engineerId: 'eng_jordan', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.76, lastValidated: daysAgo(15) },
  { id: 'es_jordan_typescript', engineerId: 'eng_jordan', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.74, lastValidated: daysAgo(15) },
  { id: 'es_jordan_javascript', engineerId: 'eng_jordan', skillId: 'skill_javascript', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.78, lastValidated: daysAgo(15) },
  { id: 'es_jordan_attention_detail', engineerId: 'eng_jordan', skillId: 'skill_attention_detail', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.80, lastValidated: daysAgo(15) },
  { id: 'es_jordan_cross_functional', engineerId: 'eng_jordan', skillId: 'skill_cross_functional', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(15) },
  { id: 'es_jordan_learning', engineerId: 'eng_jordan', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 2, confidenceScore: 0.82, lastValidated: daysAgo(15) },

  // Carlos - Full Stack Junior (Node + React, Denver)
  { id: 'es_carlos_nodejs', engineerId: 'eng_carlos', skillId: 'skill_nodejs', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(18) },
  { id: 'es_carlos_react', engineerId: 'eng_carlos', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(18) },
  { id: 'es_carlos_mongodb', engineerId: 'eng_carlos', skillId: 'skill_mongodb', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(18) },
  { id: 'es_carlos_express', engineerId: 'eng_carlos', skillId: 'skill_express', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.74, lastValidated: daysAgo(18) },
  { id: 'es_carlos_javascript', engineerId: 'eng_carlos', skillId: 'skill_javascript', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(18) },
  { id: 'es_carlos_docker', engineerId: 'eng_carlos', skillId: 'skill_docker', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.62, lastValidated: daysAgo(18) },
  { id: 'es_carlos_ownership', engineerId: 'eng_carlos', skillId: 'skill_ownership', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.76, lastValidated: daysAgo(18) },
  { id: 'es_carlos_adaptability', engineerId: 'eng_carlos', skillId: 'skill_adaptability', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(18) },

  // Ashley - Frontend Junior (Vue focus, Seattle)
  { id: 'es_ashley_vue', engineerId: 'eng_ashley', skillId: 'skill_vue', proficiencyLevel: 'proficient', yearsUsed: 1, confidenceScore: 0.72, lastValidated: daysAgo(5) },
  { id: 'es_ashley_javascript', engineerId: 'eng_ashley', skillId: 'skill_javascript', proficiencyLevel: 'proficient', yearsUsed: 1, confidenceScore: 0.75, lastValidated: daysAgo(5) },
  { id: 'es_ashley_typescript', engineerId: 'eng_ashley', skillId: 'skill_typescript', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.65, lastValidated: daysAgo(5) },
  { id: 'es_ashley_attention_detail', engineerId: 'eng_ashley', skillId: 'skill_attention_detail', proficiencyLevel: 'proficient', yearsUsed: 1, confidenceScore: 0.78, lastValidated: daysAgo(5) },
  { id: 'es_ashley_learning', engineerId: 'eng_ashley', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 1, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_ashley_curiosity', engineerId: 'eng_ashley', skillId: 'skill_curiosity', proficiencyLevel: 'expert', yearsUsed: 1, confidenceScore: 0.85, lastValidated: daysAgo(5) },

  // Tyler - Backend Junior (Java/Spring, Phoenix)
  { id: 'es_tyler_java', engineerId: 'eng_tyler', skillId: 'skill_java', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(10) },
  { id: 'es_tyler_spring', engineerId: 'eng_tyler', skillId: 'skill_spring', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.74, lastValidated: daysAgo(10) },
  { id: 'es_tyler_mysql', engineerId: 'eng_tyler', skillId: 'skill_mysql', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.72, lastValidated: daysAgo(10) },
  { id: 'es_tyler_api_design', engineerId: 'eng_tyler', skillId: 'skill_api_design', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.68, lastValidated: daysAgo(10) },
  { id: 'es_tyler_unit_testing', engineerId: 'eng_tyler', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(10) },
  { id: 'es_tyler_learning', engineerId: 'eng_tyler', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.85, lastValidated: daysAgo(10) },
  { id: 'es_tyler_ownership', engineerId: 'eng_tyler', skillId: 'skill_ownership', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.76, lastValidated: daysAgo(10) },

  // ============================================
  // Mid-Level Engineer Skills
  // ============================================

  // Rachel - HIGH-PERFORMING Frontend (Ex-Stripe, senior-level confidence 0.88-0.92)
  { id: 'es_rachel_react', engineerId: 'eng_rachel', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.92, lastValidated: daysAgo(5) },
  { id: 'es_rachel_typescript', engineerId: 'eng_rachel', skillId: 'skill_typescript', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.90, lastValidated: daysAgo(5) },
  { id: 'es_rachel_performance', engineerId: 'eng_rachel', skillId: 'skill_performance_optimization', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_rachel_nextjs', engineerId: 'eng_rachel', skillId: 'skill_nextjs', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_rachel_unit_testing', engineerId: 'eng_rachel', skillId: 'skill_unit_testing', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(5) },
  { id: 'es_rachel_attention_detail', engineerId: 'eng_rachel', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.90, lastValidated: daysAgo(5) },

  // Lisa - HIGH-PERFORMING Backend (Ex-Cloudflare, Go, senior-level confidence 0.88-0.92)
  { id: 'es_lisa_go', engineerId: 'eng_lisa', skillId: 'skill_go', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.92, lastValidated: daysAgo(8) },
  { id: 'es_lisa_distributed', engineerId: 'eng_lisa', skillId: 'skill_distributed', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(8) },
  { id: 'es_lisa_system_design', engineerId: 'eng_lisa', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(8) },
  { id: 'es_lisa_postgresql', engineerId: 'eng_lisa', skillId: 'skill_postgresql', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(8) },
  { id: 'es_lisa_redis', engineerId: 'eng_lisa', skillId: 'skill_redis', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.85, lastValidated: daysAgo(8) },
  { id: 'es_lisa_docker', engineerId: 'eng_lisa', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(8) },
  { id: 'es_lisa_debugging', engineerId: 'eng_lisa', skillId: 'skill_debugging', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.90, lastValidated: daysAgo(8) },

  // Zoe - STARTUP GENERALIST (Broad skills 12+, moderate confidence 0.75-0.85, high ownership)
  { id: 'es_zoe_react', engineerId: 'eng_zoe', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(10) },
  { id: 'es_zoe_nodejs', engineerId: 'eng_zoe', skillId: 'skill_nodejs', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.80, lastValidated: daysAgo(10) },
  { id: 'es_zoe_python', engineerId: 'eng_zoe', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.76, lastValidated: daysAgo(10) },
  { id: 'es_zoe_aws', engineerId: 'eng_zoe', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(10) },
  { id: 'es_zoe_terraform', engineerId: 'eng_zoe', skillId: 'skill_terraform', proficiencyLevel: 'learning', yearsUsed: 2, confidenceScore: 0.70, lastValidated: daysAgo(10) },
  { id: 'es_zoe_postgresql', engineerId: 'eng_zoe', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.82, lastValidated: daysAgo(10) },
  { id: 'es_zoe_typescript', engineerId: 'eng_zoe', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(10) },
  { id: 'es_zoe_docker', engineerId: 'eng_zoe', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.75, lastValidated: daysAgo(10) },
  { id: 'es_zoe_graphql', engineerId: 'eng_zoe', skillId: 'skill_graphql', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.76, lastValidated: daysAgo(10) },
  { id: 'es_zoe_mongodb', engineerId: 'eng_zoe', skillId: 'skill_mongodb', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(10) },
  { id: 'es_zoe_ownership', engineerId: 'eng_zoe', skillId: 'skill_ownership', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.92, lastValidated: daysAgo(10) },
  { id: 'es_zoe_adaptability', engineerId: 'eng_zoe', skillId: 'skill_adaptability', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.90, lastValidated: daysAgo(10) },
  { id: 'es_zoe_learning', engineerId: 'eng_zoe', skillId: 'skill_learning', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(10) },
  { id: 'es_zoe_pressure', engineerId: 'eng_zoe', skillId: 'skill_pressure', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(10) },

  // David - Standard Mid-Level (Healthcare Backend, Python)
  { id: 'es_david_python', engineerId: 'eng_david', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(12) },
  { id: 'es_david_django', engineerId: 'eng_david', skillId: 'skill_django', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(12) },
  { id: 'es_david_postgresql', engineerId: 'eng_david', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(12) },
  { id: 'es_david_api_design', engineerId: 'eng_david', skillId: 'skill_api_design', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(12) },
  { id: 'es_david_docker', engineerId: 'eng_david', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(12) },
  { id: 'es_david_unit_testing', engineerId: 'eng_david', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.80, lastValidated: daysAgo(12) },
  { id: 'es_david_attention_detail', engineerId: 'eng_david', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(12) },
  { id: 'es_david_documentation', engineerId: 'eng_david', skillId: 'skill_documentation', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(12) },

  // Mohammed - Standard Mid-Level (DevOps)
  { id: 'es_mohammed_kubernetes', engineerId: 'eng_mohammed', skillId: 'skill_kubernetes', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.85, lastValidated: daysAgo(14) },
  { id: 'es_mohammed_terraform', engineerId: 'eng_mohammed', skillId: 'skill_terraform', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.85, lastValidated: daysAgo(14) },
  { id: 'es_mohammed_aws', engineerId: 'eng_mohammed', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(14) },
  { id: 'es_mohammed_docker', engineerId: 'eng_mohammed', skillId: 'skill_docker', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(14) },
  { id: 'es_mohammed_helm', engineerId: 'eng_mohammed', skillId: 'skill_helm', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.78, lastValidated: daysAgo(14) },
  { id: 'es_mohammed_python', engineerId: 'eng_mohammed', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.75, lastValidated: daysAgo(14) },
  { id: 'es_mohammed_monitoring', engineerId: 'eng_mohammed', skillId: 'skill_monitoring', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(14) },
  { id: 'es_mohammed_debugging', engineerId: 'eng_mohammed', skillId: 'skill_debugging', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(14) },

  // Aisha - Standard Mid-Level (ML, Healthcare)
  { id: 'es_aisha_python', engineerId: 'eng_aisha', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(10) },
  { id: 'es_aisha_tensorflow', engineerId: 'eng_aisha', skillId: 'skill_tensorflow', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(10) },
  { id: 'es_aisha_spark', engineerId: 'eng_aisha', skillId: 'skill_spark', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(10) },
  { id: 'es_aisha_postgresql', engineerId: 'eng_aisha', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.80, lastValidated: daysAgo(10) },
  { id: 'es_aisha_docker', engineerId: 'eng_aisha', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.75, lastValidated: daysAgo(10) },
  { id: 'es_aisha_analytical', engineerId: 'eng_aisha', skillId: 'skill_analytical', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(10) },
  { id: 'es_aisha_attention_detail', engineerId: 'eng_aisha', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(10) },
  { id: 'es_aisha_documentation', engineerId: 'eng_aisha', skillId: 'skill_documentation', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.80, lastValidated: daysAgo(10) },

  // Ryan - Standard Mid-Level (Mobile, React Native, Gaming)
  { id: 'es_ryan_react_native', engineerId: 'eng_ryan', skillId: 'skill_react_native', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(8) },
  { id: 'es_ryan_react', engineerId: 'eng_ryan', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(8) },
  { id: 'es_ryan_typescript', engineerId: 'eng_ryan', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(8) },
  { id: 'es_ryan_firebase', engineerId: 'eng_ryan', skillId: 'skill_firebase', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(8) },
  { id: 'es_ryan_swift', engineerId: 'eng_ryan', skillId: 'skill_swift', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.65, lastValidated: daysAgo(8) },
  { id: 'es_ryan_kotlin', engineerId: 'eng_ryan', skillId: 'skill_kotlin', proficiencyLevel: 'learning', yearsUsed: 1, confidenceScore: 0.65, lastValidated: daysAgo(8) },
  { id: 'es_ryan_unit_testing', engineerId: 'eng_ryan', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(8) },
  { id: 'es_ryan_cross_functional', engineerId: 'eng_ryan', skillId: 'skill_cross_functional', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.80, lastValidated: daysAgo(8) },

  // Emma - Standard Mid-Level (Frontend, React, Design Systems)
  { id: 'es_emma_react', engineerId: 'eng_emma', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(6) },
  { id: 'es_emma_typescript', engineerId: 'eng_emma', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(6) },
  { id: 'es_emma_nextjs', engineerId: 'eng_emma', skillId: 'skill_nextjs', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(6) },
  { id: 'es_emma_graphql', engineerId: 'eng_emma', skillId: 'skill_graphql', proficiencyLevel: 'proficient', yearsUsed: 2, confidenceScore: 0.75, lastValidated: daysAgo(6) },
  { id: 'es_emma_unit_testing', engineerId: 'eng_emma', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.80, lastValidated: daysAgo(6) },
  { id: 'es_emma_attention_detail', engineerId: 'eng_emma', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(6) },
  { id: 'es_emma_cross_functional', engineerId: 'eng_emma', skillId: 'skill_cross_functional', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(6) },
  { id: 'es_emma_documentation', engineerId: 'eng_emma', skillId: 'skill_documentation', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.78, lastValidated: daysAgo(6) },

  // ============================================
  // Senior Engineer Skills
  // ============================================

  // Greg - COASTING SENIOR (competent Java, but mid-level confidence 0.78-0.84, older validation dates)
  { id: 'es_greg_java', engineerId: 'eng_greg', skillId: 'skill_java', proficiencyLevel: 'proficient', yearsUsed: 7, confidenceScore: 0.80, lastValidated: daysAgo(90) },
  { id: 'es_greg_spring', engineerId: 'eng_greg', skillId: 'skill_spring', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.78, lastValidated: daysAgo(90) },
  { id: 'es_greg_sql', engineerId: 'eng_greg', skillId: 'skill_sql', proficiencyLevel: 'proficient', yearsUsed: 7, confidenceScore: 0.82, lastValidated: daysAgo(90) },
  { id: 'es_greg_postgresql', engineerId: 'eng_greg', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.78, lastValidated: daysAgo(90) },
  { id: 'es_greg_docker', engineerId: 'eng_greg', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.72, lastValidated: daysAgo(90) },
  { id: 'es_greg_api_design', engineerId: 'eng_greg', skillId: 'skill_api_design', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.78, lastValidated: daysAgo(90) },
  { id: 'es_greg_unit_testing', engineerId: 'eng_greg', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.80, lastValidated: daysAgo(90) },
  { id: 'es_greg_mentorship', engineerId: 'eng_greg', skillId: 'skill_mentorship', proficiencyLevel: 'learning', yearsUsed: 2, confidenceScore: 0.65, lastValidated: daysAgo(90) },
  { id: 'es_greg_documentation', engineerId: 'eng_greg', skillId: 'skill_documentation', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.76, lastValidated: daysAgo(90) },

  // Natasha - COASTING SENIOR (EdTech, comfortable, mid-level confidence 0.78-0.84)
  { id: 'es_natasha_react', engineerId: 'eng_natasha', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.80, lastValidated: daysAgo(85) },
  { id: 'es_natasha_nodejs', engineerId: 'eng_natasha', skillId: 'skill_nodejs', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.82, lastValidated: daysAgo(85) },
  { id: 'es_natasha_typescript', engineerId: 'eng_natasha', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(85) },
  { id: 'es_natasha_postgresql', engineerId: 'eng_natasha', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.80, lastValidated: daysAgo(85) },
  { id: 'es_natasha_aws', engineerId: 'eng_natasha', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.75, lastValidated: daysAgo(85) },
  { id: 'es_natasha_graphql', engineerId: 'eng_natasha', skillId: 'skill_graphql', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.74, lastValidated: daysAgo(85) },
  { id: 'es_natasha_unit_testing', engineerId: 'eng_natasha', skillId: 'skill_unit_testing', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.78, lastValidated: daysAgo(85) },
  { id: 'es_natasha_cross_functional', engineerId: 'eng_natasha', skillId: 'skill_cross_functional', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.80, lastValidated: daysAgo(85) },
  { id: 'es_natasha_documentation', engineerId: 'eng_natasha', skillId: 'skill_documentation', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.82, lastValidated: daysAgo(85) },

  // Nathan - BIG-TECH SPECIALIST (Ex-Meta, deep ML/Ranking, few skills 5-7, very high confidence 0.90-0.95)
  { id: 'es_nathan_python', engineerId: 'eng_nathan', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.94, lastValidated: daysAgo(15) },
  { id: 'es_nathan_spark', engineerId: 'eng_nathan', skillId: 'skill_spark', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.92, lastValidated: daysAgo(15) },
  { id: 'es_nathan_system_design', engineerId: 'eng_nathan', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.90, lastValidated: daysAgo(15) },
  { id: 'es_nathan_mentorship', engineerId: 'eng_nathan', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(15) },
  { id: 'es_nathan_documentation', engineerId: 'eng_nathan', skillId: 'skill_documentation', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(15) },
  { id: 'es_nathan_adaptability', engineerId: 'eng_nathan', skillId: 'skill_adaptability', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.72, lastValidated: daysAgo(15) },

  // Wei - BIG-TECH SPECIALIST (Ex-Netflix, Kafka/Spark, few skills, very high confidence 0.90-0.95)
  { id: 'es_wei_kafka', engineerId: 'eng_wei', skillId: 'skill_kafka', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.95, lastValidated: daysAgo(12) },
  { id: 'es_wei_spark', engineerId: 'eng_wei', skillId: 'skill_spark', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.93, lastValidated: daysAgo(12) },
  { id: 'es_wei_python', engineerId: 'eng_wei', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.90, lastValidated: daysAgo(12) },
  { id: 'es_wei_distributed', engineerId: 'eng_wei', skillId: 'skill_distributed', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.92, lastValidated: daysAgo(12) },
  { id: 'es_wei_system_design', engineerId: 'eng_wei', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.90, lastValidated: daysAgo(12) },
  { id: 'es_wei_mentorship', engineerId: 'eng_wei', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.86, lastValidated: daysAgo(12) },
  { id: 'es_wei_ownership', engineerId: 'eng_wei', skillId: 'skill_ownership', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.75, lastValidated: daysAgo(12) },

  // Derek - STARTUP GENERALIST Senior (breadth, many skills 12-14, solid confidence 0.78-0.86, high hiring/leadership)
  { id: 'es_derek_react', engineerId: 'eng_derek', skillId: 'skill_react', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.82, lastValidated: daysAgo(20) },
  { id: 'es_derek_nodejs', engineerId: 'eng_derek', skillId: 'skill_nodejs', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.84, lastValidated: daysAgo(20) },
  { id: 'es_derek_python', engineerId: 'eng_derek', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(20) },
  { id: 'es_derek_aws', engineerId: 'eng_derek', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.80, lastValidated: daysAgo(20) },
  { id: 'es_derek_typescript', engineerId: 'eng_derek', skillId: 'skill_typescript', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(20) },
  { id: 'es_derek_postgresql', engineerId: 'eng_derek', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.80, lastValidated: daysAgo(20) },
  { id: 'es_derek_docker', engineerId: 'eng_derek', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(20) },
  { id: 'es_derek_terraform', engineerId: 'eng_derek', skillId: 'skill_terraform', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.75, lastValidated: daysAgo(20) },
  { id: 'es_derek_graphql', engineerId: 'eng_derek', skillId: 'skill_graphql', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.76, lastValidated: daysAgo(20) },
  { id: 'es_derek_hiring', engineerId: 'eng_derek', skillId: 'skill_hiring', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(20) },
  { id: 'es_derek_team_leadership', engineerId: 'eng_derek', skillId: 'skill_team_leadership', proficiencyLevel: 'expert', yearsUsed: 3, confidenceScore: 0.86, lastValidated: daysAgo(20) },
  { id: 'es_derek_ownership', engineerId: 'eng_derek', skillId: 'skill_ownership', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.90, lastValidated: daysAgo(20) },
  { id: 'es_derek_adaptability', engineerId: 'eng_derek', skillId: 'skill_adaptability', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.88, lastValidated: daysAgo(20) },
  { id: 'es_derek_pressure', engineerId: 'eng_derek', skillId: 'skill_pressure', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.86, lastValidated: daysAgo(20) },

  // Takeshi - Standard Senior (Java & Distributed Systems, 0.82-0.92 confidence)
  { id: 'es_takeshi_java', engineerId: 'eng_takeshi', skillId: 'skill_java', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.90, lastValidated: daysAgo(18) },
  { id: 'es_takeshi_spring', engineerId: 'eng_takeshi', skillId: 'skill_spring', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.88, lastValidated: daysAgo(18) },
  { id: 'es_takeshi_distributed', engineerId: 'eng_takeshi', skillId: 'skill_distributed', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.86, lastValidated: daysAgo(18) },
  { id: 'es_takeshi_kafka', engineerId: 'eng_takeshi', skillId: 'skill_kafka', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(18) },
  { id: 'es_takeshi_postgresql', engineerId: 'eng_takeshi', skillId: 'skill_postgresql', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.85, lastValidated: daysAgo(18) },
  { id: 'es_takeshi_system_design', engineerId: 'eng_takeshi', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(18) },
  { id: 'es_takeshi_api_design', engineerId: 'eng_takeshi', skillId: 'skill_api_design', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.84, lastValidated: daysAgo(18) },
  { id: 'es_takeshi_mentorship', engineerId: 'eng_takeshi', skillId: 'skill_mentorship', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.80, lastValidated: daysAgo(18) },
  { id: 'es_takeshi_debugging', engineerId: 'eng_takeshi', skillId: 'skill_debugging', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.88, lastValidated: daysAgo(18) },

  // Sarah - Standard Senior (Frontend, React & Performance, 0.82-0.92 confidence)
  { id: 'es_sarah_react', engineerId: 'eng_sarah', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.92, lastValidated: daysAgo(10) },
  { id: 'es_sarah_typescript', engineerId: 'eng_sarah', skillId: 'skill_typescript', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(10) },
  { id: 'es_sarah_nextjs', engineerId: 'eng_sarah', skillId: 'skill_nextjs', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.86, lastValidated: daysAgo(10) },
  { id: 'es_sarah_performance', engineerId: 'eng_sarah', skillId: 'skill_performance_optimization', proficiencyLevel: 'expert', yearsUsed: 4, confidenceScore: 0.88, lastValidated: daysAgo(10) },
  { id: 'es_sarah_javascript', engineerId: 'eng_sarah', skillId: 'skill_javascript', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(10) },
  { id: 'es_sarah_graphql', engineerId: 'eng_sarah', skillId: 'skill_graphql', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.82, lastValidated: daysAgo(10) },
  { id: 'es_sarah_unit_testing', engineerId: 'eng_sarah', skillId: 'skill_unit_testing', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(10) },
  { id: 'es_sarah_mentorship', engineerId: 'eng_sarah', skillId: 'skill_mentorship', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.82, lastValidated: daysAgo(10) },
  { id: 'es_sarah_attention_detail', engineerId: 'eng_sarah', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(10) },

  // Ravi - Standard Senior (Healthcare Full Stack, 0.82-0.92 confidence)
  { id: 'es_ravi_nodejs', engineerId: 'eng_ravi', skillId: 'skill_nodejs', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.88, lastValidated: daysAgo(14) },
  { id: 'es_ravi_react', engineerId: 'eng_ravi', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.86, lastValidated: daysAgo(14) },
  { id: 'es_ravi_typescript', engineerId: 'eng_ravi', skillId: 'skill_typescript', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(14) },
  { id: 'es_ravi_postgresql', engineerId: 'eng_ravi', skillId: 'skill_postgresql', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.88, lastValidated: daysAgo(14) },
  { id: 'es_ravi_aws', engineerId: 'eng_ravi', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.82, lastValidated: daysAgo(14) },
  { id: 'es_ravi_docker', engineerId: 'eng_ravi', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.80, lastValidated: daysAgo(14) },
  { id: 'es_ravi_api_design', engineerId: 'eng_ravi', skillId: 'skill_api_design', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.86, lastValidated: daysAgo(14) },
  { id: 'es_ravi_attention_detail', engineerId: 'eng_ravi', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.90, lastValidated: daysAgo(14) },
  { id: 'es_ravi_documentation', engineerId: 'eng_ravi', skillId: 'skill_documentation', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.85, lastValidated: daysAgo(14) },

  // Olivia - Standard Senior (ML Engineer, NLP & Python, 0.82-0.92 confidence)
  { id: 'es_olivia_python', engineerId: 'eng_olivia', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.92, lastValidated: daysAgo(8) },
  { id: 'es_olivia_tensorflow', engineerId: 'eng_olivia', skillId: 'skill_tensorflow', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(8) },
  { id: 'es_olivia_spark', engineerId: 'eng_olivia', skillId: 'skill_spark', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(8) },
  { id: 'es_olivia_postgresql', engineerId: 'eng_olivia', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.80, lastValidated: daysAgo(8) },
  { id: 'es_olivia_docker', engineerId: 'eng_olivia', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(8) },
  { id: 'es_olivia_aws', engineerId: 'eng_olivia', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.78, lastValidated: daysAgo(8) },
  { id: 'es_olivia_analytical', engineerId: 'eng_olivia', skillId: 'skill_analytical', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.92, lastValidated: daysAgo(8) },
  { id: 'es_olivia_mentorship', engineerId: 'eng_olivia', skillId: 'skill_mentorship', proficiencyLevel: 'proficient', yearsUsed: 3, confidenceScore: 0.82, lastValidated: daysAgo(8) },
  { id: 'es_olivia_documentation', engineerId: 'eng_olivia', skillId: 'skill_documentation', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(8) },

  // Lucas - Standard Senior (Security Engineer, Cloud Security, 0.82-0.92 confidence)
  { id: 'es_lucas_aws', engineerId: 'eng_lucas', skillId: 'skill_aws', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.90, lastValidated: daysAgo(10) },
  { id: 'es_lucas_python', engineerId: 'eng_lucas', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.85, lastValidated: daysAgo(10) },
  { id: 'es_lucas_terraform', engineerId: 'eng_lucas', skillId: 'skill_terraform', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(10) },
  { id: 'es_lucas_kubernetes', engineerId: 'eng_lucas', skillId: 'skill_kubernetes', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.82, lastValidated: daysAgo(10) },
  { id: 'es_lucas_docker', engineerId: 'eng_lucas', skillId: 'skill_docker', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.84, lastValidated: daysAgo(10) },
  { id: 'es_lucas_monitoring', engineerId: 'eng_lucas', skillId: 'skill_monitoring', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.88, lastValidated: daysAgo(10) },
  { id: 'es_lucas_debugging', engineerId: 'eng_lucas', skillId: 'skill_debugging', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.86, lastValidated: daysAgo(10) },
  { id: 'es_lucas_attention_detail', engineerId: 'eng_lucas', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.92, lastValidated: daysAgo(10) },
  { id: 'es_lucas_analytical', engineerId: 'eng_lucas', skillId: 'skill_analytical', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.88, lastValidated: daysAgo(10) },

  // ============================================
  // Staff Engineer Skills (0.85-0.95 confidence range)
  // ============================================

  // Anika - CRITICAL: Platform Engineer with Kafka (0.90+), Kubernetes (0.85+), unlocks example query
  { id: 'es_anika_kafka', engineerId: 'eng_anika', skillId: 'skill_kafka', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.94, lastValidated: daysAgo(5) },
  { id: 'es_anika_kubernetes', engineerId: 'eng_anika', skillId: 'skill_kubernetes', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.92, lastValidated: daysAgo(5) },
  { id: 'es_anika_aws', engineerId: 'eng_anika', skillId: 'skill_aws', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.90, lastValidated: daysAgo(5) },
  { id: 'es_anika_java', engineerId: 'eng_anika', skillId: 'skill_java', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.92, lastValidated: daysAgo(5) },
  { id: 'es_anika_system_design', engineerId: 'eng_anika', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.90, lastValidated: daysAgo(5) },
  { id: 'es_anika_distributed', engineerId: 'eng_anika', skillId: 'skill_distributed', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.92, lastValidated: daysAgo(5) },
  { id: 'es_anika_docker', engineerId: 'eng_anika', skillId: 'skill_docker', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_anika_terraform', engineerId: 'eng_anika', skillId: 'skill_terraform', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(5) },
  { id: 'es_anika_mentorship', engineerId: 'eng_anika', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_anika_team_leadership', engineerId: 'eng_anika', skillId: 'skill_team_leadership', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(5) },

  // Alex - Staff Backend (Java & System Design)
  { id: 'es_alex_java', engineerId: 'eng_alex', skillId: 'skill_java', proficiencyLevel: 'expert', yearsUsed: 9, confidenceScore: 0.94, lastValidated: daysAgo(8) },
  { id: 'es_alex_spring', engineerId: 'eng_alex', skillId: 'skill_spring', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.92, lastValidated: daysAgo(8) },
  { id: 'es_alex_system_design', engineerId: 'eng_alex', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(8) },
  { id: 'es_alex_postgresql', engineerId: 'eng_alex', skillId: 'skill_postgresql', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.90, lastValidated: daysAgo(8) },
  { id: 'es_alex_kafka', engineerId: 'eng_alex', skillId: 'skill_kafka', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(8) },
  { id: 'es_alex_api_design', engineerId: 'eng_alex', skillId: 'skill_api_design', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.90, lastValidated: daysAgo(8) },
  { id: 'es_alex_mentorship', engineerId: 'eng_alex', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(8) },
  { id: 'es_alex_debugging', engineerId: 'eng_alex', skillId: 'skill_debugging', proficiencyLevel: 'expert', yearsUsed: 9, confidenceScore: 0.92, lastValidated: daysAgo(8) },

  // Dmitri - Staff ML Engineer (Deep Learning & MLOps)
  { id: 'es_dmitri_python', engineerId: 'eng_dmitri', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.95, lastValidated: daysAgo(6) },
  { id: 'es_dmitri_tensorflow', engineerId: 'eng_dmitri', skillId: 'skill_tensorflow', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.94, lastValidated: daysAgo(6) },
  { id: 'es_dmitri_spark', engineerId: 'eng_dmitri', skillId: 'skill_spark', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(6) },
  { id: 'es_dmitri_docker', engineerId: 'eng_dmitri', skillId: 'skill_docker', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(6) },
  { id: 'es_dmitri_kubernetes', engineerId: 'eng_dmitri', skillId: 'skill_kubernetes', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(6) },
  { id: 'es_dmitri_aws', engineerId: 'eng_dmitri', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.86, lastValidated: daysAgo(6) },
  { id: 'es_dmitri_system_design', engineerId: 'eng_dmitri', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(6) },
  { id: 'es_dmitri_analytical', engineerId: 'eng_dmitri', skillId: 'skill_analytical', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.94, lastValidated: daysAgo(6) },
  { id: 'es_dmitri_mentorship', engineerId: 'eng_dmitri', skillId: 'skill_mentorship', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.86, lastValidated: daysAgo(6) },

  // Jennifer - Staff Frontend (React & Web Performance)
  { id: 'es_jennifer_react', engineerId: 'eng_jennifer', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.95, lastValidated: daysAgo(4) },
  { id: 'es_jennifer_typescript', engineerId: 'eng_jennifer', skillId: 'skill_typescript', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.92, lastValidated: daysAgo(4) },
  { id: 'es_jennifer_nextjs', engineerId: 'eng_jennifer', skillId: 'skill_nextjs', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.90, lastValidated: daysAgo(4) },
  { id: 'es_jennifer_performance', engineerId: 'eng_jennifer', skillId: 'skill_performance_optimization', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.92, lastValidated: daysAgo(4) },
  { id: 'es_jennifer_graphql', engineerId: 'eng_jennifer', skillId: 'skill_graphql', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(4) },
  { id: 'es_jennifer_javascript', engineerId: 'eng_jennifer', skillId: 'skill_javascript', proficiencyLevel: 'expert', yearsUsed: 9, confidenceScore: 0.94, lastValidated: daysAgo(4) },
  { id: 'es_jennifer_unit_testing', engineerId: 'eng_jennifer', skillId: 'skill_unit_testing', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.90, lastValidated: daysAgo(4) },
  { id: 'es_jennifer_mentorship', engineerId: 'eng_jennifer', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(4) },
  { id: 'es_jennifer_system_design', engineerId: 'eng_jennifer', skillId: 'skill_system_design', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.86, lastValidated: daysAgo(4) },

  // Michael - Staff DevOps (AWS & Platform Engineering)
  { id: 'es_michael_aws', engineerId: 'eng_michael', skillId: 'skill_aws', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.95, lastValidated: daysAgo(7) },
  { id: 'es_michael_terraform', engineerId: 'eng_michael', skillId: 'skill_terraform', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.92, lastValidated: daysAgo(7) },
  { id: 'es_michael_kubernetes', engineerId: 'eng_michael', skillId: 'skill_kubernetes', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(7) },
  { id: 'es_michael_docker', engineerId: 'eng_michael', skillId: 'skill_docker', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.92, lastValidated: daysAgo(7) },
  { id: 'es_michael_helm', engineerId: 'eng_michael', skillId: 'skill_helm', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(7) },
  { id: 'es_michael_monitoring', engineerId: 'eng_michael', skillId: 'skill_monitoring', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.92, lastValidated: daysAgo(7) },
  { id: 'es_michael_python', engineerId: 'eng_michael', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.85, lastValidated: daysAgo(7) },
  { id: 'es_michael_system_design', engineerId: 'eng_michael', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(7) },
  { id: 'es_michael_team_leadership', engineerId: 'eng_michael', skillId: 'skill_team_leadership', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.86, lastValidated: daysAgo(7) },

  // Sanjay - Staff Data Engineer (Spark & Real-time Systems)
  { id: 'es_sanjay_spark', engineerId: 'eng_sanjay', skillId: 'skill_spark', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.95, lastValidated: daysAgo(6) },
  { id: 'es_sanjay_kafka', engineerId: 'eng_sanjay', skillId: 'skill_kafka', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.92, lastValidated: daysAgo(6) },
  { id: 'es_sanjay_python', engineerId: 'eng_sanjay', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 9, confidenceScore: 0.92, lastValidated: daysAgo(6) },
  { id: 'es_sanjay_postgresql', engineerId: 'eng_sanjay', skillId: 'skill_postgresql', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.90, lastValidated: daysAgo(6) },
  { id: 'es_sanjay_aws', engineerId: 'eng_sanjay', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 6, confidenceScore: 0.86, lastValidated: daysAgo(6) },
  { id: 'es_sanjay_distributed', engineerId: 'eng_sanjay', skillId: 'skill_distributed', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.90, lastValidated: daysAgo(6) },
  { id: 'es_sanjay_system_design', engineerId: 'eng_sanjay', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.88, lastValidated: daysAgo(6) },
  { id: 'es_sanjay_mentorship', engineerId: 'eng_sanjay', skillId: 'skill_mentorship', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(6) },

  // Christine - Staff Full Stack (Healthcare & Fintech)
  { id: 'es_christine_react', engineerId: 'eng_christine', skillId: 'skill_react', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.92, lastValidated: daysAgo(5) },
  { id: 'es_christine_nodejs', engineerId: 'eng_christine', skillId: 'skill_nodejs', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.90, lastValidated: daysAgo(5) },
  { id: 'es_christine_typescript', engineerId: 'eng_christine', skillId: 'skill_typescript', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(5) },
  { id: 'es_christine_postgresql', engineerId: 'eng_christine', skillId: 'skill_postgresql', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.90, lastValidated: daysAgo(5) },
  { id: 'es_christine_aws', engineerId: 'eng_christine', skillId: 'skill_aws', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(5) },
  { id: 'es_christine_graphql', engineerId: 'eng_christine', skillId: 'skill_graphql', proficiencyLevel: 'proficient', yearsUsed: 4, confidenceScore: 0.85, lastValidated: daysAgo(5) },
  { id: 'es_christine_attention_detail', engineerId: 'eng_christine', skillId: 'skill_attention_detail', proficiencyLevel: 'expert', yearsUsed: 9, confidenceScore: 0.92, lastValidated: daysAgo(5) },
  { id: 'es_christine_documentation', engineerId: 'eng_christine', skillId: 'skill_documentation', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_christine_distributed', engineerId: 'eng_christine', skillId: 'skill_distributed', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.88, lastValidated: daysAgo(5) },
  { id: 'es_christine_monitoring', engineerId: 'eng_christine', skillId: 'skill_monitoring', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.85, lastValidated: daysAgo(5) },

  // Hassan - Staff Security Engineer (AppSec & Cloud Security)
  { id: 'es_hassan_aws', engineerId: 'eng_hassan', skillId: 'skill_aws', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.94, lastValidated: daysAgo(4) },
  { id: 'es_hassan_python', engineerId: 'eng_hassan', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.90, lastValidated: daysAgo(4) },
  { id: 'es_hassan_terraform', engineerId: 'eng_hassan', skillId: 'skill_terraform', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(4) },
  { id: 'es_hassan_kubernetes', engineerId: 'eng_hassan', skillId: 'skill_kubernetes', proficiencyLevel: 'expert', yearsUsed: 5, confidenceScore: 0.88, lastValidated: daysAgo(4) },
  { id: 'es_hassan_docker', engineerId: 'eng_hassan', skillId: 'skill_docker', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.90, lastValidated: daysAgo(4) },
  { id: 'es_hassan_monitoring', engineerId: 'eng_hassan', skillId: 'skill_monitoring', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.92, lastValidated: daysAgo(4) },
  { id: 'es_hassan_analytical', engineerId: 'eng_hassan', skillId: 'skill_analytical', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.92, lastValidated: daysAgo(4) },
  { id: 'es_hassan_system_design', engineerId: 'eng_hassan', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 6, confidenceScore: 0.90, lastValidated: daysAgo(4) },
  { id: 'es_hassan_mentorship', engineerId: 'eng_hassan', skillId: 'skill_mentorship', proficiencyLevel: 'proficient', yearsUsed: 5, confidenceScore: 0.86, lastValidated: daysAgo(4) },

  // ============================================
  // Principal Engineers Skills (0.90-0.98 confidence)
  // ============================================

  // Victoria - Principal Architect (Distributed Systems & Cloud)
  { id: 'es_victoria_distributed', engineerId: 'eng_victoria', skillId: 'skill_distributed', proficiencyLevel: 'expert', yearsUsed: 12, confidenceScore: 0.98, lastValidated: daysAgo(3) },
  { id: 'es_victoria_aws', engineerId: 'eng_victoria', skillId: 'skill_aws', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.96, lastValidated: daysAgo(3) },
  { id: 'es_victoria_kubernetes', engineerId: 'eng_victoria', skillId: 'skill_kubernetes', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.95, lastValidated: daysAgo(3) },
  { id: 'es_victoria_system_design', engineerId: 'eng_victoria', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 14, confidenceScore: 0.98, lastValidated: daysAgo(3) },
  { id: 'es_victoria_kafka', engineerId: 'eng_victoria', skillId: 'skill_kafka', proficiencyLevel: 'expert', yearsUsed: 9, confidenceScore: 0.94, lastValidated: daysAgo(3) },
  { id: 'es_victoria_terraform', engineerId: 'eng_victoria', skillId: 'skill_terraform', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.92, lastValidated: daysAgo(3) },
  { id: 'es_victoria_team_leadership', engineerId: 'eng_victoria', skillId: 'skill_team_leadership', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.96, lastValidated: daysAgo(3) },
  { id: 'es_victoria_mentorship', engineerId: 'eng_victoria', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.95, lastValidated: daysAgo(3) },
  { id: 'es_victoria_java', engineerId: 'eng_victoria', skillId: 'skill_java', proficiencyLevel: 'expert', yearsUsed: 12, confidenceScore: 0.94, lastValidated: daysAgo(3) },
  { id: 'es_victoria_python', engineerId: 'eng_victoria', skillId: 'skill_python', proficiencyLevel: 'proficient', yearsUsed: 8, confidenceScore: 0.88, lastValidated: daysAgo(3) },

  // Robert - Principal ML Architect (AI Systems & Strategy)
  { id: 'es_robert_tensorflow', engineerId: 'eng_robert', skillId: 'skill_tensorflow', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.98, lastValidated: daysAgo(2) },
  { id: 'es_robert_python', engineerId: 'eng_robert', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 14, confidenceScore: 0.98, lastValidated: daysAgo(2) },
  { id: 'es_robert_pytorch', engineerId: 'eng_robert', skillId: 'skill_pytorch', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.96, lastValidated: daysAgo(2) },
  { id: 'es_robert_spark', engineerId: 'eng_robert', skillId: 'skill_spark', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.94, lastValidated: daysAgo(2) },
  { id: 'es_robert_aws', engineerId: 'eng_robert', skillId: 'skill_aws', proficiencyLevel: 'expert', yearsUsed: 9, confidenceScore: 0.92, lastValidated: daysAgo(2) },
  { id: 'es_robert_system_design', engineerId: 'eng_robert', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 12, confidenceScore: 0.96, lastValidated: daysAgo(2) },
  { id: 'es_robert_team_leadership', engineerId: 'eng_robert', skillId: 'skill_team_leadership', proficiencyLevel: 'expert', yearsUsed: 9, confidenceScore: 0.94, lastValidated: daysAgo(2) },
  { id: 'es_robert_mentorship', engineerId: 'eng_robert', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.92, lastValidated: daysAgo(2) },
  { id: 'es_robert_distributed', engineerId: 'eng_robert', skillId: 'skill_distributed', proficiencyLevel: 'proficient', yearsUsed: 7, confidenceScore: 0.88, lastValidated: daysAgo(2) },
  { id: 'es_robert_postgresql', engineerId: 'eng_robert', skillId: 'skill_postgresql', proficiencyLevel: 'proficient', yearsUsed: 10, confidenceScore: 0.88, lastValidated: daysAgo(2) },

  // Elena - Principal Security Architect (Enterprise Security)
  { id: 'es_elena_aws', engineerId: 'eng_elena', skillId: 'skill_aws', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.96, lastValidated: daysAgo(4) },
  { id: 'es_elena_terraform', engineerId: 'eng_elena', skillId: 'skill_terraform', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.95, lastValidated: daysAgo(4) },
  { id: 'es_elena_kubernetes', engineerId: 'eng_elena', skillId: 'skill_kubernetes', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.94, lastValidated: daysAgo(4) },
  { id: 'es_elena_python', engineerId: 'eng_elena', skillId: 'skill_python', proficiencyLevel: 'expert', yearsUsed: 11, confidenceScore: 0.94, lastValidated: daysAgo(4) },
  { id: 'es_elena_system_design', engineerId: 'eng_elena', skillId: 'skill_system_design', proficiencyLevel: 'expert', yearsUsed: 10, confidenceScore: 0.96, lastValidated: daysAgo(4) },
  { id: 'es_elena_team_leadership', engineerId: 'eng_elena', skillId: 'skill_team_leadership', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.94, lastValidated: daysAgo(4) },
  { id: 'es_elena_mentorship', engineerId: 'eng_elena', skillId: 'skill_mentorship', proficiencyLevel: 'expert', yearsUsed: 7, confidenceScore: 0.92, lastValidated: daysAgo(4) },
  { id: 'es_elena_monitoring', engineerId: 'eng_elena', skillId: 'skill_monitoring', proficiencyLevel: 'expert', yearsUsed: 9, confidenceScore: 0.94, lastValidated: daysAgo(4) },
  { id: 'es_elena_docker', engineerId: 'eng_elena', skillId: 'skill_docker', proficiencyLevel: 'expert', yearsUsed: 8, confidenceScore: 0.92, lastValidated: daysAgo(4) },
  { id: 'es_elena_analytical', engineerId: 'eng_elena', skillId: 'skill_analytical', proficiencyLevel: 'expert', yearsUsed: 12, confidenceScore: 0.96, lastValidated: daysAgo(4) },
];

// ============================================
// ENGINEER BUSINESS DOMAIN EXPERIENCE
// ============================================
// Explicit claims of business domain experience with years.
// This replaces the old domain_knowledge UserSkill entries.

export const engineerBusinessDomainExperience: EngineerBusinessDomainExperience[] = [
  // Priya - Fintech expert
  { id: 'ebde_priya_fintech', engineerId: 'eng_priya', businessDomainId: 'bd_fintech', years: 6 },
  { id: 'ebde_priya_payments', engineerId: 'eng_priya', businessDomainId: 'bd_payments', years: 4 },

  // Marcus - SaaS experience
  { id: 'ebde_marcus_saas', engineerId: 'eng_marcus', businessDomainId: 'bd_saas', years: 4 },

  // Sofia - No explicit business domain (platform focus)

  // James - Fintech experience
  { id: 'ebde_james_fintech', engineerId: 'eng_james', businessDomainId: 'bd_fintech', years: 5 },
  { id: 'ebde_james_banking', engineerId: 'eng_james', businessDomainId: 'bd_banking', years: 3 },

  // Emily - E-commerce
  { id: 'ebde_emily_ecommerce', engineerId: 'eng_emily', businessDomainId: 'bd_ecommerce', years: 3 },

  // Junior Engineers Business Domain Experience
  { id: 'ebde_maya_saas', engineerId: 'eng_maya', businessDomainId: 'bd_saas', years: 2 },
  { id: 'ebde_kevin_saas', engineerId: 'eng_kevin', businessDomainId: 'bd_saas', years: 2 },
  { id: 'ebde_carlos_ecommerce', engineerId: 'eng_carlos', businessDomainId: 'bd_ecommerce', years: 2 },
  { id: 'ebde_tyler_fintech', engineerId: 'eng_tyler', businessDomainId: 'bd_fintech', years: 2 },

  // Mid-Level Engineers Business Domain Experience
  { id: 'ebde_rachel_fintech', engineerId: 'eng_rachel', businessDomainId: 'bd_fintech', years: 3 },
  { id: 'ebde_rachel_payments', engineerId: 'eng_rachel', businessDomainId: 'bd_payments', years: 3 },
  { id: 'ebde_lisa_saas', engineerId: 'eng_lisa', businessDomainId: 'bd_saas', years: 4 },
  { id: 'ebde_zoe_saas', engineerId: 'eng_zoe', businessDomainId: 'bd_saas', years: 3 },
  { id: 'ebde_zoe_ecommerce', engineerId: 'eng_zoe', businessDomainId: 'bd_ecommerce', years: 2 },
  { id: 'ebde_zoe_fintech', engineerId: 'eng_zoe', businessDomainId: 'bd_fintech', years: 2 },
  { id: 'ebde_david_healthcare', engineerId: 'eng_david', businessDomainId: 'bd_healthcare', years: 4 },
  { id: 'ebde_aisha_healthcare', engineerId: 'eng_aisha', businessDomainId: 'bd_healthcare', years: 4 },
  { id: 'ebde_aisha_pharma', engineerId: 'eng_aisha', businessDomainId: 'bd_pharma', years: 2 },
  { id: 'ebde_ryan_gaming', engineerId: 'eng_ryan', businessDomainId: 'bd_gaming', years: 3 },
  { id: 'ebde_emma_ecommerce', engineerId: 'eng_emma', businessDomainId: 'bd_ecommerce', years: 3 },

  // Senior Engineers Business Domain Experience
  { id: 'ebde_greg_saas', engineerId: 'eng_greg', businessDomainId: 'bd_saas', years: 5 },
  { id: 'ebde_natasha_edtech', engineerId: 'eng_natasha', businessDomainId: 'bd_edtech', years: 6 },
  { id: 'ebde_nathan_saas', engineerId: 'eng_nathan', businessDomainId: 'bd_saas', years: 6 },
  { id: 'ebde_wei_streaming', engineerId: 'eng_wei', businessDomainId: 'bd_streaming', years: 5 },
  { id: 'ebde_derek_saas', engineerId: 'eng_derek', businessDomainId: 'bd_saas', years: 4 },
  { id: 'ebde_derek_fintech', engineerId: 'eng_derek', businessDomainId: 'bd_fintech', years: 3 },
  { id: 'ebde_derek_ecommerce', engineerId: 'eng_derek', businessDomainId: 'bd_ecommerce', years: 2 },
  { id: 'ebde_takeshi_fintech', engineerId: 'eng_takeshi', businessDomainId: 'bd_fintech', years: 5 },
  { id: 'ebde_sarah_ecommerce', engineerId: 'eng_sarah', businessDomainId: 'bd_ecommerce', years: 4 },
  { id: 'ebde_ravi_healthcare', engineerId: 'eng_ravi', businessDomainId: 'bd_healthcare', years: 6 },
  { id: 'ebde_olivia_healthcare', engineerId: 'eng_olivia', businessDomainId: 'bd_healthcare', years: 4 },
  { id: 'ebde_olivia_pharma', engineerId: 'eng_olivia', businessDomainId: 'bd_pharma', years: 3 },
  { id: 'ebde_lucas_fintech', engineerId: 'eng_lucas', businessDomainId: 'bd_fintech', years: 5 },

  // Staff Engineers Business Domain Experience
  { id: 'ebde_anika_fintech', engineerId: 'eng_anika', businessDomainId: 'bd_fintech', years: 7 },
  { id: 'ebde_anika_saas', engineerId: 'eng_anika', businessDomainId: 'bd_saas', years: 5 },
  { id: 'ebde_alex_fintech', engineerId: 'eng_alex', businessDomainId: 'bd_fintech', years: 6 },
  { id: 'ebde_alex_banking', engineerId: 'eng_alex', businessDomainId: 'bd_banking', years: 4 },
  { id: 'ebde_dmitri_healthcare', engineerId: 'eng_dmitri', businessDomainId: 'bd_healthcare', years: 5 },
  { id: 'ebde_dmitri_pharma', engineerId: 'eng_dmitri', businessDomainId: 'bd_pharma', years: 4 },
  { id: 'ebde_jennifer_ecommerce', engineerId: 'eng_jennifer', businessDomainId: 'bd_ecommerce', years: 6 },
  { id: 'ebde_jennifer_saas', engineerId: 'eng_jennifer', businessDomainId: 'bd_saas', years: 4 },
  { id: 'ebde_michael_saas', engineerId: 'eng_michael', businessDomainId: 'bd_saas', years: 8 },
  { id: 'ebde_sanjay_streaming', engineerId: 'eng_sanjay', businessDomainId: 'bd_streaming', years: 6 },
  { id: 'ebde_sanjay_fintech', engineerId: 'eng_sanjay', businessDomainId: 'bd_fintech', years: 4 },
  { id: 'ebde_christine_healthcare', engineerId: 'eng_christine', businessDomainId: 'bd_healthcare', years: 5 },
  { id: 'ebde_christine_fintech', engineerId: 'eng_christine', businessDomainId: 'bd_fintech', years: 4 },
  { id: 'ebde_hassan_fintech', engineerId: 'eng_hassan', businessDomainId: 'bd_fintech', years: 8 },
  { id: 'ebde_hassan_banking', engineerId: 'eng_hassan', businessDomainId: 'bd_banking', years: 5 },

  // Principal Engineers Business Domain Experience
  { id: 'ebde_victoria_saas', engineerId: 'eng_victoria', businessDomainId: 'bd_saas', years: 10 },
  { id: 'ebde_victoria_fintech', engineerId: 'eng_victoria', businessDomainId: 'bd_fintech', years: 6 },
  { id: 'ebde_robert_healthcare', engineerId: 'eng_robert', businessDomainId: 'bd_healthcare', years: 8 },
  { id: 'ebde_robert_pharma', engineerId: 'eng_robert', businessDomainId: 'bd_pharma', years: 5 },
  { id: 'ebde_robert_fintech', engineerId: 'eng_robert', businessDomainId: 'bd_fintech', years: 4 },
  { id: 'ebde_elena_fintech', engineerId: 'eng_elena', businessDomainId: 'bd_fintech', years: 9 },
  { id: 'ebde_elena_banking', engineerId: 'eng_elena', businessDomainId: 'bd_banking', years: 7 },
  { id: 'ebde_elena_healthcare', engineerId: 'eng_elena', businessDomainId: 'bd_healthcare', years: 3 },
];

// ============================================
// ENGINEER TECHNICAL DOMAIN EXPERIENCE
// ============================================
// Explicit claims of technical domain experience with years.
// Note: Engineers also get inferred domain experience from their skills
// via the Skill → SkillCategory → TechnicalDomain chain.
// Explicit claims take precedence over inferred claims.

export const engineerTechnicalDomainExperience: EngineerTechnicalDomainExperience[] = [
  // Priya - Backend specialist
  { id: 'etde_priya_backend', engineerId: 'eng_priya', technicalDomainId: 'td_backend', years: 8 },
  { id: 'etde_priya_api_dev', engineerId: 'eng_priya', technicalDomainId: 'td_api_dev', years: 6 },

  // Marcus - Full Stack
  { id: 'etde_marcus_fullstack', engineerId: 'eng_marcus', technicalDomainId: 'td_fullstack', years: 5 },

  // Sofia - DevOps specialist
  { id: 'etde_sofia_devops', engineerId: 'eng_sofia', technicalDomainId: 'td_devops', years: 7 },
  { id: 'etde_sofia_kubernetes', engineerId: 'eng_sofia', technicalDomainId: 'td_kubernetes', years: 5 },
  { id: 'etde_sofia_cloud', engineerId: 'eng_sofia', technicalDomainId: 'td_cloud', years: 6 },

  // James - Distributed Systems expert
  { id: 'etde_james_backend', engineerId: 'eng_james', technicalDomainId: 'td_backend', years: 12 },
  { id: 'etde_james_distributed', engineerId: 'eng_james', technicalDomainId: 'td_distributed_systems', years: 10 },

  // Emily - Frontend specialist
  { id: 'etde_emily_frontend', engineerId: 'eng_emily', technicalDomainId: 'td_frontend', years: 4 },
  { id: 'etde_emily_react', engineerId: 'eng_emily', technicalDomainId: 'td_react_ecosystem', years: 4 },

  // Junior Engineers Technical Domain Experience
  { id: 'etde_maya_frontend', engineerId: 'eng_maya', technicalDomainId: 'td_frontend', years: 2 },
  { id: 'etde_kevin_backend', engineerId: 'eng_kevin', technicalDomainId: 'td_backend', years: 3 },
  { id: 'etde_jordan_frontend', engineerId: 'eng_jordan', technicalDomainId: 'td_frontend', years: 2 },
  { id: 'etde_carlos_fullstack', engineerId: 'eng_carlos', technicalDomainId: 'td_fullstack', years: 3 },
  { id: 'etde_ashley_frontend', engineerId: 'eng_ashley', technicalDomainId: 'td_frontend', years: 1 },
  { id: 'etde_tyler_backend', engineerId: 'eng_tyler', technicalDomainId: 'td_backend', years: 3 },

  // Mid-Level Engineers Technical Domain Experience
  { id: 'etde_rachel_frontend', engineerId: 'eng_rachel', technicalDomainId: 'td_frontend', years: 5 },
  { id: 'etde_rachel_react', engineerId: 'eng_rachel', technicalDomainId: 'td_react_ecosystem', years: 5 },
  { id: 'etde_lisa_backend', engineerId: 'eng_lisa', technicalDomainId: 'td_backend', years: 5 },
  { id: 'etde_lisa_distributed', engineerId: 'eng_lisa', technicalDomainId: 'td_distributed_systems', years: 4 },
  { id: 'etde_zoe_fullstack', engineerId: 'eng_zoe', technicalDomainId: 'td_fullstack', years: 5 },
  { id: 'etde_david_backend', engineerId: 'eng_david', technicalDomainId: 'td_backend', years: 4 },
  { id: 'etde_mohammed_devops', engineerId: 'eng_mohammed', technicalDomainId: 'td_devops', years: 4 },
  { id: 'etde_mohammed_kubernetes', engineerId: 'eng_mohammed', technicalDomainId: 'td_kubernetes', years: 3 },
  { id: 'etde_aisha_ml', engineerId: 'eng_aisha', technicalDomainId: 'td_ml', years: 4 },
  { id: 'etde_aisha_data', engineerId: 'eng_aisha', technicalDomainId: 'td_data_engineering', years: 3 },
  { id: 'etde_ryan_mobile', engineerId: 'eng_ryan', technicalDomainId: 'td_mobile', years: 4 },
  { id: 'etde_emma_frontend', engineerId: 'eng_emma', technicalDomainId: 'td_frontend', years: 5 },
  { id: 'etde_emma_react', engineerId: 'eng_emma', technicalDomainId: 'td_react_ecosystem', years: 4 },

  // Senior Engineers Technical Domain Experience
  { id: 'etde_greg_backend', engineerId: 'eng_greg', technicalDomainId: 'td_backend', years: 7 },
  { id: 'etde_natasha_fullstack', engineerId: 'eng_natasha', technicalDomainId: 'td_fullstack', years: 8 },
  { id: 'etde_nathan_ml', engineerId: 'eng_nathan', technicalDomainId: 'td_ml', years: 6 },
  { id: 'etde_nathan_data', engineerId: 'eng_nathan', technicalDomainId: 'td_data_engineering', years: 5 },
  { id: 'etde_wei_data', engineerId: 'eng_wei', technicalDomainId: 'td_data_engineering', years: 8 },
  { id: 'etde_wei_distributed', engineerId: 'eng_wei', technicalDomainId: 'td_distributed_systems', years: 6 },
  { id: 'etde_derek_fullstack', engineerId: 'eng_derek', technicalDomainId: 'td_fullstack', years: 7 },
  { id: 'etde_derek_devops', engineerId: 'eng_derek', technicalDomainId: 'td_devops', years: 4 },
  { id: 'etde_takeshi_backend', engineerId: 'eng_takeshi', technicalDomainId: 'td_backend', years: 7 },
  { id: 'etde_takeshi_distributed', engineerId: 'eng_takeshi', technicalDomainId: 'td_distributed_systems', years: 5 },
  { id: 'etde_sarah_frontend', engineerId: 'eng_sarah', technicalDomainId: 'td_frontend', years: 6 },
  { id: 'etde_sarah_react', engineerId: 'eng_sarah', technicalDomainId: 'td_react_ecosystem', years: 6 },
  { id: 'etde_ravi_fullstack', engineerId: 'eng_ravi', technicalDomainId: 'td_fullstack', years: 8 },
  { id: 'etde_olivia_ml', engineerId: 'eng_olivia', technicalDomainId: 'td_ml', years: 7 },
  { id: 'etde_olivia_data', engineerId: 'eng_olivia', technicalDomainId: 'td_data_engineering', years: 4 },
  { id: 'etde_lucas_cloud', engineerId: 'eng_lucas', technicalDomainId: 'td_cloud', years: 7 },
  { id: 'etde_lucas_devops', engineerId: 'eng_lucas', technicalDomainId: 'td_devops', years: 6 },

  // Staff Engineers Technical Domain Experience
  { id: 'etde_anika_distributed', engineerId: 'eng_anika', technicalDomainId: 'td_distributed_systems', years: 8 },
  { id: 'etde_anika_devops', engineerId: 'eng_anika', technicalDomainId: 'td_devops', years: 7 },
  { id: 'etde_anika_kubernetes', engineerId: 'eng_anika', technicalDomainId: 'td_kubernetes', years: 7 },
  { id: 'etde_alex_backend', engineerId: 'eng_alex', technicalDomainId: 'td_backend', years: 9 },
  { id: 'etde_alex_distributed', engineerId: 'eng_alex', technicalDomainId: 'td_distributed_systems', years: 6 },
  { id: 'etde_dmitri_ml', engineerId: 'eng_dmitri', technicalDomainId: 'td_ml', years: 10 },
  { id: 'etde_dmitri_data', engineerId: 'eng_dmitri', technicalDomainId: 'td_data_engineering', years: 6 },
  { id: 'etde_jennifer_frontend', engineerId: 'eng_jennifer', technicalDomainId: 'td_frontend', years: 9 },
  { id: 'etde_jennifer_react', engineerId: 'eng_jennifer', technicalDomainId: 'td_react_ecosystem', years: 8 },
  { id: 'etde_michael_devops', engineerId: 'eng_michael', technicalDomainId: 'td_devops', years: 11 },
  { id: 'etde_michael_cloud', engineerId: 'eng_michael', technicalDomainId: 'td_cloud', years: 10 },
  { id: 'etde_michael_kubernetes', engineerId: 'eng_michael', technicalDomainId: 'td_kubernetes', years: 6 },
  { id: 'etde_sanjay_data', engineerId: 'eng_sanjay', technicalDomainId: 'td_data_engineering', years: 10 },
  { id: 'etde_sanjay_distributed', engineerId: 'eng_sanjay', technicalDomainId: 'td_distributed_systems', years: 7 },
  { id: 'etde_christine_fullstack', engineerId: 'eng_christine', technicalDomainId: 'td_fullstack', years: 9 },
  { id: 'etde_christine_backend', engineerId: 'eng_christine', technicalDomainId: 'td_backend', years: 8 },
  { id: 'etde_hassan_cloud', engineerId: 'eng_hassan', technicalDomainId: 'td_cloud', years: 10 },
  { id: 'etde_hassan_devops', engineerId: 'eng_hassan', technicalDomainId: 'td_devops', years: 8 },

  // Principal Engineers Technical Domain Experience
  { id: 'etde_victoria_distributed', engineerId: 'eng_victoria', technicalDomainId: 'td_distributed_systems', years: 12 },
  { id: 'etde_victoria_cloud', engineerId: 'eng_victoria', technicalDomainId: 'td_cloud', years: 10 },
  { id: 'etde_victoria_devops', engineerId: 'eng_victoria', technicalDomainId: 'td_devops', years: 8 },
  { id: 'etde_victoria_kubernetes', engineerId: 'eng_victoria', technicalDomainId: 'td_kubernetes', years: 8 },
  { id: 'etde_robert_ml', engineerId: 'eng_robert', technicalDomainId: 'td_ml', years: 12 },
  { id: 'etde_robert_data', engineerId: 'eng_robert', technicalDomainId: 'td_data_engineering', years: 10 },
  { id: 'etde_robert_backend', engineerId: 'eng_robert', technicalDomainId: 'td_backend', years: 8 },
  { id: 'etde_elena_cloud', engineerId: 'eng_elena', technicalDomainId: 'td_cloud', years: 10 },
  { id: 'etde_elena_devops', engineerId: 'eng_elena', technicalDomainId: 'td_devops', years: 8 },
  { id: 'etde_elena_kubernetes', engineerId: 'eng_elena', technicalDomainId: 'td_kubernetes', years: 7 },
];
