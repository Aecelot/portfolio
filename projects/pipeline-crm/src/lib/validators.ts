/**
 * Form validation utilities
 * Adapted from crm_custom/src/misc/isLinkedInUrl.ts
 */

const LINKEDIN_URL_REGEX = /^http(?:s)?:\/\/(?:www\.)?linkedin\.com\//;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+/;
const PHONE_REGEX = /^[\d\s\-+()]+$/;

/**
 * Validates that a URL is from linkedin.com
 * @returns undefined if valid, error message if invalid
 */
export const validateLinkedInUrl = (url: string): string | undefined => {
  if (!url) return undefined; // Empty is OK (not required)

  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.href.match(LINKEDIN_URL_REGEX)) {
      return 'URL must be from linkedin.com';
    }
  } catch {
    return 'Must be a valid URL';
  }

  return undefined;
};

/**
 * Validates email format
 * @returns undefined if valid, error message if invalid
 */
export const validateEmail = (email: string): string | undefined => {
  if (!email) return undefined; // Empty is OK (not required)

  if (!EMAIL_REGEX.test(email)) {
    return 'Must be a valid email address';
  }

  return undefined;
};

/**
 * Validates URL format
 * @returns undefined if valid, error message if invalid
 */
export const validateUrl = (url: string): string | undefined => {
  if (!url) return undefined; // Empty is OK (not required)

  try {
    new URL(url);
    if (!URL_REGEX.test(url)) {
      return 'URL must start with http:// or https://';
    }
  } catch {
    return 'Must be a valid URL';
  }

  return undefined;
};

/**
 * Validates phone number format (basic)
 * @returns undefined if valid, error message if invalid
 */
export const validatePhone = (phone: string): string | undefined => {
  if (!phone) return undefined; // Empty is OK (not required)

  if (!PHONE_REGEX.test(phone)) {
    return 'Must be a valid phone number';
  }

  return undefined;
};

/**
 * Validates required field
 * @returns undefined if valid, error message if invalid
 */
export const validateRequired = (value: string, fieldName: string = 'This field'): string | undefined => {
  if (!value || !value.trim()) {
    return `${fieldName} is required`;
  }

  return undefined;
};

/**
 * Validates minimum length
 * @returns undefined if valid, error message if invalid
 */
export const validateMinLength = (value: string, minLength: number, fieldName: string = 'This field'): string | undefined => {
  if (!value) return undefined;

  if (value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }

  return undefined;
};

/**
 * Validates maximum length
 * @returns undefined if valid, error message if invalid
 */
export const validateMaxLength = (value: string, maxLength: number, fieldName: string = 'This field'): string | undefined => {
  if (!value) return undefined;

  if (value.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`;
  }

  return undefined;
};

/**
 * Combines multiple validators
 * @returns undefined if all valid, first error message if any invalid
 */
export const composeValidators = (...validators: Array<(value: string) => string | undefined>) => {
  return (value: string): string | undefined => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return undefined;
  };
};
