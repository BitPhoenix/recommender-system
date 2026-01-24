/**
 * Core Enum Types
 *
 * Re-exports types inferred from Zod schemas for convenience.
 */

import { z } from "zod";
import {
  SeniorityLevelSchema,
  StartTimelineSchema,
  ProficiencyLevelSchema,
  TeamFocusSchema,
  USTimezoneZoneSchema,
} from "../schemas/enums.schema.js";

// Re-export schemas for use in validation
export {
  SeniorityLevelSchema,
  StartTimelineSchema,
  ProficiencyLevelSchema,
  TeamFocusSchema,
  USTimezoneZoneSchema,
  SENIORITY_LEVEL_ORDER,
  START_TIMELINE_ORDER,
  PROFICIENCY_LEVEL_ORDER,
  TEAM_FOCUS_VALUES,
  US_TIMEZONE_ZONE_ORDER,
} from "../schemas/enums.schema.js";

// Inferred types
export type SeniorityLevel = z.infer<typeof SeniorityLevelSchema>;
export type StartTimeline = z.infer<typeof StartTimelineSchema>;
export type ProficiencyLevel = z.infer<typeof ProficiencyLevelSchema>;
export type TeamFocus = z.infer<typeof TeamFocusSchema>;
export type USTimezoneZone = z.infer<typeof USTimezoneZoneSchema>;
