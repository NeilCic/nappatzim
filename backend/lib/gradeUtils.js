/**
 * Convert a specific grade to a numeric value for averaging
 * @param {string} grade - The grade (e.g., "V4", "6a+")
 * @param {string} gradeSystem - The grade system ("V-Scale", "V-Scale Range", "French")
 * @returns {number|null} - Numeric value for averaging, or null if invalid
 */
export function gradeToNumber(grade, gradeSystem) {
  if (!grade || typeof grade !== 'string') {
    return null;
  }

  const trimmedGrade = grade.trim();

  switch (gradeSystem) {
    case 'V-Scale': {
      // Exact V-grade only, e.g. "V4"
      const vMatch = trimmedGrade.match(/^V(\d+)$/);
      if (vMatch) {
        return parseInt(vMatch[1], 10);
      }
      return null;
    }

    case 'V-Scale Range': {
      // 1) If it's already a specific V-grade (e.g. votes): treat like V-Scale
      const exactMatch = trimmedGrade.match(/^V(\d+)$/);
      if (exactMatch) {
        return parseInt(exactMatch[1], 10);
      }

      // 2) Range such as "V3-V5" (take the LOWER end so ranges still appear in stats)
      const rangeMatchFull = trimmedGrade.match(/^V(\d+)-V(\d+)$/);
      if (rangeMatchFull) {
        const lower = parseInt(rangeMatchFull[1], 10);
        return lower;
      }

      // 3) Be tolerant of "V3-5" style just in case
      const rangeMatchShort = trimmedGrade.match(/^V(\d+)-(\d+)$/);
      if (rangeMatchShort) {
        const lower = parseInt(rangeMatchShort[1], 10);
        return lower;
      }

      return null;
    }

    case 'French':
      // Convert French grades: 1a, 1a+, 1b, 1b+, 1c, 1c+, 2a, 2a+, ..., 9c+
      // Format: [1-9][a-c]? (optional +)
      const frenchMatch = trimmedGrade.match(/^([1-9])([a-c])(\+?)$/);
      if (frenchMatch) {
        const number = parseInt(frenchMatch[1], 10); // 1-9
        const letter = frenchMatch[2]; // a, b, or c
        const hasPlus = frenchMatch[3] === '+'; // optional +

        // Each number has 6 sub-grades: a, a+, b, b+, c, c+
        // a = 0, a+ = 1, b = 2, b+ = 3, c = 4, c+ = 5
        let letterValue = 0;
        if (letter === 'b') letterValue = 2;
        else if (letter === 'c') letterValue = 4;
        
        if (hasPlus) letterValue += 1;

        // Base value: (number - 1) * 6 (since 1a = 0, 2a = 6, etc.)
        const baseValue = (number - 1) * 6;
        return baseValue + letterValue;
      }
      return null;

    default:
      return null;
  }
}

/**
 * Convert a numeric value back to a grade string
 * @param {number} value - Numeric value
 * @param {string} gradeSystem - The grade system
 * @returns {string|null} - Grade string, or null if invalid
 */
export function numberToGrade(value, gradeSystem) {
  if (value === null || value === undefined || isNaN(value)) {
    return null;
  }

  const roundedValue = Math.round(value);

  switch (gradeSystem) {
    case 'V-Scale':
    case 'V-Scale Range':
      return `V${roundedValue}`;

    case 'French':
      // Convert back: value / 6 gives us the number part
      // value % 6 gives us the letter part
      const number = Math.floor(roundedValue / 6) + 1; // +1 because 1a starts at 0
      const letterValue = roundedValue % 6;
      
      const hasPlus = letterValue % 2 === 1; // Odd values (1, 3, 5) have plus
      const letterIndex = Math.floor(letterValue / 2); // 0=a, 1=b, 2=c
      const letter = ['a', 'b', 'c'][letterIndex];

      return `${number}${letter}${hasPlus ? '+' : ''}`;

    default:
      return null;
  }
}

/**
 * Calculate average grade from an array of grades
 * @param {string[]} grades - Array of grade strings
 * @param {string} gradeSystem - The grade system
 * @returns {string|null} - Average grade, or null if unable to calculate
 */
export function calculateAverageGrade(grades, gradeSystem) {
  if (!grades || grades.length === 0) {
    return null;
  }

  const numericValues = grades
    .map(grade => gradeToNumber(grade, gradeSystem))
    .filter(val => val !== null);

  if (numericValues.length === 0) {
    return null;
  }

  const sum = numericValues.reduce((acc, val) => acc + val, 0);
  const average = sum / numericValues.length;

  return numberToGrade(average, gradeSystem);
}


// todo check if we can improve performance here