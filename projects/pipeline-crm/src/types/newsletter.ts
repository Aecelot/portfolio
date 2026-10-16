import { Timestamp } from 'firebase/firestore';

// Newsletter list - defines audience for newsletters
export interface NewsletterList {
  id: string;
  name: string;
  description: string;
  filterTags: string[];           // Auto-include contacts with these tags
  filterLeadTypes: string[];      // e.g., ["studio"] or ["investor"]
  manualIncludes: string[];       // Contact IDs manually added
  manualExcludes: string[];       // Contact IDs manually removed
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export type NewsletterListFormData = Omit<NewsletterList, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

// Newsletter campaign
export interface Newsletter {
  id: string;
  listId: string;
  subject: string;
  body: string;                   // Markdown content
  status: NewsletterStatus;
  sentAt: Timestamp | null;
  stats: NewsletterStats;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export type NewsletterStatus = 'draft' | 'sending' | 'sent' | 'failed';

export interface NewsletterStats {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
}

export type NewsletterFormData = Omit<Newsletter, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'sentAt' | 'stats' | 'status'>;

// Individual recipient tracking
export interface NewsletterRecipient {
  id: string;
  newsletterId: string;
  contactId: string;
  email: string;
  name: string;
  status: RecipientStatus;
  messageId: string | null;
  sentAt: Timestamp | null;
  openedAt: Timestamp | null;
  clickedAt: Timestamp | null;
}

export type RecipientStatus = 'pending' | 'sent' | 'failed';

// Trigger document for Cloud Function
export interface NewsletterSendRequest {
  id: string;
  newsletterId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

// Computed subscriber for preview
export interface ComputedSubscriber {
  contactId: string;
  email: string;
  name: string;
  company?: string;
  source: 'tag' | 'leadType' | 'manual';
}
