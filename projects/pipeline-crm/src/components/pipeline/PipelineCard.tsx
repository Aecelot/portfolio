import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Building, DollarSign, MapPin, Eye, Pencil, Trash2, GripVertical } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { LeadEditDialog } from '@/components/leads/LeadEditDialog';
import type { Lead } from '@/types/lead';

interface PipelineCardProps {
  lead: Lead;
  isDragging?: boolean;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  none: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export const PipelineCard: React.FC<PipelineCardProps> = ({ lead, isDragging }) => {
  const navigate = useNavigate();
  const { removeLead } = useLeads();
  const [showActions, setShowActions] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: 'lead',
      lead,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;

  const handleCardClick = () => {
    if (!isCurrentlyDragging) {
      navigate(`/leads/${lead.id}`);
    }
  };

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/leads/${lead.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditDialog(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeLead(lead.id);
      toast.success('Lead deleted');
    } catch {
      toast.error('Failed to delete lead');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`mb-2 cursor-grab active:cursor-grabbing transition-all group relative ${
          isCurrentlyDragging
            ? 'opacity-50 rotate-2 shadow-lg scale-105'
            : 'hover:shadow-md'
        }`}
        onClick={handleCardClick}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Quick Actions */}
        {showActions && !isCurrentlyDragging && (
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleView}
              title="View"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleEdit}
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDeleteClick}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {/* Mobile drag handle - visible on touch devices */}
            <div className="flex md:hidden h-8 w-6 shrink-0 items-center justify-center text-muted-foreground touch-none">
              <GripVertical className="h-5 w-5" />
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              {lead.type === 'studio' ? (
                <Building className="h-4 w-4 text-primary" />
              ) : (
                <DollarSign className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-16">
              <h4 className="font-medium text-sm truncate">{lead.name}</h4>
              <p className="text-xs text-muted-foreground truncate">
                {lead.contact?.name || 'No contact'}
              </p>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            {lead.priority !== 'none' && (
              <Badge variant="secondary" className={`text-xs ${priorityColors[lead.priority]}`}>
                {lead.priority}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {(() => {
                const score = lead.studio?.fitScore ?? lead.investor?.fitScore;
                return score !== undefined ? score : 'N/A';
              })()}
            </span>
          </div>

          {/* Investor-specific fields */}
          {lead.type === 'investor' && lead.investor && (
            <div className="mt-1 space-y-0.5">
              {lead.investor.type && (
                <p className="text-xs text-muted-foreground truncate">
                  {lead.investor.type}
                </p>
              )}
              {lead.investor.fundingPreferences && (
                <p className="text-xs text-muted-foreground truncate">
                  {lead.investor.fundingPreferences}
                </p>
              )}
            </div>
          )}

          {(lead.location || lead.country) && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">
                {[lead.location, lead.country].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <LeadEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        lead={lead}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
    </>
  );
};

// Overlay version for drag preview
export const PipelineCardOverlay: React.FC<{ lead: Lead }> = ({ lead }) => {
  return (
    <Card className="shadow-xl rotate-3 scale-105">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            {lead.type === 'studio' ? (
              <Building className="h-4 w-4 text-primary" />
            ) : (
              <DollarSign className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{lead.name}</h4>
            <p className="text-xs text-muted-foreground truncate">
              {lead.contact?.name || 'No contact'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
