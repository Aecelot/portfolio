export type NoteStatus = 'cold' | 'warm' | 'hot';

export interface Note {
  id: string;
  leadId: string;
  content: string;
  status: NoteStatus;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string;
}

export type NoteFormData = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;
