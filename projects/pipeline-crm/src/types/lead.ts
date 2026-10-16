export interface LeadContact {
  name: string;
  role: string;
  email: string;
  phone: string;
  linkedin: string;
}

// Owner note - individual note from a team member
export interface OwnerNote {
  author: string;
  content: string;
  updatedAt: Date | any; // Firestore Timestamp or Date
}

// Studio/Publisher size categories (gaming industry standard)
export type StudioSize = 'micro' | 'indie' | 'a' | 'aa' | 'aaa';

export const STUDIO_SIZE_LABELS: Record<StudioSize, string> = {
  micro: 'Micro (1-3)',
  indie: 'Indie (3-15)',
  a: 'A (15-50)',
  aa: 'AA (50-250)',
  aaa: 'AAA (250+)',
};

// Fit tags for studios/publishers - from spreadsheet
export type FitTag =
  | 'Narrative Focus'
  | 'User of Similar Tools'
  | 'Prototyping'
  | 'Innovation'
  | 'Efficiency'
  | 'Emergent Narrative';

export const FIT_TAGS: FitTag[] = [
  'Narrative Focus',
  'User of Similar Tools',
  'Prototyping',
  'Innovation',
  'Efficiency',
  'Emergent Narrative',
];

// Fit criteria for studios - checkboxes that sum to fit score
export interface StudioFitCriteria {
  narrativeHeavyGenre?: boolean;    // +3 - RPG, adventure, visual novel, story-driven
  aiPositiveAttitude?: boolean;      // +3 - Eager to use AI to innovate/scale
  rightSize?: boolean;               // +2 - Indie to AA (not solo, not massive AAA)
  inActiveProduction?: boolean;      // +1 - Currently making a game
  usesTargetEngine?: boolean;        // +1 - Unity or Unreal
  otherScore?: number;               // 0-10 custom adjustment
  otherReason?: string;              // Explanation for other score
}

// Fit criteria for investors - checkboxes that sum to fit score
export interface InvestorFitCriteria {
  preSeedFocus?: boolean;            // +3 - Invests at pre-seed stage
  gamingSectorActive?: boolean;      // +3 - Active in gaming/interactive entertainment
  aiDevToolsThesis?: boolean;        // +2 - Invests in AI, dev tools, or B2B SaaS
  euBased?: boolean;                 // +1 - EU-based or invests in EU
  relevantPortfolio?: boolean;       // +1 - Has gaming or dev tools companies
  otherScore?: number;               // 0-10 custom adjustment
  otherReason?: string;              // Explanation for other score
}

// Community platform types
export type CommunityPlatform =
  | 'discord'
  | 'reddit'
  | 'twitter'
  | 'youtube'
  | 'itch'
  | 'forum'
  | 'jam-org'
  | 'university'
  | 'association'
  | 'mastodon'
  | 'other';

export const COMMUNITY_PLATFORM_LABELS: Record<CommunityPlatform, string> = {
  discord: 'Discord',
  reddit: 'Reddit',
  twitter: 'Twitter/X',
  youtube: 'YouTube',
  itch: 'Itch.io',
  forum: 'Forum',
  'jam-org': 'Game Jam Organization',
  university: 'University/Student',
  association: 'Association/Organization',
  mastodon: 'Mastodon',
  other: 'Other',
};

// Community type categories
export type CommunityType =
  | 'narrative-tools'
  | 'gamedev-general'
  | 'engine-specific'
  | 'writing'
  | 'student'
  | 'indie-platform'
  | 'jam-community'
  | 'other';

export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  'narrative-tools': 'Narrative Tools (Twine, Ink, Ren\'Py)',
  'gamedev-general': 'Game Dev General',
  'engine-specific': 'Engine-Specific (Godot, Unity, RPG Maker)',
  'writing': 'Writing/Worldbuilding',
  'student': 'Student/Academic',
  'indie-platform': 'Indie Platform (itch.io, Game Jolt)',
  'jam-community': 'Game Jam Community',
  'other': 'Other',
};

