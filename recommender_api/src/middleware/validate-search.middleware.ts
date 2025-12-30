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

  // Validate seniorityLevel
  if (body.seniorityLevel !== undefined) {
    if (!VALID_SENIORITY_LEVELS.includes(body.seniorityLevel)) {
      errors.push({
        field: 'seniorityLevel',
        message: `Must be one of: ${VALID_SENIORITY_LEVELS.join(', ')}`,
      });
    }
  }

  // Validate riskTolerance
  if (body.riskTolerance !== undefined) {
    if (!VALID_RISK_TOLERANCES.includes(body.riskTolerance)) {
      errors.push({
        field: 'riskTolerance',
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

  // Validate minProficiency
  if (body.minProficiency !== undefined) {
    if (!VALID_PROFICIENCY_LEVELS.includes(body.minProficiency)) {
      errors.push({
        field: 'minProficiency',
        message: `Must be one of: ${VALID_PROFICIENCY_LEVELS.join(', ')}`,
      });
    }
  }

  // Validate availability
  if (body.availability !== undefined) {
    if (!Array.isArray(body.availability)) {
      errors.push({
        field: 'availability',
        message: 'Must be an array',
      });
    } else {
      const invalidOptions = body.availability.filter(
        (opt) => !VALID_AVAILABILITY_OPTIONS.includes(opt)
      );
      if (invalidOptions.length > 0) {
        errors.push({
          field: 'availability',
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

  // Validate timezone
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string') {
      errors.push({
        field: 'timezone',
        message: 'Must be a string',
      });
    }
  }

  // Validate maxSalary
  if (body.maxSalary !== undefined) {
    if (typeof body.maxSalary !== 'number' || body.maxSalary <= 0) {
      errors.push({
        field: 'maxSalary',
        message: 'Must be a positive number',
      });
    }
  }

  // Validate minSalary
  if (body.minSalary !== undefined) {
    if (typeof body.minSalary !== 'number' || body.minSalary <= 0) {
      errors.push({
        field: 'minSalary',
        message: 'Must be a positive number',
      });
    }
  }

  // Validate minSalary <= maxSalary
  if (body.minSalary !== undefined && body.maxSalary !== undefined) {
    if (body.minSalary > body.maxSalary) {
      errors.push({
        field: 'minSalary',
        message: 'Must be less than or equal to maxSalary',
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
