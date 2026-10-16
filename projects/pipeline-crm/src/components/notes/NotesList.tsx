import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NoteCard } from './NoteCard';
import { NoteForm } from './NoteForm';
import { useNotes } from '@/hooks/useNotes';
import { useActivityLogger } from '@/hooks/useActivities';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Note, NoteStatus } from '@/types/note';

interface NotesListProps {
  leadId: string;
  leadName?: string;
}

export const NotesList: React.FC<NotesListProps> = ({ leadId, leadName = 'Unknown' }) => {
  const { notes, loading, addNote, editNote, removeNote } = useNotes(leadId);
  const { logNoteAdded, logNoteUpdated, logNoteDeleted } = useActivityLogger();
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const handleAddNote = async (values: { content: string; status: NoteStatus }) => {
    if (!user) return;
    await addNote({
      content: values.content,
      status: values.status,
      createdBy: user.uid,
    });
    await logNoteAdded(leadId, leadName);
    setShowAddDialog(false);
  };

  const handleEditNote = async (values: { content: string; status: NoteStatus }) => {
    if (!editingNote) return;
    await editNote(editingNote.id, {
      content: values.content,
      status: values.status,
    });
    await logNoteUpdated(leadId, leadName);
    setEditingNote(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    await removeNote(noteId);
    await logNoteDeleted(leadId, leadName);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 mb-3" />
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Notes ({notes.length})
            </CardTitle>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No notes yet. Add a note to track your interactions.
            </p>
          ) : (
            notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={setEditingNote}
                onDelete={handleDeleteNote}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <NoteForm
            onSubmit={handleAddNote}
            onCancel={() => setShowAddDialog(false)}
            submitLabel="Add Note"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          {editingNote && (
            <NoteForm
              initialValues={editingNote}
              onSubmit={handleEditNote}
              onCancel={() => setEditingNote(null)}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
