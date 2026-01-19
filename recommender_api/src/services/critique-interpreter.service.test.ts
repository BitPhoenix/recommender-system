/**
 * Critique Interpreter Service Tests
 *
 * Tests the translation layer that converts critique adjustments
 * into modified SearchFilterRequest.
 */

import { describe, it, expect } from 'vitest';
import { applyAdjustmentsToSearchCriteria } from './critique-interpreter.service.js';
import type { SearchFilterRequest } from '../types/search.types.js';
import type { CritiqueAdjustment } from '../types/critique.types.js';

describe('critique-interpreter.service', () => {
  describe('applyAdjustmentsToSearchCriteria', () => {
    // ============================================
    // SENIORITY ADJUSTMENTS
    // ============================================

    describe('seniority adjustments', () => {
      it('should increase seniority with adjust/more', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSeniorityLevel: 'mid',
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'seniority', operation: 'adjust', direction: 'more' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSeniorityLevel).toBe('senior');
        expect(result.appliedCritiqueAdjustments).toHaveLength(1);
        expect(result.appliedCritiqueAdjustments[0].previousValue).toBe('mid');
        expect(result.appliedCritiqueAdjustments[0].newValue).toBe('senior');
        expect(result.failedCritiqueAdjustments).toHaveLength(0);
      });

      it('should decrease seniority with adjust/less', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSeniorityLevel: 'senior',
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'seniority', operation: 'adjust', direction: 'less' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSeniorityLevel).toBe('mid');
      });

      it('should return warning at maximum seniority', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSeniorityLevel: 'principal',
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'seniority', operation: 'adjust', direction: 'more' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSeniorityLevel).toBe('principal');
        expect(result.appliedCritiqueAdjustments[0].warning).toBe('Already at maximum seniority (principal)');
      });

      it('should return warning at minimum seniority', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSeniorityLevel: 'junior',
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'seniority', operation: 'adjust', direction: 'less' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSeniorityLevel).toBe('junior');
        expect(result.appliedCritiqueAdjustments[0].warning).toBe('Already at minimum seniority (junior)');
      });

      it('should set specific seniority with set operation', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSeniorityLevel: 'junior',
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'seniority', operation: 'set', value: 'staff' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSeniorityLevel).toBe('staff');
      });
    });

    // ============================================
    // BUDGET ADJUSTMENTS
    // ============================================

    describe('budget adjustments', () => {
      it('should increase budget by 20%', () => {
        const baseCriteria: SearchFilterRequest = {
          maxBudget: 100000,
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'budget', operation: 'adjust', direction: 'more' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.maxBudget).toBe(120000);
      });

      it('should decrease budget by 20%', () => {
        const baseCriteria: SearchFilterRequest = {
          maxBudget: 100000,
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'budget', operation: 'adjust', direction: 'less' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.maxBudget).toBe(80000);
      });

      it('should fail when adjusting non-existent budget', () => {
        const baseCriteria: SearchFilterRequest = {};
        const adjustments: CritiqueAdjustment[] = [
          { property: 'budget', operation: 'adjust', direction: 'more' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.appliedCritiqueAdjustments).toHaveLength(0);
        expect(result.failedCritiqueAdjustments).toHaveLength(1);
        expect(result.failedCritiqueAdjustments[0].reason).toContain('No budget constraint set');
      });

      it('should enforce budget floor', () => {
        const baseCriteria: SearchFilterRequest = {
          maxBudget: 35000,
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'budget', operation: 'adjust', direction: 'less' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.maxBudget).toBe(30000); // Floor value
        expect(result.appliedCritiqueAdjustments[0].warning).toContain('Budget floor reached');
      });

      it('should set specific budget', () => {
        const baseCriteria: SearchFilterRequest = {};
        const adjustments: CritiqueAdjustment[] = [
          { property: 'budget', operation: 'set', value: 150000 },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.maxBudget).toBe(150000);
      });
    });

    // ============================================
    // TIMELINE ADJUSTMENTS
    // ============================================

    describe('timeline adjustments', () => {
      it('should make timeline sooner', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredMaxStartTime: 'one_month',
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'timeline', operation: 'adjust', direction: 'sooner' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredMaxStartTime).toBe('two_weeks');
      });

      it('should make timeline later', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredMaxStartTime: 'one_month',
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'timeline', operation: 'adjust', direction: 'later' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredMaxStartTime).toBe('three_months');
      });

      it('should return warning at fastest timeline', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredMaxStartTime: 'immediate',
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'timeline', operation: 'adjust', direction: 'sooner' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredMaxStartTime).toBe('immediate');
        expect(result.appliedCritiqueAdjustments[0].warning).toBe('Already at fastest timeline (immediate)');
      });

      it('should set specific timeline', () => {
        const baseCriteria: SearchFilterRequest = {};
        const adjustments: CritiqueAdjustment[] = [
          { property: 'timeline', operation: 'set', value: 'two_weeks' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredMaxStartTime).toBe('two_weeks');
      });
    });

    // ============================================
    // TIMEZONE ADJUSTMENTS
    // ============================================

    describe('timezone adjustments', () => {
      it('should narrow timezone from multiple zones', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredTimezone: ['Eastern', 'Central', 'Mountain'],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'timezone', operation: 'adjust', direction: 'narrower' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        // Should remove outermost zones, keeping Central
        expect(result.modifiedSearchFilterRequest.requiredTimezone).toEqual(['Central']);
      });

      it('should widen timezone', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredTimezone: ['Central'],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'timezone', operation: 'adjust', direction: 'wider' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        // Should add adjacent zones
        expect(result.modifiedSearchFilterRequest.requiredTimezone).toEqual(['Eastern', 'Central', 'Mountain']);
      });

      it('should fail when narrowing non-existent timezone', () => {
        const baseCriteria: SearchFilterRequest = {};
        const adjustments: CritiqueAdjustment[] = [
          { property: 'timezone', operation: 'adjust', direction: 'narrower' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.failedCritiqueAdjustments).toHaveLength(1);
        expect(result.failedCritiqueAdjustments[0].reason).toContain('No timezone constraint set');
      });

      it('should set specific timezone', () => {
        const baseCriteria: SearchFilterRequest = {};
        const adjustments: CritiqueAdjustment[] = [
          { property: 'timezone', operation: 'set', value: ['Pacific'] },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredTimezone).toEqual(['Pacific']);
      });

      it('should handle single timezone value (convenience)', () => {
        const baseCriteria: SearchFilterRequest = {};
        const adjustments: CritiqueAdjustment[] = [
          { property: 'timezone', operation: 'set', value: 'Eastern' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredTimezone).toEqual(['Eastern']);
      });
    });

    // ============================================
    // SKILL ADJUSTMENTS
    // ============================================

    describe('skill adjustments', () => {
      it('should add a skill requirement', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSkills: [{ skill: 'Python' }],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'skills', operation: 'add', value: { skill: 'React', proficiency: 'proficient' } },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSkills).toHaveLength(2);
        expect(result.modifiedSearchFilterRequest.requiredSkills?.[1]).toEqual({
          skill: 'React',
          minProficiency: 'proficient',
        });
      });

      it('should remove a skill requirement', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSkills: [{ skill: 'Python' }, { skill: 'React' }],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'skills', operation: 'remove', item: 'Python' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSkills).toHaveLength(1);
        expect(result.modifiedSearchFilterRequest.requiredSkills?.[0].skill).toBe('React');
      });

      it('should fail when removing non-existent skill', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSkills: [{ skill: 'Python' }],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'skills', operation: 'remove', item: 'React' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.failedCritiqueAdjustments).toHaveLength(1);
        expect(result.failedCritiqueAdjustments[0].reason).toContain('not in requirements');
      });

      it('should strengthen skill proficiency', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSkills: [{ skill: 'Python', minProficiency: 'proficient' }],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'skills', operation: 'adjust', direction: 'more', item: 'Python' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSkills?.[0].minProficiency).toBe('expert');
      });

      it('should weaken skill proficiency', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSkills: [{ skill: 'Python', minProficiency: 'proficient' }],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'skills', operation: 'adjust', direction: 'less', item: 'Python' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSkills?.[0].minProficiency).toBe('learning');
      });

      it('should add skill with warning when adjusting non-existent skill', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSkills: [{ skill: 'Python' }],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'skills', operation: 'adjust', direction: 'more', item: 'React' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSkills).toHaveLength(2);
        expect(result.appliedCritiqueAdjustments[0].warning).toContain('not in requirements - adding it');
      });
    });

    // ============================================
    // DOMAIN ADJUSTMENTS
    // ============================================

    describe('domain adjustments', () => {
      it('should add business domain requirement', () => {
        const baseCriteria: SearchFilterRequest = {};
        const adjustments: CritiqueAdjustment[] = [
          { property: 'businessDomains', operation: 'add', value: { domain: 'FinTech', minYears: 2 } },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredBusinessDomains).toHaveLength(1);
        expect(result.modifiedSearchFilterRequest.requiredBusinessDomains?.[0]).toEqual({
          domain: 'FinTech',
          minYears: 2,
        });
      });

      it('should remove technical domain requirement', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredTechnicalDomains: [{ domain: 'Backend' }, { domain: 'Frontend' }],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'technicalDomains', operation: 'remove', item: 'Backend' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredTechnicalDomains).toHaveLength(1);
        expect(result.modifiedSearchFilterRequest.requiredTechnicalDomains?.[0].domain).toBe('Frontend');
      });

      it('should fail when removing non-existent domain', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredBusinessDomains: [{ domain: 'FinTech' }],
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'businessDomains', operation: 'remove', item: 'Healthcare' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.failedCritiqueAdjustments).toHaveLength(1);
        expect(result.failedCritiqueAdjustments[0].reason).toContain('not in requirements');
      });
    });

    // ============================================
    // COMPOUND ADJUSTMENTS
    // ============================================

    describe('compound adjustments', () => {
      it('should apply multiple adjustments', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSeniorityLevel: 'mid',
          maxBudget: 100000,
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'seniority', operation: 'adjust', direction: 'more' },
          { property: 'budget', operation: 'adjust', direction: 'more' },
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.modifiedSearchFilterRequest.requiredSeniorityLevel).toBe('senior');
        expect(result.modifiedSearchFilterRequest.maxBudget).toBe(120000);
        expect(result.appliedCritiqueAdjustments).toHaveLength(2);
      });

      it('should handle mixed success and failure', () => {
        const baseCriteria: SearchFilterRequest = {
          requiredSeniorityLevel: 'mid',
          // No budget set
        };
        const adjustments: CritiqueAdjustment[] = [
          { property: 'seniority', operation: 'adjust', direction: 'more' },
          { property: 'budget', operation: 'adjust', direction: 'more' }, // Should fail
        ];

        const result = applyAdjustmentsToSearchCriteria(baseCriteria, adjustments);

        expect(result.appliedCritiqueAdjustments).toHaveLength(1);
        expect(result.failedCritiqueAdjustments).toHaveLength(1);
        expect(result.modifiedSearchFilterRequest.requiredSeniorityLevel).toBe('senior');
      });
    });
  });
});
