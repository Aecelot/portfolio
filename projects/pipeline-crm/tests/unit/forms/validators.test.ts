import { describe, it, expect } from 'vitest';
import {
  validateLinkedInUrl,
  validateEmail,
  validateUrl,
  validateRequired,
} from '@/lib/validators';

describe('validators', () => {
  describe('validateRequired', () => {
    it('returns error for empty string', () => {
      expect(validateRequired('', 'Field')).toBe('Field is required');
    });

    it('returns error for whitespace-only string', () => {
      expect(validateRequired('   ', 'Name')).toBe('Name is required');
    });

    it('returns undefined for valid value', () => {
      expect(validateRequired('John Doe', 'Name')).toBeUndefined();
    });
  });

  describe('validateEmail', () => {
    it('returns error for invalid email format', () => {
      expect(validateEmail('invalid')).toBe('Must be a valid email address');
      expect(validateEmail('invalid@')).toBe('Must be a valid email address');
      expect(validateEmail('@example.com')).toBe('Must be a valid email address');
    });

    it('returns undefined for empty value', () => {
      expect(validateEmail('')).toBeUndefined();
    });

    it('returns undefined for valid email', () => {
      expect(validateEmail('test@example.com')).toBeUndefined();
      expect(validateEmail('user.name@domain.co.uk')).toBeUndefined();
      expect(validateEmail('user+tag@example.org')).toBeUndefined();
    });
  });

  describe('validateUrl', () => {
    it('returns error for invalid URL', () => {
      expect(validateUrl('invalid')).toBe('Must be a valid URL');
      expect(validateUrl('not-a-url')).toBe('Must be a valid URL');
    });

    it('returns error for non-http URLs', () => {
      expect(validateUrl('ftp://example.com')).toBe('URL must start with http:// or https://');
    });

    it('returns undefined for empty value', () => {
      expect(validateUrl('')).toBeUndefined();
    });

    it('returns undefined for valid URL', () => {
      expect(validateUrl('https://example.com')).toBeUndefined();
      expect(validateUrl('http://localhost:3000')).toBeUndefined();
      expect(validateUrl('https://sub.domain.com/path?query=1')).toBeUndefined();
    });
  });

  describe('validateLinkedInUrl', () => {
    it('returns error for non-LinkedIn URLs', () => {
      expect(validateLinkedInUrl('https://twitter.com/user')).toBe(
        'URL must be from linkedin.com'
      );
      expect(validateLinkedInUrl('https://google.com')).toBe(
        'URL must be from linkedin.com'
      );
    });

    it('returns error for invalid URLs', () => {
      expect(validateLinkedInUrl('not-a-url')).toBe('Must be a valid URL');
    });

    it('returns undefined for empty value', () => {
      expect(validateLinkedInUrl('')).toBeUndefined();
    });

    it('returns undefined for valid LinkedIn URLs', () => {
      expect(validateLinkedInUrl('https://linkedin.com/in/username')).toBeUndefined();
      expect(validateLinkedInUrl('https://www.linkedin.com/in/john-doe')).toBeUndefined();
      expect(validateLinkedInUrl('https://linkedin.com/company/acme')).toBeUndefined();
    });
  });
});
