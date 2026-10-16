import { Timestamp } from 'firebase/firestore';

export interface SequenceEmail {
  order: number;
  subject: string;
  body: string;
  delayDays: number;
}

export interface EmailSequence {
  id: string;
  name: string;
  emails: SequenceEmail[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface EmailEvent {
  step: number;
  sentAt: Timestamp;
  messageId: string;
  threadId: string;
  opened: boolean;
  openedAt?: Timestamp;
  clicked: boolean;
  clickedAt?: Timestamp;
  replied: boolean;
  repliedAt?: Timestamp;
}

// Standard merge fields for email personalization
export interface MergeFields {
  firstName: string;
  lastName?: string;
  studioName: string;
  gameName?: string;
  genre?: string;
  customLine?: string;  // Personalized opener like "love the branching investigation structure"
  [key: string]: string | undefined;  // Allow custom fields
}

export interface LeadSequenceStatus {
  id: string;
  leadId: string;
  sequenceId: string;
  sequenceName: string;
  currentStep: number;
  status: 'active' | 'paused' | 'completed' | 'replied' | 'bounced';
  startedAt: Timestamp;
  nextSendAt: Timestamp | null;
  history: EmailEvent[];
  recipientEmail: string;
  recipientName: string;
  mergeFields: MergeFields;  // Personalization data for this enrollment
}

export interface GmailStatus {
  connected: boolean;
  email?: string;
  connectedAt?: Date;
  error?: string;
}

export type SequenceFormData = Omit<EmailSequence, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;
