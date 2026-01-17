/**
 * Timezone Similarity Scoring
 *
 * Position-based: closer timezones = higher similarity.
 * Uses the ordered usTimezoneZones array from config.
 */

import type { TimezoneSimilarityResult } from '../types.js';
import { usTimezoneZones } from '../../../config/knowledge-base/compatibility-constraints.config.js';

export function calculateTimezoneSimilarity(
  targetTimezone: string,
  candidateTimezone: string
): TimezoneSimilarityResult {
  const zones = usTimezoneZones; // ['Eastern', 'Central', 'Mountain', 'Pacific']
  const targetIdx = zones.indexOf(targetTimezone as typeof zones[number]);
  const candidateIdx = zones.indexOf(candidateTimezone as typeof zones[number]);

  if (targetIdx === -1 || candidateIdx === -1) {
    return { score: 0 };
  }

  const maxDist = zones.length - 1; // 3 (Eastern to Pacific)
  const distance = Math.abs(targetIdx - candidateIdx);

  return { score: 1 - (distance / maxDist) };
}
