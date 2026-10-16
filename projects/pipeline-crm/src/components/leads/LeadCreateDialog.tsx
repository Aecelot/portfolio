import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { LeadForm } from '@/components/forms';
import { useLeads } from '@/hooks/useLeads';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivities';
import { useDuplicateDetection } from '@/hooks/useDuplicateDetection';
import { formatDuplicateMatch, type DuplicateMatch } from '@/lib/duplicateDetection';
import type { Lead } from '@/types/lead';

interface LeadCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: 'studio' | 'investor' | 'community';
}

export const LeadCreateDialog: React.FC<LeadCreateDialogProps> = ({
  open,
  onOpenChange,
  defaultType = 'studio',
}) => {
  const { user } = useAuth();
  const { addLead } = useLeads();
  const { logLeadCreated } = useActivityLogger();
  const { checkForDuplicates } = useDuplicateDetection();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingValues, setPendingValues] = useState<Partial<Lead> | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  const createLead = async (values: Partial<Lead>) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const leadData = { ...values, createdBy: user.uid };
      const leadId = await addLead(leadData as Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>);
      await logLeadCreated(leadId, values.name || 'Unknown');
      toast.success('Lead created successfully');
      onOpenChange(false);
    } catch {
      toast.error('Failed to create lead');
    } finally {
      setIsSubmitting(false);
      setPendingValues(null);
    }
  };

  const handleSubmit = async (values: Partial<Lead>) => {
    // Check for duplicates first
    const result = checkForDuplicates(values);

    if (result.hasDuplicates) {
      setPendingValues(values);
      setDuplicates(result.duplicates);
      setShowDuplicateWarning(true);
    } else {
      await createLead(values);
    }
  };

  const handleConfirmCreate = async () => {
    setShowDuplicateWarning(false);
    if (pendingValues) {
      await createLead(pendingValues);
    }
  };

  const handleCancelCreate = () => {
    setShowDuplicateWarning(false);
    setPendingValues(null);
    setDuplicates([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
            <DialogDescription>
              Add a new {defaultType} lead to your pipeline.
            </DialogDescription>
          </DialogHeader>
          <LeadForm
            initialValues={{ type: defaultType }}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            submitLabel="Create Lead"
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potential Duplicate Detected</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  This lead may already exist in your system. The following potential matches were found:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {duplicates.slice(0, 3).map((match) => (
                    <li key={match.lead.id} className="text-sm">
                      <span className="font-medium">{match.lead.name}</span>
                      <span className="text-muted-foreground"> - {formatDuplicateMatch(match)}</span>
                    </li>
                  ))}
                </ul>
                {duplicates.length > 3 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    ...and {duplicates.length - 3} more potential match{duplicates.length - 3 > 1 ? 'es' : ''}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelCreate}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCreate}>
              Create Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
