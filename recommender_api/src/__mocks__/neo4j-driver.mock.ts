import { vi } from 'vitest';
import { createMockSession, type QueryMatcher } from './neo4j-session.mock.js';
import type { Driver } from 'neo4j-driver';

// Extended Driver type with test helper method
export interface MockDriver extends Driver {
  __setMatchers: (matchers: QueryMatcher[]) => void;
}

// Create a mock driver that returns configurable sessions
export function createMockDriver(defaultMatchers: QueryMatcher[] = []): MockDriver {
  let sessionMatchers = defaultMatchers;

  return {
    session: vi.fn(() => createMockSession(sessionMatchers)),
    close: vi.fn().mockResolvedValue(undefined),
    verifyConnectivity: vi.fn().mockResolvedValue(undefined),
    getServerInfo: vi.fn().mockResolvedValue({
      address: 'mock:7687',
      protocolVersion: 5.0,
    }),
    // Allow updating matchers for different test scenarios
    __setMatchers: (matchers: QueryMatcher[]) => {
      sessionMatchers = matchers;
    },
  } as unknown as MockDriver;
}
