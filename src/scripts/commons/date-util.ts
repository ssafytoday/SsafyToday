/**
 * Date utility functions using dayjs
 * Provides universal date parsing and formatting for various date formats
 */
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Extend dayjs with plugins
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Supported date formats for parsing
 * Ordered by specificity (more specific formats first)
 */
const DATE_FORMATS = [
  'YYYY년 MM월 DD일 HH:mm:ss',    // Korean format with zero-padding
  'YYYY년 M월 D일 HH:mm:ss',       // Korean format without zero-padding
  'YYYY년 MM월 DD일 HH:mm',        // Korean format without seconds
  'YYYY년 M월 D일 HH:mm',          // Korean format without seconds (no padding)
  'YYYY-MM-DD HH:mm:ss',           // ISO-like with space separator
  'YYYY-MM-DD HH:mm',              // SWEA format (no seconds)
  'YYYY/MM/DD HH:mm:ss',           // Slash format
  'YYYY/MM/DD HH:mm',              // Slash format without seconds
  'MM/DD/YYYY HH:mm:ss',           // US format
  'DD.MM.YYYY HH:mm:ss',           // European format
];

/**
 * Convert various date string formats to ISO 8601 format
 * Supports Korean, ISO-like, and various international formats
 *
 * @param dateInput - Date string, Date object, or undefined
 * @returns ISO 8601 formatted string (e.g., "2024-01-15T14:30:45.000Z")
 *
 * @example
 * toISOString('2024년 01월 15일 14:30:45') // "2024-01-15T05:30:45.000Z" (UTC)
 * toISOString('2024-01-15 14:30:45')       // "2024-01-15T05:30:45.000Z" (UTC)
 * toISOString(new Date())                   // Current time in ISO format
 * toISOString(undefined)                    // Current time in ISO format
 */
export function toISOString(dateInput: string | Date | undefined): string {
  // Handle undefined/null - return current time
  if (!dateInput) {
    return dayjs().toISOString();
  }

  // Handle Date object
  if (dateInput instanceof Date) {
    return dayjs(dateInput).toISOString();
  }

  // Already ISO 8601 format - return as is
  if (isISOFormat(dateInput)) {
    return dateInput;
  }

  // Try parsing with known formats
  for (const format of DATE_FORMATS) {
    const parsed = dayjs(dateInput, format, true);
    if (parsed.isValid()) {
      return parsed.toISOString();
    }
  }

  // Fallback: try default parsing (handles many formats automatically)
  const parsed = dayjs(dateInput);
  if (parsed.isValid()) {
    return parsed.toISOString();
  }

  // If all parsing fails, return current time
  console.warn(`[date-util] Failed to parse date: "${dateInput}", using current time`);
  return dayjs().toISOString();
}

/**
 * Check if a string is already in ISO 8601 format
 *
 * @param dateString - Date string to check
 * @returns true if already in ISO format
 */
function isISOFormat(dateString: string): boolean {
  // Check for ISO 8601 patterns:
  // - Contains 'T' separator
  // - Ends with 'Z' (UTC) or has timezone offset (+/-HH:MM or +/-HHMM)
  return (
    dateString.includes('T') &&
    (dateString.endsWith('Z') ||
      /[+-]\d{2}:\d{2}$/.test(dateString) ||
      /[+-]\d{4}$/.test(dateString))
  );
}

/**
 * Format date to Korean display string
 * Replacement for the original getDateString() function
 *
 * @param date - Date object (defaults to current time)
 * @returns Korean formatted date string (e.g., "2024년 01월 15일 14:30:45")
 */
export function toKoreanDateString(date: Date = new Date()): string {
  return dayjs(date).format('YYYY년 MM월 DD일 HH:mm:ss');
}

/**
 * Parse a date string in any supported format and return a dayjs object
 *
 * @param dateInput - Date string to parse
 * @returns dayjs object or null if parsing fails
 */
export function parseDate(dateInput: string): dayjs.Dayjs | null {
  // Try ISO format first
  if (isISOFormat(dateInput)) {
    const parsed = dayjs(dateInput);
    return parsed.isValid() ? parsed : null;
  }

  // Try known formats
  for (const format of DATE_FORMATS) {
    const parsed = dayjs(dateInput, format, true);
    if (parsed.isValid()) {
      return parsed;
    }
  }

  // Fallback to default parsing
  const parsed = dayjs(dateInput);
  return parsed.isValid() ? parsed : null;
}

/**
 * Get the current time in ISO 8601 format
 *
 * @returns Current time in ISO format
 */
export function nowISO(): string {
  return dayjs().toISOString();
}
