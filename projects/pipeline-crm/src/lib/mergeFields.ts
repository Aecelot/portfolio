import type { MergeFields } from '@/types/sequence';
import type { Lead } from '@/types/lead';

/**
 * Replace {{placeholder}} tokens in text with actual values from mergeFields
 */
export function applyMergeFields(template: string, fields: MergeFields): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
    // Convert camelCase to various formats: FirstName, firstName, FIRSTNAME
    const value = fields[fieldName] ?? fields[fieldName.toLowerCase()] ?? fields[toCamelCase(fieldName)];
    return value ?? match; // Keep original if no value found
  });
}

/**
 * Convert PascalCase or snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toLowerCase());
}

/**
 * Extract merge field placeholders from a template
 */
export function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

/**
 * Extract placeholders from all emails in a sequence
 */
export function extractSequencePlaceholders(emails: { subject: string; body: string }[]): string[] {
  const allText = emails.map(e => `${e.subject} ${e.body}`).join(' ');
  return extractPlaceholders(allText);
}

/**
 * Build initial merge fields from a Lead object
 */
export function buildMergeFieldsFromLead(lead: Lead): Partial<MergeFields> {
  const fields: Partial<MergeFields> = {};

  // Contact info
  if (lead.contact?.name) {
    const nameParts = lead.contact.name.split(' ');
    fields.firstName = nameParts[0];
    if (nameParts.length > 1) {
      fields.lastName = nameParts.slice(1).join(' ');
    }
  }

  // Studio/company name
  fields.studioName = lead.name;

  // Game info (if studio type)
  if (lead.studio?.games && lead.studio.games.length > 0) {
    fields.gameName = lead.studio.games[0];
  }

  // Genre/focus
  if (lead.studio?.focus) {
    fields.genre = lead.studio.focus;
  }

  return fields;
}

/**
 * Validate that all required placeholders have values
 */
export function validateMergeFields(
  template: string,
  fields: MergeFields
): { valid: boolean; missing: string[] } {
  const placeholders = extractPlaceholders(template);
  const missing = placeholders.filter(p => {
    const value = fields[p] ?? fields[p.toLowerCase()] ?? fields[toCamelCase(p)];
    return !value || value.trim() === '';
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Preview an email with merge fields applied
 */
export function previewEmail(
  subject: string,
  body: string,
  fields: MergeFields
): { subject: string; body: string } {
  return {
    subject: applyMergeFields(subject, fields),
    body: applyMergeFields(body, fields),
  };
}
