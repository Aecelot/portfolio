import React, { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSequences } from '@/hooks/useSequences';
import { useGmail } from '@/hooks/useGmail';
import type { EmailSequence, SequenceEmail } from '@/types';
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  AlertCircle,
  Loader2,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

const DEFAULT_EMAIL: SequenceEmail = {
  order: 1,
  subject: '',
  body: '',
  delayDays: 2,
};

export const Sequences: React.FC = () => {
  const { sequences, loading, createSequence, updateSequence, deleteSequence } = useSequences();
  const { status: gmailStatus } = useGmail();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<EmailSequence | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [emails, setEmails] = useState<SequenceEmail[]>([{ ...DEFAULT_EMAIL }]);

  const resetForm = () => {
    setName('');
    setEmails([{ ...DEFAULT_EMAIL }]);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const openEditDialog = (sequence: EmailSequence) => {
    setName(sequence.name);
    setEmails([...sequence.emails]);
    setEditingSequence(sequence);
  };

  const closeDialog = () => {
    setShowCreateDialog(false);
    setEditingSequence(null);
    resetForm();
  };

  const addEmail = () => {
    const newOrder = emails.length + 1;
    setEmails([...emails, { ...DEFAULT_EMAIL, order: newOrder }]);
  };

  const removeEmail = (index: number) => {
    if (emails.length === 1) return;
    const newEmails = emails.filter((_, i) => i !== index).map((e, i) => ({
      ...e,
      order: i + 1,
    }));
    setEmails(newEmails);
  };

  const updateEmail = (index: number, field: keyof SequenceEmail, value: string | number) => {
    const newEmails = [...emails];
    newEmails[index] = { ...newEmails[index], [field]: value };
    setEmails(newEmails);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a sequence name');
      return;
    }

    if (emails.some(e => !e.subject.trim() || !e.body.trim())) {
      toast.error('All emails must have a subject and body');
      return;
    }

    setSaving(true);
    try {
      if (editingSequence) {
        await updateSequence(editingSequence.id, { name, emails });
        toast.success('Sequence updated');
      } else {
        await createSequence({ name, emails });
        toast.success('Sequence created');
      }
      closeDialog();
    } catch (error) {
      toast.error(editingSequence ? 'Failed to update sequence' : 'Failed to create sequence');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sequence: EmailSequence) => {
    try {
      await deleteSequence(sequence.id);
      toast.success('Sequence deleted');
      setDeleteConfirm(null);
    } catch (error) {
      if (error instanceof Error && error.message.includes('active leads')) {
        toast.error('Cannot delete sequence with active leads');
      } else {
        toast.error('Failed to delete sequence');
      }
    }
  };

  const isDialogOpen = showCreateDialog || editingSequence !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Sequences</h1>
          <p className="text-muted-foreground">
            Create and manage automated email chains for outreach
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/sequences/enroll">
            <Button variant="outline" disabled={!gmailStatus.connected || sequences.length === 0}>
              <Users className="h-4 w-4 mr-2" />
              Bulk Enroll
            </Button>
          </Link>
          <Button onClick={openCreateDialog} disabled={!gmailStatus.connected}>
            <Plus className="h-4 w-4 mr-2" />
            New Sequence
          </Button>
        </div>
      </div>

      {!gmailStatus.connected && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium">Gmail not connected</p>
              <p className="text-sm text-muted-foreground">
                Connect your Gmail account in Settings to enable email sequences.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sequences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sequences yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first email sequence to start automating your outreach.
            </p>
            <Button onClick={openCreateDialog} disabled={!gmailStatus.connected}>
              <Plus className="h-4 w-4 mr-2" />
              Create Sequence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sequences.map((sequence) => (
            <Card key={sequence.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    <CardDescription>
                      {sequence.emails.length} email{sequence.emails.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(sequence)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm(sequence)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {sequence.emails.map((email: SequenceEmail, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                        {email.order}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {email.subject || '(No subject)'}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        +{email.delayDays}d
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Created {formatDistanceToNow(sequence.createdAt.toDate(), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSequence ? 'Edit Sequence' : 'Create Sequence'}
            </DialogTitle>
            <DialogDescription>
              Build an email sequence with multiple follow-ups. Use {'{{firstName}}'}, {'{{name}}'}, or {'{{company}}'} for personalization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sequence Name</Label>
              <Input
                id="name"
                placeholder="e.g., Cold Outreach - Studios"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Emails</Label>
                <Button variant="outline" size="sm" onClick={addEmail}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Email
                </Button>
              </div>

              {emails.map((email, index) => (
                <Card key={index} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Email {email.order}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Label htmlFor={`delay-${index}`} className="text-xs">
                            Send after
                          </Label>
                          <Input
                            id={`delay-${index}`}
                            type="number"
                            min={0}
                            className="w-16 h-8 text-sm"
                            value={email.delayDays}
                            onChange={(e) =>
                              updateEmail(index, 'delayDays', parseInt(e.target.value) || 0)
                            }
                          />
                          <span className="text-xs text-muted-foreground">days</span>
                        </div>
                        {emails.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeEmail(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor={`subject-${index}`}>Subject</Label>
                      <Input
                        id={`subject-${index}`}
                        placeholder="Email subject line"
                        value={email.subject}
                        onChange={(e) => updateEmail(index, 'subject', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`body-${index}`}>Body (HTML supported)</Label>
                      <Textarea
                        id={`body-${index}`}
                        placeholder="Email body content..."
                        rows={6}
                        value={email.body}
                        onChange={(e) => updateEmail(index, 'body', e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSequence ? 'Save Changes' : 'Create Sequence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
