import type { Lead } from '@/types/lead';

export interface DuplicateMatch {
  lead: Lead;
  matchType: 'email' | 'name' | 'website';
  matchScore: number; // 0-1, higher = more likely duplicate
}

/**
 * Normalize a string for comparison (lowercase, trim, remove extra spaces)
 */
const normalizeString = (str: string): string => {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
};

/**
 * Extract domain from URL or email
 */
const extractDomain = (input: string): string | null => {
  if (!input) return null;

  // If it's an email, extract domain
  if (input.includes('@')) {
    const parts = input.split('@');
    return parts[1]?.toLowerCase() || null;
  }

  // If it's a URL, extract hostname
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a score between 0 (no match) and 1 (exact match)
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
};

/**
 * Find potential duplicate leads based on various criteria
 */
export const findDuplicates = (
  newLead: Partial<Lead>,
  existingLeads: Lead[],
  options: {
    nameThreshold?: number;
  } = {}
): DuplicateMatch[] => {
  const {
    nameThreshold = 0.7, // Allow some variation in names
  } = options;

  const duplicates: DuplicateMatch[] = [];
  const newEmail = newLead.contact?.email?.toLowerCase().trim();
  const newName = newLead.name;
  const newWebsiteDomain = extractDomain(newLead.website || '');

  for (const lead of existingLeads) {
    // Check email match
    if (newEmail && lead.contact?.email) {
      const existingEmail = lead.contact.email.toLowerCase().trim();
      if (newEmail === existingEmail) {
        duplicates.push({
          lead,
          matchType: 'email',
          matchScore: 1,
        });
        continue; // Don't double-count
      }
    }

    // Check website domain match
    if (newWebsiteDomain && lead.website) {
      const existingDomain = extractDomain(lead.website);
      if (existingDomain && newWebsiteDomain === existingDomain) {
        duplicates.push({
          lead,
          matchType: 'website',
          matchScore: 1,
        });
        continue;
      }
    }

    // Check name similarity
    if (newName && lead.name) {
      const similarity = calculateSimilarity(newName, lead.name);
      if (similarity >= nameThreshold) {
        duplicates.push({
          lead,
          matchType: 'name',
          matchScore: similarity,
        });
      }
    }
  }

  // Sort by match score (highest first)
  return duplicates.sort((a, b) => b.matchScore - a.matchScore);
};

/**
 * Format a duplicate match for display
 */
export const formatDuplicateMatch = (match: DuplicateMatch): string => {
  switch (match.matchType) {
    case 'email':
      return `Same email address (${match.lead.contact?.email})`;
    case 'website':
      return `Same website domain`;
    case 'name':
      return `Similar name (${Math.round(match.matchScore * 100)}% match)`;
    default:
      return 'Potential duplicate';
  }
};
