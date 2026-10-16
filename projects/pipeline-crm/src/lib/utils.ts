import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number) {
  if (!date) return '';
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return format(dateObj, 'MMM d, yyyy');
}

export function formatDateTime(date: Date | string | number) {
  if (!date) return '';
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return format(dateObj, 'MMM d, yyyy h:mm a');
}

export function formatRelativeTime(date: Date | string | number) {
  if (!date) return '';
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

export function getInitials(name: string): string {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Basic phone number formatting
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-red-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'low':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}

export function stageColor(color: string): string {
  switch (color) {
    case 'red':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'orange':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'green':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'blue':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'indigo':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'purple':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'cyan':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'gray':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Calculate priority based on fit score (legacy - kept for backwards compatibility)
 * @param fitScore - Score from 0-10
 * @returns Priority level: 'high' | 'medium' | 'low' | 'none'
 */
export function calculatePriorityFromFitScore(fitScore: number | undefined): 'high' | 'medium' | 'low' | 'none' {
  if (fitScore === undefined || fitScore === null) return 'none';
  if (fitScore >= 7) return 'high';
  if (fitScore >= 4) return 'medium';
  if (fitScore >= 1) return 'low';
  return 'none';
}

/**
 * Calculate intent score based on engagement signals
 * @param lead - Lead object with intent signals
 * @returns Score from 0-10
 */
export function calculateIntentScore(lead: {
  hasRequestedPricing?: boolean;
  hasRequestedDemo?: boolean;
  decisionTimeline?: string;
  isDecisionMaker?: boolean;
  leadSource?: string;
}): number {
  let score = 0;

  // Intent signals
  if (lead.hasRequestedPricing) score += 3;
  if (lead.hasRequestedDemo) score += 2;
  if (lead.decisionTimeline) score += 2;
  if (lead.isDecisionMaker) score += 2;

  // Inbound sources indicate higher intent
  const inboundSources = ['website', 'referral', 'inbound'];
  if (lead.leadSource && inboundSources.includes(lead.leadSource)) {
    score += 1;
  }

  return Math.min(score, 10);
}

/**
 * Calculate recency score based on days since last contact
 * @param lastContactedAt - Date of last contact
 * @returns Score from 0-10
 */
export function calculateRecencyScore(lastContactedAt: Date | undefined | null): number {
  if (!lastContactedAt) return 0;

  const now = new Date();
  const lastContact = lastContactedAt instanceof Date ? lastContactedAt : new Date(lastContactedAt);
  const daysSinceContact = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceContact <= 7) return 10;
  if (daysSinceContact <= 14) return 8;
  if (daysSinceContact <= 30) return 6;
  if (daysSinceContact <= 60) return 4;
  if (daysSinceContact <= 90) return 2;
  return 0;
}

/**
 * Get fit score from a lead (handles studio, publisher, and investor types)
 * @param lead - Lead object
 * @returns Fit score 0-10 or 0 if not set
 */
export function getFitScore(lead: {
  type: 'studio' | 'publisher' | 'investor' | 'community' | 'competition';
  studio?: { fitScore?: number };
  investor?: { fitScore?: number };
  community?: { fitScore?: number };
  competition?: { threatLevel?: number };
}): number {
  if (lead.type === 'studio' || lead.type === 'publisher') {
    return lead.studio?.fitScore ?? 0;
  }
  if (lead.type === 'community') {
    // Community fit score is 0-12, normalize to 0-10 for priority calculation
    const communityScore = lead.community?.fitScore ?? 0;
    return (communityScore / 12) * 10;
  }
  if (lead.type === 'competition') {
    // Competition uses threat level (1-5), normalize to 0-10 for priority calculation
    const threatLevel = lead.competition?.threatLevel ?? 1;
    return (threatLevel / 5) * 10;
  }
  return lead.investor?.fitScore ?? 0;
}

/**
 * Calculate overall priority score combining fit, intent, and recency
 * Formula: (Fit × 0.4) + (Intent × 0.4) + (Recency × 0.2)
 * @param lead - Lead object
 * @returns Score from 0-10
 */
export function calculatePriorityScore(lead: {
  type: 'studio' | 'publisher' | 'investor' | 'community' | 'competition';
  studio?: { fitScore?: number };
  investor?: { fitScore?: number };
  community?: { fitScore?: number };
  competition?: { threatLevel?: number };
  hasRequestedPricing?: boolean;
  hasRequestedDemo?: boolean;
  decisionTimeline?: string;
  isDecisionMaker?: boolean;
  leadSource?: string;
  lastContactedAt?: Date;
}): number {
  const fitScore = getFitScore(lead);
  const intentScore = calculateIntentScore(lead);
  const recencyScore = calculateRecencyScore(lead.lastContactedAt);

  const priorityScore = (fitScore * 0.4) + (intentScore * 0.4) + (recencyScore * 0.2);
  return Math.round(priorityScore * 10) / 10; // Round to 1 decimal
}

/**
 * Convert priority score to priority level
 * @param score - Priority score 0-10
 * @returns Priority level: 'high' | 'medium' | 'low' | 'none'
 */
export function calculatePriorityFromScore(score: number): 'high' | 'medium' | 'low' | 'none' {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score >= 1) return 'low';
  return 'none';
}

/**
 * Calculate priority and all component scores for a lead
 * @param lead - Lead object
 * @returns Object with all scores and priority level
 */
export function calculateLeadPriority(lead: {
  type: 'studio' | 'publisher' | 'investor' | 'community' | 'competition';
  studio?: { fitScore?: number };
  investor?: { fitScore?: number };
  community?: { fitScore?: number };
  competition?: { threatLevel?: number };
  hasRequestedPricing?: boolean;
  hasRequestedDemo?: boolean;
  decisionTimeline?: string;
  isDecisionMaker?: boolean;
  leadSource?: string;
  lastContactedAt?: Date;
}): {
  fitScore: number;
  intentScore: number;
  recencyScore: number;
  priorityScore: number;
  priority: 'high' | 'medium' | 'low' | 'none';
} {
  const fitScore = getFitScore(lead);
  const intentScore = calculateIntentScore(lead);
  const recencyScore = calculateRecencyScore(lead.lastContactedAt);
  const priorityScore = (fitScore * 0.4) + (intentScore * 0.4) + (recencyScore * 0.2);
  const roundedScore = Math.round(priorityScore * 10) / 10;

  return {
    fitScore,
    intentScore,
    recencyScore,
    priorityScore: roundedScore,
    priority: calculatePriorityFromScore(roundedScore),
  };
}

/**
 * Calculate fit score from studio fit criteria
 * @param criteria - Studio fit criteria checkboxes
 * @returns Score from 0-10
 */
export function calculateStudioFitScore(criteria: {
  narrativeHeavyGenre?: boolean;
  aiPositiveAttitude?: boolean;
  rightSize?: boolean;
  inActiveProduction?: boolean;
  usesTargetEngine?: boolean;
  otherScore?: number;
} | undefined): number {
  if (!criteria) return 0;

  let score = 0;

  if (criteria.narrativeHeavyGenre) score += 3;
  if (criteria.aiPositiveAttitude) score += 3;
  if (criteria.rightSize) score += 2;
  if (criteria.inActiveProduction) score += 1;
  if (criteria.usesTargetEngine) score += 1;

  // Add custom "other" score
  if (criteria.otherScore && criteria.otherScore > 0) {
    score += criteria.otherScore;
  }

  return Math.min(score, 10);
}

/**
 * Calculate fit score from investor fit criteria
 * @param criteria - Investor fit criteria checkboxes
 * @returns Score from 0-10
 */
export function calculateInvestorFitScore(criteria: {
  preSeedFocus?: boolean;
  gamingSectorActive?: boolean;
  aiDevToolsThesis?: boolean;
  euBased?: boolean;
  relevantPortfolio?: boolean;
  otherScore?: number;
} | undefined): number {
  if (!criteria) return 0;

  let score = 0;

  if (criteria.preSeedFocus) score += 3;
  if (criteria.gamingSectorActive) score += 3;
  if (criteria.aiDevToolsThesis) score += 2;
  if (criteria.euBased) score += 1;
  if (criteria.relevantPortfolio) score += 1;

  // Add custom "other" score
  if (criteria.otherScore && criteria.otherScore > 0) {
    score += criteria.otherScore;
  }

  return Math.min(score, 10);
}

/**
 * Calculate fit score from community fit criteria
 * @param criteria - Community fit criteria checkboxes
 * @returns Score from 0-12 (higher max due to more criteria)
 */
export function calculateCommunityFitScore(criteria: {
  narrativeFocused?: boolean;
  activeCommunity?: boolean;
  toolFriendly?: boolean;
  targetDemographic?: boolean;
  largeReach?: boolean;
  lowSaturation?: boolean;
  otherScore?: number;
} | undefined): number {
  if (!criteria) return 0;

  let score = 0;

  if (criteria.narrativeFocused) score += 3;
  if (criteria.activeCommunity) score += 3;
  if (criteria.toolFriendly) score += 2;
  if (criteria.targetDemographic) score += 2;
  if (criteria.largeReach) score += 1;
  if (criteria.lowSaturation) score += 1;

  // Add custom "other" score
  if (criteria.otherScore && criteria.otherScore > 0) {
    score += criteria.otherScore;
  }

  return Math.min(score, 12);
}