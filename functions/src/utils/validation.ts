import { HttpsError } from "firebase-functions/v2/https";

/**
 * Input validation utilities for Cloud Functions
 * Provides type-safe validation with descriptive error messages
 */

/**
 * Validates and sanitizes string input
 * @param value Input value
 * @param fieldName Field name for error messages
 * @param options Validation options
 * @returns Sanitized string
 * @throws HttpsError if validation fails
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    trim?: boolean;
  } = {}
): string {
  const { required = true, minLength, maxLength, pattern, trim = true } = options;

  if (value === null || value === undefined) {
    if (required) {
      throw new HttpsError("invalid-argument", `${fieldName} is required.`);
    }
    return "";
  }

  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a string.`
    );
  }

  const sanitized = trim ? value.trim() : value;

  if (required && sanitized.length === 0) {
    throw new HttpsError("invalid-argument", `${fieldName} cannot be empty.`);
  }

  if (minLength !== undefined && sanitized.length < minLength) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be at least ${minLength} characters.`
    );
  }

  if (maxLength !== undefined && sanitized.length > maxLength) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be at most ${maxLength} characters.`
    );
  }

  if (pattern !== undefined && !pattern.test(sanitized)) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} format is invalid.`
    );
  }

  return sanitized;
}

/**
 * Validates numeric input
 * @param value Input value
 * @param fieldName Field name for error messages
 * @param options Validation options
 * @returns Validated number
 * @throws HttpsError if validation fails
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): number {
  const { required = true, min, max, integer = false } = options;

  if (value === null || value === undefined) {
    if (required) {
      throw new HttpsError("invalid-argument", `${fieldName} is required.`);
    }
    return 0;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a valid number.`
    );
  }

  if (integer && !Number.isInteger(value)) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be an integer.`
    );
  }

  if (min !== undefined && value < min) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be at least ${min}.`
    );
  }

  if (max !== undefined && value > max) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be at most ${max}.`
    );
  }

  return value;
}

/**
 * Validates boolean input
 * @param value Input value
 * @param fieldName Field name for error messages
 * @param required Whether the field is required
 * @returns Validated boolean
 * @throws HttpsError if validation fails
 */
export function validateBoolean(
  value: unknown,
  fieldName: string,
  required: boolean = true
): boolean {
  if (value === null || value === undefined) {
    if (required) {
      throw new HttpsError("invalid-argument", `${fieldName} is required.`);
    }
    return false;
  }

  if (typeof value !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a boolean.`
    );
  }

  return value;
}

/**
 * Validates enum value
 * @param value Input value
 * @param fieldName Field name for error messages
 * @param allowedValues Array of allowed values
 * @returns Validated value
 * @throws HttpsError if validation fails
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[]
): T {
  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a string.`
    );
  }

  if (!allowedValues.includes(value as T)) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be one of: ${allowedValues.join(", ")}.`
    );
  }

  return value as T;
}

/**
 * Validates team ID format
 * Team IDs should be alphanumeric with optional hyphens/underscores
 */
export function validateTeamId(value: unknown, fieldName: string): string {
  return validateString(value, fieldName, {
    required: true,
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_-]+$/,
  });
}

/**
 * Validates UID format
 * Firebase UIDs are alphanumeric strings
 */
export function validateUid(value: unknown, fieldName: string): string {
  return validateString(value, fieldName, {
    required: true,
    minLength: 10,
    maxLength: 128,
    pattern: /^[a-zA-Z0-9]+$/,
  });
}
