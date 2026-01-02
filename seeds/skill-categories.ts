import type { SkillCategory, SkillCategoryDomainMapping } from './types';

// ============================================
// SKILL CATEGORIES
// Extracted from Skill nodes with isCategory: true
// These are now separate SkillCategory nodes
// ============================================

export const skillCategories: SkillCategory[] = [
  // Technical categories
  { id: 'sc_frontend_frameworks', name: 'Frontend Frameworks' },
  { id: 'sc_backend_frameworks', name: 'Backend Frameworks' },
  { id: 'sc_backend_languages', name: 'Backend Languages' },
  { id: 'sc_databases', name: 'Databases' },
  { id: 'sc_cloud', name: 'Cloud Platforms' },
  { id: 'sc_containers', name: 'Containerization' },
  { id: 'sc_cicd', name: 'CI/CD' },
  { id: 'sc_testing', name: 'Testing' },
  { id: 'sc_observability', name: 'Observability' },
  { id: 'sc_security', name: 'Security' },
  { id: 'sc_design', name: 'Design & Architecture' },

  // Behavioral categories
  { id: 'sc_leadership', name: 'Leadership' },
  { id: 'sc_communication', name: 'Communication' },
  { id: 'sc_problem_solving', name: 'Problem Solving' },
  { id: 'sc_execution', name: 'Execution & Delivery' },
  { id: 'sc_collaboration', name: 'Collaboration' },
  { id: 'sc_growth', name: 'Growth & Adaptability' },
];

// ============================================
// SKILL CATEGORY → TECHNICAL DOMAIN MAPPINGS
// Only technical categories map to domains
// Behavioral categories do NOT map to TechnicalDomains
// ============================================

export const skillCategoryDomainMappings: SkillCategoryDomainMapping[] = [
  { skillCategoryId: 'sc_frontend_frameworks', technicalDomainId: 'td_frontend' },
  { skillCategoryId: 'sc_backend_frameworks', technicalDomainId: 'td_api_dev' },
  { skillCategoryId: 'sc_backend_languages', technicalDomainId: 'td_backend' },
  { skillCategoryId: 'sc_databases', technicalDomainId: 'td_database_eng' },
  { skillCategoryId: 'sc_cloud', technicalDomainId: 'td_cloud' },
  { skillCategoryId: 'sc_containers', technicalDomainId: 'td_kubernetes' },
  { skillCategoryId: 'sc_cicd', technicalDomainId: 'td_cicd' },
  { skillCategoryId: 'sc_design', technicalDomainId: 'td_backend' },
  // sc_testing, sc_observability, sc_security, and behavioral categories
  // do NOT map to technical domains
];
