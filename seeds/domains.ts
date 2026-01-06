import type {
  BusinessDomain,
  BusinessDomainHierarchy,
  TechnicalDomain,
  TechnicalDomainHierarchy,
  TechnicalDomainEncompasses,
} from './types';

// ============================================
// BUSINESS DOMAINS - with hierarchy support
// ============================================

export const businessDomains: BusinessDomain[] = [
  // Top-level parent domains
  { id: 'bd_finance', name: 'Finance', description: 'Financial services and technology' },
  { id: 'bd_healthcare', name: 'Healthcare', description: 'Healthcare and medical technology' },
  { id: 'bd_retail', name: 'Retail', description: 'Retail and commerce' },

  // Finance children
  { id: 'bd_fintech', name: 'Fintech', description: 'Financial technology startups and innovation' },
  { id: 'bd_banking', name: 'Banking', description: 'Traditional banking and financial institutions' },
  { id: 'bd_payments', name: 'Payments', description: 'Payment processing and infrastructure' },
  { id: 'bd_insurance', name: 'Insurance', description: 'Insurance technology' },

  // Healthcare children
  { id: 'bd_pharma', name: 'Pharmaceuticals', description: 'Drug development and pharma tech' },
  { id: 'bd_medical_devices', name: 'Medical Devices', description: 'Medical device software and hardware' },
  { id: 'bd_telemedicine', name: 'Telemedicine', description: 'Remote healthcare and telehealth' },
  { id: 'bd_health_insurance', name: 'Health Insurance', description: 'Health insurance technology' },

  // Retail children
  { id: 'bd_ecommerce', name: 'E-commerce', description: 'Online retail and marketplaces' },
  { id: 'bd_marketplace', name: 'Marketplace', description: 'Multi-vendor marketplace platforms' },

  // Standalone domains (no parent)
  { id: 'bd_saas', name: 'SaaS', description: 'Software as a Service products' },
  { id: 'bd_gaming', name: 'Gaming', description: 'Video games and interactive entertainment' },
  { id: 'bd_edtech', name: 'EdTech', description: 'Education technology' },
  { id: 'bd_logistics', name: 'Logistics', description: 'Supply chain and logistics' },
];

// ============================================
// BUSINESS DOMAIN HIERARCHY (CHILD_OF)
// Child domain experience satisfies parent domain requirements
// ============================================

export const businessDomainHierarchy: BusinessDomainHierarchy[] = [
  // Finance children
  { childDomainId: 'bd_fintech', parentDomainId: 'bd_finance' },
  { childDomainId: 'bd_banking', parentDomainId: 'bd_finance' },
  { childDomainId: 'bd_payments', parentDomainId: 'bd_finance' },
  { childDomainId: 'bd_insurance', parentDomainId: 'bd_finance' },

  // Healthcare children
  { childDomainId: 'bd_pharma', parentDomainId: 'bd_healthcare' },
  { childDomainId: 'bd_medical_devices', parentDomainId: 'bd_healthcare' },
  { childDomainId: 'bd_telemedicine', parentDomainId: 'bd_healthcare' },
  { childDomainId: 'bd_health_insurance', parentDomainId: 'bd_healthcare' },

  // Retail children
  { childDomainId: 'bd_ecommerce', parentDomainId: 'bd_retail' },
  { childDomainId: 'bd_marketplace', parentDomainId: 'bd_retail' },
];

// ============================================
// TECHNICAL DOMAINS
// ============================================

export const technicalDomains: TechnicalDomain[] = [
  // Top-level domains
  { id: 'td_backend', name: 'Backend' },
  { id: 'td_frontend', name: 'Frontend' },
  { id: 'td_fullstack', name: 'Full Stack', isComposite: true },
  { id: 'td_ml', name: 'Machine Learning' },
  { id: 'td_data_engineering', name: 'Data Engineering' },
  { id: 'td_devops', name: 'DevOps' },
  { id: 'td_mobile', name: 'Mobile Development' },
  { id: 'td_security', name: 'Security' },

  // Backend sub-domains
  { id: 'td_api_dev', name: 'API Development' },
  { id: 'td_database_eng', name: 'Database Engineering' },
  { id: 'td_distributed_systems', name: 'Distributed Systems' },

  // Frontend sub-domains
  { id: 'td_react_ecosystem', name: 'React Ecosystem' },
  { id: 'td_web_performance', name: 'Web Performance' },

  // ML sub-domains
  { id: 'td_nlp', name: 'NLP' },
  { id: 'td_computer_vision', name: 'Computer Vision' },
  { id: 'td_mlops', name: 'MLOps' },

  // DevOps sub-domains
  { id: 'td_cloud', name: 'Cloud Infrastructure' },
  { id: 'td_kubernetes', name: 'Kubernetes/Containers' },
  { id: 'td_cicd', name: 'CI/CD' },
];

// ============================================
// TECHNICAL DOMAIN HIERARCHY (CHILD_OF)
// Child domain experience implies parent domain experience
// ============================================

export const technicalDomainHierarchy: TechnicalDomainHierarchy[] = [
  // Backend children
  { childDomainId: 'td_api_dev', parentDomainId: 'td_backend' },
  { childDomainId: 'td_database_eng', parentDomainId: 'td_backend' },
  { childDomainId: 'td_distributed_systems', parentDomainId: 'td_backend' },

  // Frontend children
  { childDomainId: 'td_react_ecosystem', parentDomainId: 'td_frontend' },
  { childDomainId: 'td_web_performance', parentDomainId: 'td_frontend' },

  // ML children
  { childDomainId: 'td_nlp', parentDomainId: 'td_ml' },
  { childDomainId: 'td_computer_vision', parentDomainId: 'td_ml' },
  { childDomainId: 'td_mlops', parentDomainId: 'td_ml' },

  // DevOps children
  { childDomainId: 'td_cloud', parentDomainId: 'td_devops' },
  { childDomainId: 'td_kubernetes', parentDomainId: 'td_devops' },
  { childDomainId: 'td_cicd', parentDomainId: 'td_devops' },
];

// ============================================
// TECHNICAL DOMAIN ENCOMPASSES
// Composite domain experience implies encompassed domain experience
// (no upward inference: Backend + Frontend does NOT imply Full Stack)
// ============================================

export const technicalDomainEncompasses: TechnicalDomainEncompasses[] = [
  { compositeDomainId: 'td_fullstack', encompassedDomainId: 'td_backend' },
  { compositeDomainId: 'td_fullstack', encompassedDomainId: 'td_frontend' },
];
