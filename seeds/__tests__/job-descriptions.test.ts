import { describe, it, expect } from 'vitest';
import {
  jobDescriptions,
  jobRequiredSkills,
  jobPreferredSkills,
  jobRequiredBusinessDomains,
  jobPreferredBusinessDomains,
  jobRequiredTechnicalDomains,
  jobPreferredTechnicalDomains,
} from '../job-descriptions';
import { skills } from '../skills';
import { businessDomains, technicalDomains } from '../domains';

describe('Job Description Seed Data Validation', () => {
  const skillIds = new Set(skills.map(s => s.id));
  const businessDomainIds = new Set(businessDomains.map(d => d.id));
  const technicalDomainIds = new Set(technicalDomains.map(d => d.id));
  const jobIds = new Set(jobDescriptions.map(j => j.id));

  describe('jobDescriptions', () => {
    it('covers all seniority levels', () => {
      const seniorities = new Set(jobDescriptions.map(j => j.seniority));
      expect(seniorities).toContain('junior');
      expect(seniorities).toContain('mid');
      expect(seniorities).toContain('senior');
      expect(seniorities).toContain('staff');
      expect(seniorities).toContain('principal');
    });

    it('has unique job IDs', () => {
      const ids = jobDescriptions.map(j => j.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has valid startTimeline values', () => {
      const validTimelines = ['immediate', 'two_weeks', 'one_month', 'three_months', 'six_months', 'one_year'];
      for (const job of jobDescriptions) {
        expect(validTimelines).toContain(job.startTimeline);
      }
    });

    it('has valid timezone values', () => {
      const validTimezones = ['Eastern', 'Central', 'Mountain', 'Pacific'];
      for (const job of jobDescriptions) {
        for (const tz of job.timezone) {
          expect(validTimezones).toContain(tz);
        }
      }
    });

    it('has minBudget <= maxBudget', () => {
      for (const job of jobDescriptions) {
        expect(job.minBudget).toBeLessThanOrEqual(job.maxBudget);
        if (job.stretchBudget) {
          expect(job.maxBudget).toBeLessThanOrEqual(job.stretchBudget);
        }
      }
    });
  });

  describe('jobRequiredSkills', () => {
    it('references only valid job IDs', () => {
      for (const req of jobRequiredSkills) {
        expect(jobIds.has(req.jobId)).toBe(true);
      }
    });

    it('references only valid skill IDs', () => {
      for (const req of jobRequiredSkills) {
        expect(skillIds.has(req.skillId)).toBe(true);
      }
    });
  });

  describe('jobPreferredSkills', () => {
    it('references only valid job IDs', () => {
      for (const pref of jobPreferredSkills) {
        expect(jobIds.has(pref.jobId)).toBe(true);
      }
    });

    it('references only valid skill IDs', () => {
      for (const pref of jobPreferredSkills) {
        expect(skillIds.has(pref.skillId)).toBe(true);
      }
    });
  });

  describe('jobRequiredBusinessDomains', () => {
    it('references only valid job IDs', () => {
      for (const req of jobRequiredBusinessDomains) {
        expect(jobIds.has(req.jobId)).toBe(true);
      }
    });

    it('references only valid business domain IDs', () => {
      for (const req of jobRequiredBusinessDomains) {
        expect(businessDomainIds.has(req.businessDomainId)).toBe(true);
      }
    });
  });

  describe('jobPreferredBusinessDomains', () => {
    it('references only valid job IDs', () => {
      for (const pref of jobPreferredBusinessDomains) {
        expect(jobIds.has(pref.jobId)).toBe(true);
      }
    });

    it('references only valid business domain IDs', () => {
      for (const pref of jobPreferredBusinessDomains) {
        expect(businessDomainIds.has(pref.businessDomainId)).toBe(true);
      }
    });
  });

  describe('jobRequiredTechnicalDomains', () => {
    it('references only valid job IDs', () => {
      for (const req of jobRequiredTechnicalDomains) {
        expect(jobIds.has(req.jobId)).toBe(true);
      }
    });

    it('references only valid technical domain IDs', () => {
      for (const req of jobRequiredTechnicalDomains) {
        expect(technicalDomainIds.has(req.technicalDomainId)).toBe(true);
      }
    });
  });

  describe('jobPreferredTechnicalDomains', () => {
    it('references only valid job IDs', () => {
      for (const pref of jobPreferredTechnicalDomains) {
        expect(jobIds.has(pref.jobId)).toBe(true);
      }
    });

    it('references only valid technical domain IDs', () => {
      for (const pref of jobPreferredTechnicalDomains) {
        expect(technicalDomainIds.has(pref.technicalDomainId)).toBe(true);
      }
    });
  });
});
