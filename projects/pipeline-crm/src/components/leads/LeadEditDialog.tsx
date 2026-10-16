import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LeadForm } from '@/components/forms';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivities';
import type { Lead } from '@/types/lead';
import type { ActivityChange } from '@/types/activity';

interface LeadEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
}

// Helper to detect changes between old and new values
const detectChanges = (oldLead: Lead, newValues: Partial<Lead>): ActivityChange[] => {
  const changes: ActivityChange[] = [];
  const fieldsToTrack = ['name', 'type', 'category', 'status', 'priority', 'website', 'location', 'country'] as const;

  for (const field of fieldsToTrack) {
    if (newValues[field] !== undefined && newValues[field] !== oldLead[field]) {
      changes.push({ field, from: oldLead[field], to: newValues[field] });
    }
  }

  // Track contact changes
  if (newValues.contact) {
    if (newValues.contact.name !== oldLead.contact?.name) {
      changes.push({ field: 'contact.name', from: oldLead.contact?.name, to: newValues.contact.name });
    }
    if (newValues.contact.email !== oldLead.contact?.email) {
      changes.push({ field: 'contact.email', from: oldLead.contact?.email, to: newValues.contact.email });
    }
  }

  // Track tag changes
  const oldTags = oldLead.tags?.join(', ') || '';
  const newTags = newValues.tags?.join(', ') || '';
  if (newTags !== oldTags) {
    changes.push({ field: 'tags', from: oldTags, to: newTags });
  }

  return changes;
};

export const LeadEditDialog: React.FC<LeadEditDialogProps> = ({
  open,
  onOpenChange,
  lead,
}) => {
  const { user } = useAuth();
  const { editLead } = useLeads();
  const { logLeadUpdated } = useActivityLogger();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: Partial<Lead>) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const changes = detectChanges(lead, values);
      // Ensure createdBy is set (for legacy leads that may not have it)
      const updateData = { ...values, createdBy: lead.createdBy || user.uid };
      await editLead(lead.id, updateData);
      if (changes.length > 0) {
        await logLeadUpdated(lead.id, lead.name, changes);
      }
      toast.success('Lead updated');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogDescription>
            Update information for {lead.name}.
          </DialogDescription>
        </DialogHeader>
        <LeadForm
          initialValues={lead}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel="Save Changes"
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};
