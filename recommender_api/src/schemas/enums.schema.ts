/**
 * Core Enum Schemas
 *
 * Shared enum types used across the application.
 * These are the single source of truth for constrained value types.
 */

import { z } from "zod";

// ============================================
// SENIORITY LEVELS
// ============================================

export const SENIORITY_LEVEL_ORDER = [
  "junior", "mid", "senior", "staff", "principal"
] as const;

export const SeniorityLevelSchema = z.enum(SENIORITY_LEVEL_ORDER);

// ============================================
// START TIMELINE
// ============================================

export const START_TIMELINE_ORDER = [
  "immediate", "two_weeks", "one_month", "three_months", "six_months", "one_year"
] as const;

export const StartTimelineSchema = z.enum(START_TIMELINE_ORDER);

// ============================================
// PROFICIENCY LEVELS
// ============================================

export const PROFICIENCY_LEVEL_ORDER = ["learning", "proficient", "expert"] as const;

export const ProficiencyLevelSchema = z.enum(PROFICIENCY_LEVEL_ORDER);

// ============================================
// TEAM FOCUS
// ============================================

export const TEAM_FOCUS_VALUES = [
  "greenfield", "migration", "maintenance", "scaling"
] as const;

export const TeamFocusSchema = z.enum(TEAM_FOCUS_VALUES);

// ============================================
// US TIMEZONE ZONES
// ============================================

export const US_TIMEZONE_ZONE_ORDER = [
  "Eastern", "Central", "Mountain", "Pacific"
] as const;

export const USTimezoneZoneSchema = z.enum(US_TIMEZONE_ZONE_ORDER);
