import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeads } from '@/hooks/useLeads';
import {
  LeadHeader,
  LeadContactInfo,
  LeadStudioInfo,
  LeadInvestorInfo,
  LeadCompetitionInfo,
  LeadQualificationInfo,
  LeadTags,
  LeadEditDialog,
  LeadSequenceCard,
  OwnerNotes,
} from '@/components/leads';
import { NotesList } from '@/components/notes';
import { ActivityTimeline, LogActivityModal } from '@/components/activities';
import { LeadContacts } from '@/components/contacts';
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

export const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads, loading, editLead, removeLead } = useLeads();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showLogActivityModal, setShowLogActivityModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const lead = leads.find((l) => l.id === id);

  const handleEdit = () => {
    setShowEditDialog(true);
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await removeLead(id);
      toast.success('Lead deleted');
      navigate('/leads');
    } catch {
      toast.error('Failed to delete lead');
      setIsDeleting(false);
    }
  };

  const handleQualify = async () => {
    if (!id) return;
    try {
      await editLead(id, { category: 'lead' });
      toast.success('Lead qualified');
    } catch {
      toast.error('Failed to qualify lead');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Lead Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The lead you're looking for doesn't exist or has been deleted.
            </p>
            <button
              onClick={() => navigate('/leads')}
              className="text-primary hover:underline"
            >
              Back to Leads
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LeadHeader
        lead={lead}
        onEdit={handleEdit}
        onDelete={() => setShowDeleteDialog(true)}
        onQualify={lead.category !== 'lead' ? handleQualify : undefined}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <LeadContacts leadId={lead.id} />
          <LeadContactInfo lead={lead} />
          {(lead.type === 'studio' || lead.type === 'publisher') && <LeadStudioInfo lead={lead} />}
          {lead.type === 'investor' && <LeadInvestorInfo lead={lead} />}
          {lead.type === 'competition' && <LeadCompetitionInfo lead={lead} />}
          <LeadQualificationInfo lead={lead} />
        </div>
        <div className="space-y-6">
          <LeadSequenceCard lead={lead} />
          <OwnerNotes lead={lead} />
          <NotesList leadId={lead.id} leadName={lead.name} />
          <LeadTags lead={lead} />
          <ActivityTimeline
            leadId={lead.id}
            onLogActivity={() => setShowLogActivityModal(true)}
          />
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{lead.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LeadEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        lead={lead}
      />

      <LogActivityModal
        open={showLogActivityModal}
        onOpenChange={setShowLogActivityModal}
        leadId={lead.id}
        leadName={lead.name}
      />
    </div>
  );
};
