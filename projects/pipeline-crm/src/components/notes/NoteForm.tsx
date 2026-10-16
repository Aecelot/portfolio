import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Note, NoteStatus } from '@/types/note';

interface NoteFormProps {
  initialValues?: Partial<Note>;
  onSubmit: (values: { content: string; status: NoteStatus }) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export const NoteForm: React.FC<NoteFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save Note',
}) => {
  const [content, setContent] = useState(initialValues?.content || '');
  const [status, setStatus] = useState<NoteStatus>(initialValues?.status || 'warm');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError('Note content is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ content: content.trim(), status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="noteContent">Note</Label>
        <Textarea
          id="noteContent"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note here..."
          rows={4}
          className={error ? 'border-destructive' : ''}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="noteStatus">Temperature</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as NoteStatus)}>
          <SelectTrigger id="noteStatus">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cold">Cold</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
};
