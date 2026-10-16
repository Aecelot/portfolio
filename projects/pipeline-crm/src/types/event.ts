/**
 * Event types for tracking conferences, showcases, and meetups.
 */

export type EventType = 'conference' | 'showcase' | 'awards' | 'meetup' | 'game-jam' | 'other';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  conference: 'Conference',
  showcase: 'Showcase',
  awards: 'Awards',
  meetup: 'Meetup',
  'game-jam': 'Game Jam',
  other: 'Other',
};

export type EventStatus = 'tracking' | 'considering' | 'applied' | 'accepted' | 'attending' | 'declined' | 'passed' | 'completed';

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  tracking: 'Tracking',
  considering: 'Considering',
  applied: 'Applied',
  accepted: 'Accepted',
  attending: 'Attending',
  declined: 'Declined',
  passed: 'Passed',
  completed: 'Completed',
};

export const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  tracking: 'bg-slate-100 text-slate-800',
  considering: 'bg-blue-100 text-blue-800',
  applied: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  attending: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-red-100 text-red-800',
  passed: 'bg-gray-100 text-gray-800',
  completed: 'bg-purple-100 text-purple-800',
};

export interface Event {
  id: string;
  name: string;
  type: EventType;
  description?: string;
  
  // Dates
  startDate: string;        // ISO date
  endDate?: string;         // ISO date (optional for single-day events)
  applicationDeadline?: string;
  
  // Location
  location: string;         // "Malmö, Sweden" or "Online"
  isOnline: boolean;
  venue?: string;
  
  // Links
  website: string;
  applicationUrl?: string;
  
  // Cost & Logistics
  cost?: string;            // "€500" or "Free" or "€200-500"
  travelRequired: boolean;
  
  // Status & Priority
  status: EventStatus;
  priority: 'high' | 'medium' | 'low';
  
  // Relevance
  relevantFor: ('product-a' | 'product-b' | 'both')[];
  expectedAudience?: string;  // "500 indie devs" or "AAA studios"
  
  // Notes & Tags
  notes: string;
  tags: string[];           // ["networking", "showcase", "indie", "narrative"]
  
  // Metadata
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export interface EventFormData extends Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> {}

export interface EventFilters {
  type?: EventType;
  status?: EventStatus;
  priority?: 'high' | 'medium' | 'low';
  isOnline?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
