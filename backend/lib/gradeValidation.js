// V-Scale grades: V0, V1, V2, ..., V17
const V_SCALE_PATTERN = /^V([0-9]|1[0-7])$/;

// V-Scale Range: V0-V2, V4-6, V8-10, etc. (must be a range)
const V_SCALE_RANGE_PATTERN = /^V([0-9]|1[0-7])-V([0-9]|1[0-7])$/;

// French grades: 1a, 1a+, 1b, 1b+, 1c, 1c+, 2a, 2a+, ..., 9c+
// Format: [1-9][a-c]?
const FRENCH_GRADE_PATTERN = /^([1-9][a-c]\+?)$/;

export function validateGrade(grade, gradeSystem, allowRanges = true) {
  if (!grade || typeof grade !== 'string') {
    return { valid: false, error: 'Grade must be a non-empty string' };
  }

  const trimmedGrade = grade.trim();

  switch (gradeSystem) {
    case 'V-Scale':
      if (V_SCALE_PATTERN.test(trimmedGrade)) {
        return { valid: true };
      }
      return {
        valid: false,
        error: 'V-Scale grade must be in format V0-V17 (e.g., "V4", "V8"). Ranges are not allowed for V-Scale.',
      };

    case 'V-Scale Range':
      // If ranges are not allowed (e.g., for votes), treat as V-Scale (specific grades only)
      if (!allowRanges) {
        if (V_SCALE_PATTERN.test(trimmedGrade)) {
          return { valid: true };
        }
        return {
          valid: false,
          error: 'Vote grade must be a specific V-Scale grade (V0-V17, e.g., "V4", "V8"). Ranges are not allowed.',
        };
      }
      
      // Ranges allowed (for climbs): must be a range and span at most 3 grades (e.g. V3-V6 is OK, V1-V8 is not)
      if (V_SCALE_RANGE_PATTERN.test(trimmedGrade)) {
        const match = trimmedGrade.match(/^V(\d+)-V(\d+)$/);
        if (match) {
          const first = parseInt(match[1], 10);
          const second = parseInt(match[2], 10);
          const span = second - first;

          // Must be an actual range (second > first) and span at most 3 grades
          if (first >= 0 && second <= 17 && span >= 1 && span <= 3) {
            return { valid: true };
          }
        }
        return {
          valid: false,
          error: 'Invalid V-Scale range. The second grade must be >= the first, both in V0-V17, and the range may span at most 3 grades (e.g. "V3-V6" is OK, "V1-V8" is not).',
        };
      }
      return {
        valid: false,
        error: 'V-Scale Range grade must be in format VX-VY (e.g., "V4-6", "V0-V2"). Single grades are not allowed for V-Scale Range.',
      };

    case 'French':
      if (FRENCH_GRADE_PATTERN.test(trimmedGrade)) {
        return { valid: true };
      }
      return {
        valid: false,
        error: 'French grade must be in format [1-9][a-c]? (e.g., "6a", "6a+", "7b"). Ranges are not allowed for French.',
      };

    default:
      return {
        valid: false,
        error: `Unknown grade system: ${gradeSystem}`,
      };
  }
}
