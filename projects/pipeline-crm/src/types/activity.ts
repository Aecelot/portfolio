import type { Timestamp } from 'firebase/firestore';

export type ActivityType =
  // Automated activities
  | 'lead_created'
  | 'lead_updated'
  | 'lead_deleted'
  | 'stage_changed'
  | 'note_added'
  | 'note_updated'
  | 'note_deleted'
  // Manual activities
  | 'call'
  | 'email'
  | 'meeting'
  | 'demo'
  | 'linkedin_message'
  | 'other';

// Manual activity types that can be logged by users
export type ManualActivityType = 'call' | 'email' | 'meeting' | 'demo' | 'linkedin_message' | 'other';

export const MANUAL_ACTIVITY_TYPES: Array<{ value: ManualActivityType; label: string }> = [
  { value: 'call', label: 'Phone Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'demo', label: 'Demo' },
  { value: 'linkedin_message', label: 'LinkedIn Message' },
  { value: 'other', label: 'Other' },
];

export interface ActivityChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface Activity {
  id: string;
  leadId: string;
  type: ActivityType;
  description: string;
  changes?: ActivityChange[];
  userId: string;
  userEmail: string;
  createdAt: Timestamp;
}

export interface ActivityFormData {
  leadId: string;
  type: ActivityType;
  description: string;
  changes?: ActivityChange[];
  userId: string;
  userEmail: string;
}

// Human-readable labels for activity types
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  // Automated
  lead_created: 'Created lead',
  lead_updated: 'Updated lead',
  lead_deleted: 'Deleted lead',
  stage_changed: 'Changed stage',
  note_added: 'Added note',
  note_updated: 'Updated note',
  note_deleted: 'Deleted note',
  // Manual
  call: 'Phone call',
  email: 'Email',
  meeting: 'Meeting',
  demo: 'Demo',
  linkedin_message: 'LinkedIn message',
  other: 'Activity',
};
