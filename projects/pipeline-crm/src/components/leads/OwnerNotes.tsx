import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/useLeads';
import { Users, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react';
import type { Lead, OwnerNote } from '@/types/lead';
import { toast } from 'sonner';

interface OwnerNotesProps {
  lead: Lead;
}

// Format timestamp for display
const formatTime = (timestamp: any): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// Get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Color mapping for different owners
const ownerColors: Record<string, string> = {
  Alex: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  Collin: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Stephan: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  John: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

const getOwnerColor = (name: string): string => {
  return ownerColors[name] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
};

export const OwnerNotes: React.FC<OwnerNotesProps> = ({ lead }) => {
  const { user } = useAuth();
  const { editLead } = useLeads();
  const [expanded, setExpanded] = useState(true);
  const [editingAuthor, setEditingAuthor] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ownerNotes = lead.ownerNotes || [];

  // Get current user's name from email (before @)
  const currentUserName = user?.email?.split('@')[0] || '';
  const capitalizedUserName = currentUserName.charAt(0).toUpperCase() + currentUserName.slice(1);

  // Find existing note for current user
  const currentUserNote = ownerNotes.find(
    (note) => note.author.toLowerCase() === currentUserName.toLowerCase()
  );

  const handleStartEdit = (author: string, content: string) => {
    setEditingAuthor(author);
    setEditContent(content);
  };

  const handleCancelEdit = () => {
    setEditingAuthor(null);
    setEditContent('');
  };

  const handleSaveNote = async (author: string) => {
    if (!editContent.trim() && !currentUserNote) {
      handleCancelEdit();
      return;
    }

    setIsSubmitting(true);
    try {
      const existingNotes = lead.ownerNotes || [];
      const noteIndex = existingNotes.findIndex(
        (n) => n.author.toLowerCase() === author.toLowerCase()
      );

      let newNotes: OwnerNote[];
      if (noteIndex >= 0) {
        // Update existing note
        newNotes = [...existingNotes];
        if (editContent.trim()) {
          newNotes[noteIndex] = {
            ...newNotes[noteIndex],
            content: editContent.trim(),
            updatedAt: new Date(),
          };
        } else {
          // Remove note if content is empty
          newNotes.splice(noteIndex, 1);
        }
      } else if (editContent.trim()) {
        // Add new note
        newNotes = [
          ...existingNotes,
          {
            author: capitalizedUserName,
            content: editContent.trim(),
            updatedAt: new Date(),
          },
        ];
      } else {
        newNotes = existingNotes;
      }

      await editLead(lead.id, { ownerNotes: newNotes });
      toast.success('Note saved');
      handleCancelEdit();
    } catch (error) {
      toast.error('Failed to save note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNote = () => {
    setEditingAuthor(capitalizedUserName);
    setEditContent('');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Team Notes ({ownerNotes.length})
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {ownerNotes.length === 0 && editingAuthor === null ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No team notes yet.
            </p>
          ) : (
            <div className="space-y-3">
              {ownerNotes.map((note) => (
                <div key={note.author} className="border rounded-lg p-3">
                  {editingAuthor?.toLowerCase() === note.author.toLowerCase() ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${getOwnerColor(note.author)}`}
                        >
                          {getInitials(note.author)}
                        </div>
                        <span className="font-medium">{note.author}</span>
                      </div>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Add your note..."
                        rows={3}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={isSubmitting}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveNote(note.author)}
                          disabled={isSubmitting}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${getOwnerColor(note.author)}`}
                          >
                            {getInitials(note.author)}
                          </div>
                          <div>
                            <span className="font-medium">{note.author}</span>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(note.updatedAt)}
                            </p>
                          </div>
                        </div>
                        {note.author.toLowerCase() === currentUserName.toLowerCase() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(note.author, note.content)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    </div>
                  )}
                </div>
              ))}

              {/* New note form for current user (if they don't have one yet) */}
              {editingAuthor === capitalizedUserName && !currentUserNote && (
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${getOwnerColor(capitalizedUserName)}`}
                    >
                      {getInitials(capitalizedUserName)}
                    </div>
                    <span className="font-medium">{capitalizedUserName}</span>
                  </div>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Add your note..."
                    rows={3}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveNote(capitalizedUserName)}
                      disabled={isSubmitting}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add note button if current user doesn't have a note */}
          {!currentUserNote && editingAuthor !== capitalizedUserName && (
            <Button variant="outline" size="sm" onClick={handleAddNote} className="w-full">
              Add your note
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
};
