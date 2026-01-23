import { describe, it, expect, vi } from 'vitest';
import { normalizeCompanyName } from './company-normalizer.service.js';
import { createMockSession } from '../__mocks__/neo4j-session.mock.js';

describe('company-normalizer.service', () => {
  describe('normalizeCompanyName', () => {
    describe('suffix stripping', () => {
      it('strips ", Inc." suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'Stripe, Inc.');

        expect(result.normalizedName).toBe('stripe');
      });

      it('strips " Inc." suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'Stripe Inc.');

        expect(result.normalizedName).toBe('stripe');
      });

      it('strips " Inc" suffix (no period)', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'Stripe Inc');

        expect(result.normalizedName).toBe('stripe');
      });

      it('strips ", LLC" suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'TechCo, LLC');

        expect(result.normalizedName).toBe('techco');
      });

      it('strips " LLC" suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'TechCo LLC');

        expect(result.normalizedName).toBe('techco');
      });

      it('strips ", Corp." suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'BigCompany, Corp.');

        expect(result.normalizedName).toBe('bigcompany');
      });

      it('strips " Corp." suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'BigCompany Corp.');

        expect(result.normalizedName).toBe('bigcompany');
      });

      it('strips " Corp" suffix (no period)', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'BigCompany Corp');

        expect(result.normalizedName).toBe('bigcompany');
      });

      it('strips " Corporation" suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'BigCompany Corporation');

        expect(result.normalizedName).toBe('bigcompany');
      });

      it('strips ", L.P." suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'Investment Partners, L.P.');

        expect(result.normalizedName).toBe('investment partners');
      });

      it('strips " L.P." suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'Investment Partners L.P.');

        expect(result.normalizedName).toBe('investment partners');
      });

      it('strips " LP" suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'Investment Partners LP');

        expect(result.normalizedName).toBe('investment partners');
      });

      it('strips ", L.L.C." suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'TechCo, L.L.C.');

        expect(result.normalizedName).toBe('techco');
      });

      it('strips " L.L.C." suffix', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'TechCo L.L.C.');

        expect(result.normalizedName).toBe('techco');
      });

      it('handles multiple suffix formats correctly (only strips one)', async () => {
        const mockSession = createMockSession();

        // Should only strip the first matching suffix
        const result = await normalizeCompanyName(mockSession, 'Corp, Inc.');

        expect(result.normalizedName).toBe('corp');
      });
    });

    describe('exact match', () => {
      it('returns exact match when company exists (method "exact")', async () => {
        const mockSession = createMockSession([
          {
            pattern: 'Company {normalizedName',
            result: [{ companyId: 'company_google', companyName: 'Google' }],
          },
        ]);

        const result = await normalizeCompanyName(mockSession, 'Google');

        expect(result.canonicalCompanyId).toBe('company_google');
        expect(result.canonicalCompanyName).toBe('Google');
        expect(result.method).toBe('exact');
        expect(result.normalizedName).toBe('google');
      });

      it('matches with case insensitivity', async () => {
        const mockSession = createMockSession([
          {
            pattern: 'Company {normalizedName',
            result: [{ companyId: 'company_google', companyName: 'Google' }],
          },
        ]);

        const result = await normalizeCompanyName(mockSession, 'GOOGLE');

        expect(result.canonicalCompanyId).toBe('company_google');
        expect(result.method).toBe('exact');
      });
    });

    describe('alias match', () => {
      it('returns alias match when company alias exists (method "alias")', async () => {
        const mockSession = createMockSession([
          {
            pattern: 'CompanyAlias',
            result: [{ companyId: 'company_meta', companyName: 'Meta' }],
          },
        ]);

        const result = await normalizeCompanyName(mockSession, 'Facebook');

        expect(result.canonicalCompanyId).toBe('company_meta');
        expect(result.canonicalCompanyName).toBe('Meta');
        expect(result.method).toBe('alias');
        expect(result.normalizedName).toBe('facebook');
      });

      it('resolves common abbreviations via alias', async () => {
        const mockSession = createMockSession([
          {
            pattern: 'CompanyAlias',
            result: [{ companyId: 'company_amazon', companyName: 'Amazon' }],
          },
        ]);

        const result = await normalizeCompanyName(mockSession, 'AWS');

        expect(result.canonicalCompanyId).toBe('company_amazon');
        expect(result.method).toBe('alias');
      });
    });

    describe('new company', () => {
      it('returns null canonicalId for unknown company (method "new")', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'Unknown Startup XYZ');

        expect(result.canonicalCompanyId).toBeNull();
        expect(result.canonicalCompanyName).toBeNull();
        expect(result.method).toBe('new');
        expect(result.normalizedName).toBe('unknown startup xyz');
      });

      it('provides normalized name for new company creation', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'My New Startup, Inc.');

        expect(result.normalizedName).toBe('my new startup');
        expect(result.method).toBe('new');
      });
    });

    describe('edge cases', () => {
      it('handles whitespace in company name', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, '  Startup Inc.  ');

        expect(result.normalizedName).toBe('startup');
      });

      it('handles empty string', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, '');

        expect(result.normalizedName).toBe('');
        expect(result.method).toBe('new');
      });

      it('handles company name that is just a suffix', async () => {
        const mockSession = createMockSession();

        // "Inc." alone doesn't match any suffix pattern (suffix patterns expect preceding text)
        // So it gets lowercased to "inc."
        const result = await normalizeCompanyName(mockSession, 'Inc.');

        expect(result.normalizedName).toBe('inc.');
      });

      it('preserves spaces in multi-word company names', async () => {
        const mockSession = createMockSession();

        const result = await normalizeCompanyName(mockSession, 'Big Tech Company, Inc.');

        expect(result.normalizedName).toBe('big tech company');
      });
    });

    describe('query behavior', () => {
      it('queries exact match before alias match', async () => {
        const mockSession = createMockSession();
        const runSpy = vi.spyOn(mockSession, 'run');

        await normalizeCompanyName(mockSession, 'Google');

        const calls = runSpy.mock.calls.map((call) => call[0] as string);

        // First call should be for Company (exact match)
        expect(calls[0]).toContain('Company {normalizedName');
        // Second call should be for CompanyAlias
        expect(calls[1]).toContain('CompanyAlias');
      });

      it('does not query alias if exact match found', async () => {
        const mockSession = createMockSession([
          {
            pattern: 'Company {normalizedName',
            result: [{ companyId: 'company_google', companyName: 'Google' }],
          },
        ]);
        const runSpy = vi.spyOn(mockSession, 'run');

        await normalizeCompanyName(mockSession, 'Google');

        // Should only call once (for exact match)
        expect(runSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
