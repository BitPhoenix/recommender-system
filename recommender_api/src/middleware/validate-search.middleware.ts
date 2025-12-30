/**
 * Search Request Validation Middleware
 * Validates incoming search requests against the API contract.
 */

import type { Request, Response, NextFunction } from 'express';
import type {
  SearchFilterRequest,
  SearchErrorResponse,
  ValidationErrorDetail,
  SeniorityLevel,
  RiskTolerance,
  TeamFocus,
  ProficiencyLevel,
  AvailabilityOption,
} from '../types/search.types.js';

const VALID_SENIORITY_LEVELS: SeniorityLevel[] = ['junior', 'mid', 'senior', 'staff', 'principal'];
const VALID_RISK_TOLERANCES: RiskTolerance[] = ['low', 'medium', 'high'];
const VALID_TEAM_FOCUSES: TeamFocus[] = ['greenfield', 'migration', 'maintenance', 'scaling'];
const VALID_PROFICIENCY_LEVELS: ProficiencyLevel[] = ['learning', 'proficient', 'expert'];
const VALID_AVAILABILITY_OPTIONS: AvailabilityOption[] = ['immediate', 'two_weeks', 'one_month', 'not_available'];

/**
 * Validates the search filter request body.
 */
export function validateSearchRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as SearchFilterRequest;
  const errors: ValidationErrorDetail[] = [];

  // Allow empty requests (browse mode)
  if (!body || Object.keys(body).length === 0) {
    req.body = {};
    next();
    return;
  }

  // Validate requiredSeniorityLevel (was: seniorityLevel)
  if (body.requiredSeniorityLevel !== undefined) {
    if (!VALID_SENIORITY_LEVELS.includes(body.requiredSeniorityLevel)) {
      errors.push({
        field: 'requiredSeniorityLevel',
        message: `Must be one of: ${VALID_SENIORITY_LEVELS.join(', ')}`,
      });
    }
  }

  // Validate preferredSeniorityLevel (NEW)
  if (body.preferredSeniorityLevel !== undefined) {
    if (!VALID_SENIORITY_LEVELS.includes(body.preferredSeniorityLevel)) {
      errors.push({
        field: 'preferredSeniorityLevel',
        message: `Must be one of: ${VALID_SENIORITY_LEVELS.join(', ')}`,
      });
    }
  }

  // Validate requiredRiskTolerance (was: riskTolerance)
  if (body.requiredRiskTolerance !== undefined) {
    if (!VALID_RISK_TOLERANCES.includes(body.requiredRiskTolerance)) {
      errors.push({
        field: 'requiredRiskTolerance',
        message: `Must be one of: ${VALID_RISK_TOLERANCES.join(', ')}`,
      });
    }
  }

  // Validate teamFocus
  if (body.teamFocus !== undefined) {
    if (!VALID_TEAM_FOCUSES.includes(body.teamFocus)) {
      errors.push({
        field: 'teamFocus',
        message: `Must be one of: ${VALID_TEAM_FOCUSES.join(', ')}`,
      });
    }
  }

  // Validate requiredMinProficiency (was: minProficiency)
  if (body.requiredMinProficiency !== undefined) {
    if (!VALID_PROFICIENCY_LEVELS.includes(body.requiredMinProficiency)) {
      errors.push({
        field: 'requiredMinProficiency',
        message: `Must be one of: ${VALID_PROFICIENCY_LEVELS.join(', ')}`,
      });
    }
  }

  // Validate preferredProficiency (NEW)
  if (body.preferredProficiency !== undefined) {
    if (!VALID_PROFICIENCY_LEVELS.includes(body.preferredProficiency)) {
      errors.push({
        field: 'preferredProficiency',
        message: `Must be one of: ${VALID_PROFICIENCY_LEVELS.join(', ')}`,
      });
    }
  }

  // Validate requiredAvailability (was: availability)
  if (body.requiredAvailability !== undefined) {
    if (!Array.isArray(body.requiredAvailability)) {
      errors.push({
        field: 'requiredAvailability',
        message: 'Must be an array',
      });
    } else {
      const invalidOptions = body.requiredAvailability.filter(
        (opt) => !VALID_AVAILABILITY_OPTIONS.includes(opt)
      );
      if (invalidOptions.length > 0) {
        errors.push({
          field: 'requiredAvailability',
          message: `Invalid options: ${invalidOptions.join(', ')}. Must be one of: ${VALID_AVAILABILITY_OPTIONS.join(', ')}`,
        });
      }
    }
  }

  // Validate preferredAvailability (NEW)
  if (body.preferredAvailability !== undefined) {
    if (!Array.isArray(body.preferredAvailability)) {
      errors.push({
        field: 'preferredAvailability',
        message: 'Must be an array (ordered preference list)',
      });
    } else {
      const invalidOptions = body.preferredAvailability.filter(
        (opt) => !VALID_AVAILABILITY_OPTIONS.includes(opt)
      );
      if (invalidOptions.length > 0) {
        errors.push({
          field: 'preferredAvailability',
          message: `Invalid options: ${invalidOptions.join(', ')}. Must be one of: ${VALID_AVAILABILITY_OPTIONS.join(', ')}`,
        });
      }
    }
  }

  // Validate requiredSkills
  if (body.requiredSkills !== undefined) {
    if (!Array.isArray(body.requiredSkills)) {
      errors.push({
        field: 'requiredSkills',
        message: 'Must be an array of strings',
      });
    } else if (!body.requiredSkills.every((s) => typeof s === 'string')) {
      errors.push({
        field: 'requiredSkills',
        message: 'All items must be strings',
      });
    }
  }

  // Validate preferredSkills
  if (body.preferredSkills !== undefined) {
    if (!Array.isArray(body.preferredSkills)) {
      errors.push({
        field: 'preferredSkills',
        message: 'Must be an array of strings',
      });
    } else if (!body.preferredSkills.every((s) => typeof s === 'string')) {
      errors.push({
        field: 'preferredSkills',
        message: 'All items must be strings',
      });
    }
  }

  // Validate requiredDomains
  if (body.requiredDomains !== undefined) {
    if (!Array.isArray(body.requiredDomains)) {
      errors.push({
        field: 'requiredDomains',
        message: 'Must be an array of strings',
      });
    } else if (!body.requiredDomains.every((s) => typeof s === 'string')) {
      errors.push({
        field: 'requiredDomains',
        message: 'All items must be strings',
      });
    }
  }

  // Validate preferredDomains
  if (body.preferredDomains !== undefined) {
    if (!Array.isArray(body.preferredDomains)) {
      errors.push({
        field: 'preferredDomains',
        message: 'Must be an array of strings',
      });
    } else if (!body.preferredDomains.every((s) => typeof s === 'string')) {
      errors.push({
        field: 'preferredDomains',
        message: 'All items must be strings',
      });
    }
  }

  // Validate requiredTimezone (was: timezone)
  if (body.requiredTimezone !== undefined) {
    if (typeof body.requiredTimezone !== 'string') {
      errors.push({
        field: 'requiredTimezone',
        message: 'Must be a string',
      });
    }
  }

  // Validate preferredTimezone (NEW)
  if (body.preferredTimezone !== undefined) {
    if (!Array.isArray(body.preferredTimezone)) {
      errors.push({
        field: 'preferredTimezone',
        message: 'Must be an array of strings (ordered preference list)',
      });
    } else if (!body.preferredTimezone.every((tz) => typeof tz === 'string')) {
      errors.push({
        field: 'preferredTimezone',
        message: 'All items must be strings',
      });
    }
  }

  // Validate requiredMaxSalary (was: maxSalary)
  if (body.requiredMaxSalary !== undefined) {
    if (typeof body.requiredMaxSalary !== 'number' || body.requiredMaxSalary <= 0) {
      errors.push({
        field: 'requiredMaxSalary',
        message: 'Must be a positive number',
      });
    }
  }

  // Validate requiredMinSalary (was: minSalary)
  if (body.requiredMinSalary !== undefined) {
    if (typeof body.requiredMinSalary !== 'number' || body.requiredMinSalary <= 0) {
      errors.push({
        field: 'requiredMinSalary',
        message: 'Must be a positive number',
      });
    }
  }

  // Validate requiredMinSalary <= requiredMaxSalary
  if (body.requiredMinSalary !== undefined && body.requiredMaxSalary !== undefined) {
    if (body.requiredMinSalary > body.requiredMaxSalary) {
      errors.push({
        field: 'requiredMinSalary',
        message: 'Must be less than or equal to requiredMaxSalary',
      });
    }
  }

  // Validate preferredSalaryRange (NEW)
  if (body.preferredSalaryRange !== undefined) {
    if (typeof body.preferredSalaryRange !== 'object' || body.preferredSalaryRange === null) {
      errors.push({
        field: 'preferredSalaryRange',
        message: 'Must be an object with min and max properties',
      });
    } else {
      const { min, max } = body.preferredSalaryRange;
      if (typeof min !== 'number' || min <= 0) {
        errors.push({
          field: 'preferredSalaryRange.min',
          message: 'Must be a positive number',
        });
      }
      if (typeof max !== 'number' || max <= 0) {
        errors.push({
          field: 'preferredSalaryRange.max',
          message: 'Must be a positive number',
        });
      }
      if (typeof min === 'number' && typeof max === 'number' && min > max) {
        errors.push({
          field: 'preferredSalaryRange',
          message: 'min must be less than or equal to max',
        });
      }
    }
  }

  // Validate preferredConfidenceScore (NEW)
  if (body.preferredConfidenceScore !== undefined) {
    if (typeof body.preferredConfidenceScore !== 'number' ||
        body.preferredConfidenceScore < 0 ||
        body.preferredConfidenceScore > 1) {
      errors.push({
        field: 'preferredConfidenceScore',
        message: 'Must be a number between 0 and 1',
      });
    }
  }

  // Validate limit
  if (body.limit !== undefined) {
    if (typeof body.limit !== 'number' || body.limit < 1 || body.limit > 100) {
      errors.push({
        field: 'limit',
        message: 'Must be a number between 1 and 100',
      });
    }
  }

  // Validate offset
  if (body.offset !== undefined) {
    if (typeof body.offset !== 'number' || body.offset < 0) {
      errors.push({
        field: 'offset',
        message: 'Must be a non-negative number',
      });
    }
  }

  // Return errors if any
  if (errors.length > 0) {
    const errorResponse: SearchErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors,
      },
    };
    res.status(400).json(errorResponse);
    return;
  }

  next();
}
