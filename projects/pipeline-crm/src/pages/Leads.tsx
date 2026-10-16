import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { usePipeline } from '@/hooks/usePipeline';
import { LeadsFilters, LeadsTable, LeadsBulkActions, LeadCreateDialog } from '@/components/leads';
import type { LeadFilters } from '@/types/lead';

interface OutletContext {
  searchTerm: string;
}

export const Leads: React.FC = () => {
  const { searchTerm } = useOutletContext<OutletContext>();
  const [filters, setFilters] = useState<LeadFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Sync search term from TopBar
  useEffect(() => {
    if (searchTerm) {
      setFilters((prev) => ({ ...prev, search: searchTerm }));
    }
  }, [searchTerm]);

  // Fetch leads with filters
  const { leads, loading, editLead, removeLead } = useLeads(filters);

  // Sort leads by createdAt (newest first)
  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : a.createdAt?.toDate?.() ?? new Date(0);
      const dateB = b.createdAt instanceof Date ? b.createdAt : b.createdAt?.toDate?.() ?? new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [leads]);

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} lead(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      await Promise.all(selectedIds.map((id) => removeLead(id)));
      toast.success(`${selectedIds.length} lead(s) deleted`);
      setSelectedIds([]);
    } catch {
      toast.error('Failed to delete leads');
    }
  };

  const handleArchive = async () => {
    try {
      await Promise.all(
        selectedIds.map((id) => editLead(id, { status: 'archived' }))
      );
      toast.success(`${selectedIds.length} lead(s) archived`);
      setSelectedIds([]);
    } catch {
      toast.error('Failed to archive leads');
    }
  };

  const handleSetPriority = async (priority: 'high' | 'medium' | 'low' | 'none') => {
    try {
      await Promise.all(
        selectedIds.map((id) => editLead(id, { priority }))
      );
      toast.success('Priority updated');
      setSelectedIds([]);
    } catch {
      toast.error('Failed to update priority');
    }
  };

  const { moveLeadToStage } = usePipeline();

  const handleSetStage = async (stageId: string) => {
    try {
      await Promise.all(
        selectedIds.map((id) => moveLeadToStage(id, stageId))
      );
      toast.success(`${selectedIds.length} lead(s) moved`);
      setSelectedIds([]);
    } catch {
      toast.error('Failed to move leads');
    }
  };

  const handleQualify = async (id: string) => {
    try {
      await editLead(id, { category: 'lead' });
      toast.success('Lead qualified');
    } catch {
      toast.error('Failed to qualify lead');
    }
  };

  // Get selected lead objects for bulk actions
  const selectedLeads = useMemo(() => {
    return leads.filter((lead) => selectedIds.includes(lead.id));
  }, [leads, selectedIds]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Manage your studios and investors
            {!loading && ` (${leads.length} total)`}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      <LeadsFilters
        filters={filters}
        onFiltersChange={setFilters}
        searchTerm={searchTerm}
      />

      <LeadsBulkActions
        selectedCount={selectedIds.length}
        selectedLeads={selectedLeads}
        onDelete={handleDelete}
        onArchive={handleArchive}
        onSetPriority={handleSetPriority}
        onSetStage={handleSetStage}
      />

      <LeadsTable
        leads={sortedLeads}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onQualify={handleQualify}
        loading={loading}
      />

      <LeadCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
};
