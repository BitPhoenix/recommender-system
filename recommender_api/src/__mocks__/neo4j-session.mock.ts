import { vi } from 'vitest';
import type { Session } from 'neo4j-driver';

// Type for mock record factory
interface MockRecordData {
  [key: string]: unknown;
}

// Interface that matches the Neo4j Record API used by our code
export interface MockRecord {
  get: (key: string | number) => unknown;
  has: (key: string | number) => boolean;
  keys: string[];
  toObject: () => MockRecordData;
}

// Interface that matches the QueryResult API used by our code
export interface MockQueryResult {
  records: MockRecord[];
  summary: {
    query: { text: string; parameters: Record<string, unknown> };
  };
}

// Create a mock Neo4j record
export function createMockRecord(data: MockRecordData): MockRecord {
  const keys = Object.keys(data);
  const fields = Object.values(data);

  return {
    get: (key: string | number) => {
      if (typeof key === 'number') {
        return fields[key];
      }
      return data[key];
    },
    has: (key: string | number) => {
      if (typeof key === 'number') {
        return key >= 0 && key < fields.length;
      }
      return key in data;
    },
    keys,
    toObject: () => data,
  };
}

// Create a mock query result
export function createMockQueryResult(records: MockRecordData[]): MockQueryResult {
  return {
    records: records.map(createMockRecord),
    summary: {
      query: { text: '', parameters: {} },
    },
  };
}

// Query matcher type
export type QueryMatcher = {
  pattern: string | RegExp;
  result: MockRecordData[];
};

// Mock session interface matching the Session API used by our code
export interface MockSession {
  run: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

// Create a configurable mock session
export function createMockSession(matchers: QueryMatcher[] = []): MockSession & Session {
  const runMock = vi.fn().mockImplementation((query: string) => {
    // Find matching pattern
    for (const matcher of matchers) {
      const matches = typeof matcher.pattern === 'string'
        ? query.includes(matcher.pattern)
        : matcher.pattern.test(query);

      if (matches) {
        return Promise.resolve(createMockQueryResult(matcher.result));
      }
    }

    // Default: return empty result
    return Promise.resolve(createMockQueryResult([]));
  });

  const closeMock = vi.fn().mockResolvedValue(undefined);

  return {
    run: runMock,
    close: closeMock,
    lastBookmark: () => [],
    lastBookmarks: () => [],
    beginTransaction: vi.fn(),
    readTransaction: vi.fn(),
    writeTransaction: vi.fn(),
    executeRead: vi.fn(),
    executeWrite: vi.fn(),
  } as unknown as MockSession & Session;
}

// Pre-configured mock data factories
export const mockData = {
  // Engineer record matching search query output
  createEngineerRecord: (overrides: Partial<{
    id: string;
    name: string;
    headline: string;
    salary: number;
    yearsExperience: number;
    startTimeline: string;
    timezone: string;
    avgConfidence: number;
    totalCount: number;
    matchedSkills: unknown[];
    unmatchedRelatedSkills: unknown[];
    matchedBusinessDomains: unknown[];
    matchedTechnicalDomains: unknown[];
  }> = {}) => ({
    id: 'eng-1',
    name: 'Test Engineer',
    headline: 'Senior Developer',
    salary: 150000,
    yearsExperience: 8,
    startTimeline: 'two_weeks',
    timezone: 'Eastern',
    avgConfidence: 0.85,
    totalCount: 1,
    matchedSkills: [],
    unmatchedRelatedSkills: [],
    matchedBusinessDomains: [],
    matchedTechnicalDomains: [],
    ...overrides,
  }),

  // Skill resolution record
  createSkillRecord: (overrides: Partial<{
    skillId: string;
    skillName: string;
    leafSkillIds: string[];
  }> = {}) => ({
    skillId: 'skill-1',
    skillName: 'TypeScript',
    leafSkillIds: ['skill-1'],
    ...overrides,
  }),

  // Domain resolution record
  createDomainRecord: (overrides: Partial<{
    domainId: string;
    domainName: string;
    childDomainIds: string[];
  }> = {}) => ({
    domainId: 'domain-1',
    domainName: 'Finance',
    childDomainIds: ['domain-1'],
    ...overrides,
  }),
};
