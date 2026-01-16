import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createMockSession, mockData } from '../__mocks__/neo4j-session.mock.js';

// Mock the neo4j driver module
vi.mock('../neo4j.js', () => ({
  default: {
    session: vi.fn(),
    close: vi.fn(),
  },
}));

import driver from '../neo4j.js';

describe('POST /api/search/filter', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful requests', () => {
    it('returns 200 for empty request (browse mode)', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          /* totalCount >= 3 avoids triggering constraint advisor */
          result: [mockData.createEngineerRecord({ totalCount: 10 })],
        },
      ]);
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.matches).toBeDefined();
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('returns matches array with engineer data', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH (e:Engineer)',
          result: [
            /*
             * Set totalCount >= 3 to avoid triggering constraint advisor
             * (sparse results threshold), which would make additional queries
             * that the mock isn't configured to handle.
             */
            mockData.createEngineerRecord({ id: 'eng-1', name: 'Alice', totalCount: 10 }),
            mockData.createEngineerRecord({ id: 'eng-2', name: 'Bob', totalCount: 10 }),
          ],
        },
      ]);
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.matches).toHaveLength(2);
      expect(response.body.matches[0].name).toBe('Alice');
    });

    it('returns pagination metadata', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          result: [
            mockData.createEngineerRecord({ totalCount: 50 }),
          ],
        },
      ]);
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({ limit: 20, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.totalCount).toBe(50);
      expect(response.body.queryMetadata).toBeDefined();
    });

    it('returns appliedFilters and appliedPreferences', async () => {
      const mockSession = createMockSession([
        {
          pattern: 'MATCH',
          /* totalCount >= 3 avoids triggering constraint advisor */
          result: [mockData.createEngineerRecord({ totalCount: 10 })],
        },
      ]);
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.appliedFilters).toBeDefined();
      expect(response.body.appliedFilters).toBeInstanceOf(Array);
      expect(response.body.appliedPreferences).toBeDefined();
      expect(response.body.appliedPreferences).toBeInstanceOf(Array);
    });
  });

  describe('validation errors', () => {
    it('returns 400 for invalid seniority level', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ requiredSeniorityLevel: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.name).toBe('ZodError');
    });

    it('returns 400 for stretchBudget without maxBudget', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ stretchBudget: 220000 });

      expect(response.status).toBe(400);
      expect(response.body.error.issues[0].message).toContain('maxBudget');
    });

    it('returns 400 for stretchBudget less than maxBudget', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ maxBudget: 200000, stretchBudget: 180000 });

      expect(response.status).toBe(400);
      expect(response.body.error.issues[0].message).toContain('greater than or equal');
    });

    it('returns 400 for preferredMaxStartTime later than requiredMaxStartTime', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({
          requiredMaxStartTime: 'two_weeks',
          preferredMaxStartTime: 'one_month',
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 for negative limit', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ limit: -1 });

      expect(response.status).toBe(400);
    });

    it('returns 400 for limit exceeding max', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ limit: 101 });

      expect(response.status).toBe(400);
    });

    it('returns 400 for negative offset', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ offset: -1 });

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid timeline value', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ requiredMaxStartTime: 'invalid_timeline' });

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid teamFocus value', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({ teamFocus: 'invalid_focus' });

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid proficiency level in skills', async () => {
      const response = await request(app)
        .post('/api/search/filter')
        .send({
          requiredSkills: [{ skill: 'typescript', minProficiency: 'invalid' }],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('error handling', () => {
    it('returns 500 for Neo4j connection failure', async () => {
      const mockSession = createMockSession();
      mockSession.run = vi.fn().mockRejectedValue(new Error('Connection refused'));
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('SEARCH_ERROR');
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('closes session even on error', async () => {
      const mockSession = createMockSession();
      mockSession.run = vi.fn().mockRejectedValue(new Error('Query failed'));
      vi.mocked(driver.session).mockReturnValue(mockSession);

      await request(app)
        .post('/api/search/filter')
        .send({});

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('returns error details in response', async () => {
      const mockSession = createMockSession();
      mockSession.run = vi.fn().mockRejectedValue(new Error('Syntax error in query'));
      vi.mocked(driver.session).mockReturnValue(mockSession);

      const response = await request(app)
        .post('/api/search/filter')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details[0].message).toContain('Syntax error');
    });
  });
});

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });
});

describe('GET /db-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 when database is connected', async () => {
    const mockSession = createMockSession([
      { pattern: 'RETURN 1', result: [{ health: 1 }] },
    ]);
    vi.mocked(driver.session).mockReturnValue(mockSession);

    const app = createApp();
    const response = await request(app).get('/db-health');

    expect(response.status).toBe(200);
    expect(response.body.database).toBe('connected');
  });

  it('returns 500 when database is disconnected', async () => {
    const mockSession = createMockSession();
    mockSession.run = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.mocked(driver.session).mockReturnValue(mockSession);

    const app = createApp();
    const response = await request(app).get('/db-health');

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('health check failed');
  });

  it('closes session after health check', async () => {
    const mockSession = createMockSession([
      { pattern: 'RETURN 1', result: [{ health: 1 }] },
    ]);
    vi.mocked(driver.session).mockReturnValue(mockSession);

    const app = createApp();
    await request(app).get('/db-health');

    expect(mockSession.close).toHaveBeenCalled();
  });

  it('closes session even when health check fails', async () => {
    const mockSession = createMockSession();
    mockSession.run = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.mocked(driver.session).mockReturnValue(mockSession);

    const app = createApp();
    await request(app).get('/db-health');

    expect(mockSession.close).toHaveBeenCalled();
  });
});