// Fit criteria for communities - checkboxes that sum to fit score
export interface CommunityFitCriteria {
  narrativeFocused?: boolean;        // +3 - Specifically about narrative/IF/storytelling
  activeCommunity?: boolean;         // +3 - Regular posts, engaged members
  toolFriendly?: boolean;            // +2 - Welcomes tool showcases, has promo channels
  targetDemographic?: boolean;       // +2 - Indies, students, small teams
  largeReach?: boolean;              // +1 - 10K+ members/followers
  lowSaturation?: boolean;           // +1 - Not flooded with competing tools
  otherScore?: number;               // 0-10 custom adjustment
  otherReason?: string;              // Explanation for other score
}

export interface CommunityInfo {
  // Classification
  platform: CommunityPlatform;
  communityType: CommunityType;

  // Reach & Quality
  estimatedReach: number;
  engagementQuality: 'high' | 'medium' | 'low';
  accessMethod: 'public' | 'invite-only' | 'paid' | 'application';

  // Access
  platformUrl: string;
  postingRules?: string;
  narrativeFocus: boolean;

  // Attribution
  referralCode: string;

  // Metrics (manually updated)
  betaSignupsAttributed: number;
  lastPostedAt?: Date;

  // Fit scoring
  fitScore: number;
  fitCriteria?: CommunityFitCriteria;

  // Verification
  lastVerifiedAt?: Date;
}

// Competition target market
export type CompetitionTargetMarket = 'product-a' | 'product-b' | 'both';

export const COMPETITION_TARGET_LABELS: Record<CompetitionTargetMarket, string> = {
  'product-a': 'Product A',
  'product-b': 'Product B',
  both: 'Both',
};

export interface CompetitionInfo {
  // What they offer
  products: string[];
  targetMarket: CompetitionTargetMarket;

  // Assessment
  threatLevel: 1 | 2 | 3 | 4 | 5;
  strengths: string[];
  weaknesses: string[];

  // Context
  fundingStage?: string;
  teamSize?: string;
  foundedYear?: number;
  differentiator?: string;

  // Links & metrics
  website?: string;
  pricingInfo?: string;
  lastChecked?: Date | any; // Firestore Timestamp or Date
  estimatedPaidUsers?: number;
  estimatedFreeUsers?: number;
  estimatedRevenue?: number;
  amountRaised?: number;
}

export interface StudioInfo {
  size: StudioSize | string; // StudioSize preferred, string for backwards compat
  type: string;
  games: string[];
  focus: string;
  fitScore: number;
  fitReason: string;
  fitCriteria?: StudioFitCriteria;
  fitTags?: FitTag[];
}

export interface InvestorInfo {
  type: string;
  founded: string;
  investmentFocus: string;
  fundingPreferences: string;
  geographicalRegions: string[];
  hqRegion: string;
  fitScore?: number;
  fitCriteria?: InvestorFitCriteria;
}

export type LeadSource = 'website' | 'referral' | 'linkedin' | 'conference' | 'cold_outreach' | 'inbound' | 'other';
export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
export type LeadCategory = 'prospect' | 'lead';

export interface Lead {
  id: string;
  type: 'studio' | 'publisher' | 'investor' | 'community' | 'competition';
  name: string;
  status: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  category?: LeadCategory;
  owner: string;
  contact: LeadContact;
  website: string;
  country: string;
  location: string;
  tags: string[];
  notes: string;
  ownerNotes?: OwnerNote[];
  studio?: StudioInfo;  // Also used for publishers
  investor?: InvestorInfo;
  community?: CommunityInfo;
  competition?: CompetitionInfo;
  pipeline: {
    pipelineId: string;
    stageId: string;
    enteredStageAt: any;
  };
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  // Qualification fields
  leadSource?: LeadSource;
  companySize?: CompanySize;
  budgetRange?: string;
  decisionTimeline?: string;
  lastContactedAt?: Date;
  nextFollowUpAt?: Date;
  isDecisionMaker?: boolean;

  // Intent signals
  hasRequestedPricing?: boolean;
  hasRequestedDemo?: boolean;

  // Computed priority scores (for display/debugging)
  intentScore?: number;
  recencyScore?: number;
  priorityScore?: number;
}

export interface LeadFormData extends Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'pipeline'> {
  pipeline?: Partial<Lead['pipeline']>;
}

export interface LeadFilters {
  type?: 'studio' | 'investor' | 'community' | 'competition';
  category?: LeadCategory;
  status?: string;
  priority?: 'high' | 'medium' | 'low' | 'none';
  owner?: string;
  search?: string;
}