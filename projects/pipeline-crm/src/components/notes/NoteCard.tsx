import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NoteStatusBadge } from './NoteStatusBadge';
import { Pencil, Trash2 } from 'lucide-react';
import type { Note } from '@/types/note';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (noteId: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onEdit, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(note.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <NoteStatusBadge status={note.status} />
              <span className="text-xs text-muted-foreground">
                {formatDate(note.createdAt)}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(note)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
