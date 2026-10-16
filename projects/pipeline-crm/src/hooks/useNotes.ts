import { useState, useEffect } from 'react';
import {
  getNotesForLeadRealtime,
  createNote,
  updateNote,
  deleteNote,
} from '@/lib/firestore';
import type { Note, NoteFormData } from '@/types/note';

export const useNotes = (leadId: string) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = getNotesForLeadRealtime(leadId, (notesData) => {
      setNotes(notesData);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [leadId]);

  const addNote = async (noteData: Omit<NoteFormData, 'leadId'>) => {
    try {
      await createNote({
        ...noteData,
        leadId,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create note';
      setError(errorMessage);
      throw err;
    }
  };

  const editNote = async (id: string, data: Partial<Note>) => {
    try {
      await updateNote(id, data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update note';
      setError(errorMessage);
      throw err;
    }
  };

  const removeNote = async (id: string) => {
    try {
      await deleteNote(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete note';
      setError(errorMessage);
      throw err;
    }
  };

  return {
    notes,
    loading,
    error,
    addNote,
    editNote,
    removeNote,
  };
};
