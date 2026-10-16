/**
 * Subsidy types for tracking grants, tax credits, and funding opportunities.
 */

export type SubsidyType = 'grant' | 'tax-credit' | 'loan' | 'prize' | 'accelerator' | 'other';

export const SUBSIDY_TYPE_LABELS: Record<SubsidyType, string> = {
  grant: 'Grant',
  'tax-credit': 'Tax Credit',
  loan: 'Loan',
  prize: 'Prize/Competition',
  accelerator: 'Accelerator',
  other: 'Other',
};

export type SubsidyStatus = 'tracking' | 'researching' | 'preparing' | 'applied' | 'under-review' | 'approved' | 'rejected' | 'received' | 'closed';

export const SUBSIDY_STATUS_LABELS: Record<SubsidyStatus, string> = {
  tracking: 'Tracking',
  researching: 'Researching',
  preparing: 'Preparing Application',
  applied: 'Applied',
  'under-review': 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  received: 'Received',
  closed: 'Closed',
};

export const SUBSIDY_STATUS_COLORS: Record<SubsidyStatus, string> = {
  tracking: 'bg-slate-100 text-slate-800',
  researching: 'bg-blue-100 text-blue-800',
  preparing: 'bg-amber-100 text-amber-800',
  applied: 'bg-yellow-100 text-yellow-800',
  'under-review': 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  received: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-gray-100 text-gray-800',
};

export interface Subsidy {
  id: string;
  name: string;
  type: SubsidyType;
  description?: string;
  
  // Provider info
  provider: string;         // "RVO", "Creative Europe", etc.
  providerCountry: string;  // "Netherlands", "EU", etc.
  website: string;
  applicationUrl?: string;
  
  // Financials
  amount?: string;          // "€50K" or "Up to 32%" or "€10K-50K"
  amountMin?: number;       // For filtering/sorting
  amountMax?: number;
  fundingPercentage?: number; // e.g., 50 for 50% funding
  
  // Dates
  deadline?: string;        // ISO date
  openDate?: string;        // When applications open
  decisionDate?: string;    // Expected decision date
  isRolling: boolean;       // Rolling deadline vs fixed
  
  // Eligibility
  eligibility: string;      // "Dutch R&D companies", "EU game studios"
  eligibilityCountries?: string[];
  eligibilityRequirements?: string[];
  
  // Status & Priority
  status: SubsidyStatus;
  priority: 'high' | 'medium' | 'low';
  
  // Relevance
  relevantFor: ('company-a' | 'company-b' | 'both')[];
  
  // Application tracking
  applicationStartedAt?: string;
  applicationSubmittedAt?: string;
  nextAction?: string;      // "Gather financial docs", "Schedule call"
  nextActionDue?: string;   // ISO date
  
  // Notes & Tags
  notes: string;
  tags: string[];           // ["r&d", "gaming", "ai", "dutch"]
  
  // Linked documents (paths or URLs)
  documents?: string[];
  
  // Metadata
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export interface SubsidyFormData extends Omit<Subsidy, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> {}

export interface SubsidyFilters {
  type?: SubsidyType;
  status?: SubsidyStatus;
  priority?: 'high' | 'medium' | 'low';
  provider?: string;
  deadlineBefore?: string;
  search?: string;
}
