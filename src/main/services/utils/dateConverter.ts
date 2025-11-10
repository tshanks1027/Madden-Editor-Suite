/**
 * Birthday Date Converter
 *
 * Converts between encoded birthday format (YYYYMMDD integer) used in Madden files
 * and user-friendly display formats for the UI.
 */

export class DateConverter {
  /**
   * Convert encoded birthday to display format
   * @param encoded - YYYYMMDD as integer (e.g., 19980315 = March 15, 1998)
   * @returns Date string "MM/DD/YYYY" or null if invalid
   */
  static encodedToDisplay(encoded: number): string | null {
    if (!encoded || encoded < 19000101 || encoded > 20991231) {
      return null;
    }

    const year = Math.floor(encoded / 10000);
    const month = Math.floor((encoded % 10000) / 100);
    const day = encoded % 100;

    // Validate month and day ranges
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
  }

  /**
   * Convert display format to encoded birthday
   * @param display - Date string "MM/DD/YYYY"
   * @returns Encoded YYYYMMDD integer
   */
  static displayToEncoded(display: string): number {
    const parts = display.split('/');
    if (parts.length !== 3) {
      throw new Error(`Invalid date format: ${display}. Expected MM/DD/YYYY`);
    }

    const [month, day, year] = parts.map(Number);

    if (isNaN(month) || isNaN(day) || isNaN(year)) {
      throw new Error(`Invalid date values: ${display}`);
    }

    if (month < 1 || month > 12) {
      throw new Error(`Invalid month: ${month}. Must be 1-12`);
    }

    if (day < 1 || day > 31) {
      throw new Error(`Invalid day: ${day}. Must be 1-31`);
    }

    if (year < 1900 || year > 2099) {
      throw new Error(`Invalid year: ${year}. Must be 1900-2099`);
    }

    return (year * 10000) + (month * 100) + day;
  }

  /**
   * Calculate age from birthday
   * @param encoded - YYYYMMDD as integer
   * @param asOfYear - Year to calculate age as of (default: current year)
   * @returns Age in years
   */
  static calculateAge(encoded: number, asOfYear?: number): number {
    if (!encoded || encoded < 19000101) {
      return 0;
    }

    const birthYear = Math.floor(encoded / 10000);
    const currentYear = asOfYear || new Date().getFullYear();

    return currentYear - birthYear;
  }

  /**
   * Generate random birthday for a given age range
   * @param minAge - Minimum age
   * @param maxAge - Maximum age
   * @param asOfYear - Year to calculate age as of (default: current year)
   * @returns Encoded YYYYMMDD integer
   */
  static generateRandomBirthday(minAge: number, maxAge: number, asOfYear?: number): number {
    const currentYear = asOfYear || new Date().getFullYear();
    const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
    const birthYear = currentYear - age;

    // Random month and day (use day 1-28 to avoid invalid dates)
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;

    return (birthYear * 10000) + (month * 100) + day;
  }

  /**
   * Convert JavaScript Date object to encoded format
   * @param date - JavaScript Date object
   * @returns Encoded YYYYMMDD integer
   */
  static dateToEncoded(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() is 0-indexed
    const day = date.getDate();

    return (year * 10000) + (month * 100) + day;
  }

  /**
   * Convert encoded format to JavaScript Date object
   * @param encoded - YYYYMMDD as integer
   * @returns JavaScript Date object or null if invalid
   */
  static encodedToDate(encoded: number): Date | null {
    if (!encoded || encoded < 19000101 || encoded > 20991231) {
      return null;
    }

    const year = Math.floor(encoded / 10000);
    const month = Math.floor((encoded % 10000) / 100) - 1; // Date months are 0-indexed
    const day = encoded % 100;

    try {
      return new Date(year, month, day);
    } catch (error) {
      return null;
    }
  }
}
