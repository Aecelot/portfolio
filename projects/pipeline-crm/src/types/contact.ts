// Contact - standalone contact entity in the contact book
export interface Contact {
  id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  linkedin?: string;
  company?: string;
  notes?: string;
  tags?: string[];
  unsubscribedFrom?: string[];    // Newsletter list IDs the contact has unsubscribed from
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string;
}

export type ContactFormData = Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;

// Junction table for many-to-many relationship between leads and contacts
export interface LeadContactLink {
  id: string;
  leadId: string;
  contactId: string;
  isPrimary: boolean;
  role?: string; // Role specific to this lead relationship
  createdAt: any; // Firestore Timestamp
  createdBy: string;
}

export type LeadContactLinkFormData = Omit<LeadContactLink, 'id' | 'createdAt'>;

export interface ContactFilters {
  search?: string;
  tags?: string[];
  company?: string;
}

// Contact with linked leads count for display
export interface ContactWithMeta extends Contact {
  linkedLeadsCount?: number;
}
