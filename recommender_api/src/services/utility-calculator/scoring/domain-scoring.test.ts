import { describe, it, expect } from 'vitest';
import {
  calculatePreferredBusinessDomainMatch,
  calculatePreferredTechnicalDomainMatch,
} from './domain-scoring.js';
import type { BusinessDomainMatch, TechnicalDomainMatch } from '../../../types/search.types.js';
import type { ResolvedBusinessDomain, ResolvedTechnicalDomain } from '../../cypher-query-builder/query-types.js';

describe('calculatePreferredBusinessDomainMatch', () => {
  const createBusinessDomain = (domainId: string, meetsPreferred = true): BusinessDomainMatch => ({
    domainId,
    domainName: domainId,
    engineerYears: 3,
    meetsRequired: true,
    meetsPreferred,
  });

  const createPreferredDomain = (domainId: string): ResolvedBusinessDomain => ({
    domainId,
    expandedDomainIds: [domainId],
    preferredMinYears: 2,
  });

  it('returns maxMatch when all preferred domains matched', () => {
    const domains = [createBusinessDomain('d1'), createBusinessDomain('d2')];
    const preferredDomains = [createPreferredDomain('d1'), createPreferredDomain('d2')];

    const result = calculatePreferredBusinessDomainMatch(domains, preferredDomains, 0.02);
    expect(result.raw).toBe(0.02);
    expect(result.matchedDomainNames).toEqual(['d1', 'd2']);
  });

  it('returns proportional score for partial match', () => {
    const domains = [createBusinessDomain('d1')];
    const preferredDomains = [createPreferredDomain('d1'), createPreferredDomain('d2')];

    const result = calculatePreferredBusinessDomainMatch(domains, preferredDomains, 0.02);
    expect(result.raw).toBe(0.01); // 1/2 * 0.02
  });

  it('returns 0 when no preferred domains specified', () => {
    const domains = [createBusinessDomain('d1')];
    const result = calculatePreferredBusinessDomainMatch(domains, [], 0.02);
    expect(result.raw).toBe(0);
  });

  it('only counts domains that meet preferred criteria', () => {
    const domains = [
      createBusinessDomain('d1', true),  // meets preferred
      createBusinessDomain('d2', false), // doesn't meet preferred
    ];
    const preferredDomains = [createPreferredDomain('d1'), createPreferredDomain('d2')];

    const result = calculatePreferredBusinessDomainMatch(domains, preferredDomains, 0.02);
    expect(result.raw).toBe(0.01); // only d1 counts
    expect(result.matchedDomainNames).toEqual(['d1']);
  });
});

describe('calculatePreferredTechnicalDomainMatch', () => {
  const createTechnicalDomain = (domainId: string, meetsPreferred = true): TechnicalDomainMatch => ({
    domainId,
    domainName: domainId,
    engineerYears: 3,
    meetsRequired: true,
    meetsPreferred,
    matchType: 'direct',
  });

  const createPreferredDomain = (domainId: string): ResolvedTechnicalDomain => ({
    domainId,
    expandedDomainIds: [domainId],
    preferredMinYears: 2,
  });

  it('returns maxMatch when all preferred domains matched', () => {
    const domains = [createTechnicalDomain('t1'), createTechnicalDomain('t2')];
    const preferredDomains = [createPreferredDomain('t1'), createPreferredDomain('t2')];

    const result = calculatePreferredTechnicalDomainMatch(domains, preferredDomains, 0.02);
    expect(result.raw).toBe(0.02);
  });

  it('returns proportional score for partial match', () => {
    const domains = [createTechnicalDomain('t1')];
    const preferredDomains = [createPreferredDomain('t1'), createPreferredDomain('t2')];

    const result = calculatePreferredTechnicalDomainMatch(domains, preferredDomains, 0.02);
    expect(result.raw).toBe(0.01);
  });

  it('only counts domains that meet preferred criteria', () => {
    const domains = [
      createTechnicalDomain('t1', true),
      createTechnicalDomain('t2', false),
    ];
    const preferredDomains = [createPreferredDomain('t1'), createPreferredDomain('t2')];

    const result = calculatePreferredTechnicalDomainMatch(domains, preferredDomains, 0.02);
    expect(result.raw).toBe(0.01);
    expect(result.matchedDomainNames).toEqual(['t1']);
  });
});
