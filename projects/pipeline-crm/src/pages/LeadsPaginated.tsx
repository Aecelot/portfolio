/**
 * Leads page with server-side pagination.
 *
 * Uses the new paginated API for efficient data loading.
 * This replaces the old Leads.tsx which loaded all leads into memory.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useLeadsList } from "@/hooks/useLeadsList";
import { useLeadMutations } from "@/hooks/useLeadMutations";
import { usePipeline } from "@/hooks/usePipeline";
import {
  LeadsFilters,
  LeadsTable,
  LeadsBulkActions,
  LeadCreateDialog,
} from "@/components/leads";
import { Pagination } from "@/components/ui/pagination";
import type { LeadFilters } from "@/types/lead";
import type { LeadsListParams, LeadListItem } from "@/api/leads.api";

interface OutletContext {
  searchTerm: string;
}

// Convert LeadFilters to API params
function filtersToParams(filters: LeadFilters): Partial<LeadsListParams> {
  return {
    type: filters.type,
    category: filters.category,
    status: filters.status,
    priority: filters.priority,
    owner: filters.owner,
    search: filters.search,
  };
}

// Convert API LeadListItem to Lead type for components
function mapLeadListItemToLead(item: LeadListItem) {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    status: item.status,
    priority: item.priority,
    category: item.category,
    owner: item.owner,
    website: item.website,
    country: item.country,
    location: "",
    tags: item.tags,
    notes: "",
    contact: {
      name: item.contact?.name || "",
      role: "",
      email: item.contact?.email || "",
      phone: "",
      linkedin: "",
    },
    studio: item.studio
      ? {
          size: item.studio.size as "micro" | "indie" | "a" | "aa" | "aaa" | string,
          type: "",
          games: [],
          focus: "",
          fitScore: item.studio.fitScore,
          fitReason: "",
        }
      : undefined,
    investor: item.investor
      ? {
          type: item.investor.type,
          founded: "",
          investmentFocus: "",
          fundingPreferences: "",
          geographicalRegions: [],
          hqRegion: "",
          fitScore: item.investor.fitScore,
        }
      : undefined,
    community: item.community
      ? {
          platform: item.community.platform as "discord" | "reddit" | "twitter" | "youtube" | "itch" | "forum" | "jam-org" | "university" | "association" | "mastodon" | "other",
          communityType: "other" as const,
          estimatedReach: item.community.estimatedReach,
          engagementQuality: "medium" as const,
          accessMethod: "public" as const,
          platformUrl: "",
          narrativeFocus: false,
          referralCode: "",
          betaSignupsAttributed: 0,
          fitScore: item.community.fitScore,
        }
      : undefined,
    pipeline: {
      pipelineId: item.pipeline.pipelineId,
      stageId: item.pipeline.stageId,
      enteredStageAt: null,
    },
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    createdBy: "",
  };
}

export const LeadsPaginated: React.FC = () => {
  const { searchTerm } = useOutletContext<OutletContext>();

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  // Sort state - currently using defaults, can add sort UI later
  const sort: LeadsListParams["sort"] = "createdAt";
  const order: LeadsListParams["order"] = "desc";

  // Filter state
  const [filters, setFilters] = useState<LeadFilters>({});

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Sync search term from TopBar
  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: searchTerm || undefined }));
    // Reset to first page when search changes
    setPage(1);
  }, [searchTerm]);

  // Reset to first page when filters change
  const handleFiltersChange = useCallback((newFilters: LeadFilters) => {
    setFilters(newFilters);
    setPage(1);
    setSelectedIds([]);
  }, []);

  // Fetch leads with pagination
  const { leads, pagination, isLoading, isFetching, refetch } = useLeadsList({
    page,
    limit,
    sort,
    order,
    ...filtersToParams(filters),
  });

  // Mutations
  const { updateLead, deleteLead } = useLeadMutations();
  const { moveLeadToStage } = usePipeline();

  // Convert API response to Lead type for existing components
  const mappedLeads = useMemo(() => leads.map(mapLeadListItemToLead), [leads]);

  // Bulk actions
  const handleDelete = async () => {
    if (
      !confirm(
        `Delete ${selectedIds.length} lead(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await Promise.all(selectedIds.map((id) => deleteLead.mutateAsync(id)));
      toast.success(`${selectedIds.length} lead(s) deleted`);
      setSelectedIds([]);
    } catch {
      toast.error("Failed to delete leads");
    }
  };

  const handleArchive = async () => {
    try {
      await Promise.all(
        selectedIds.map((id) =>
          updateLead.mutateAsync({ id, data: { status: "archived" } })
        )
      );
      toast.success(`${selectedIds.length} lead(s) archived`);
      setSelectedIds([]);
    } catch {
      toast.error("Failed to archive leads");
    }
  };

  const handleSetPriority = async (
    priority: "high" | "medium" | "low" | "none"
  ) => {
    try {
      await Promise.all(
        selectedIds.map((id) =>
          updateLead.mutateAsync({ id, data: { priority } })
        )
      );
      toast.success("Priority updated");
      setSelectedIds([]);
    } catch {
      toast.error("Failed to update priority");
    }
  };

  const handleSetStage = async (stageId: string) => {
    try {
      await Promise.all(selectedIds.map((id) => moveLeadToStage(id, stageId)));
      toast.success(`${selectedIds.length} lead(s) moved`);
      setSelectedIds([]);
    } catch {
      toast.error("Failed to move leads");
    }
  };

  const handleQualify = async (id: string) => {
    try {
      await updateLead.mutateAsync({ id, data: { category: "lead" } });
      toast.success("Lead qualified");
    } catch {
      toast.error("Failed to qualify lead");
    }
  };

  // Page change handlers
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    setSelectedIds([]);
  }, []);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    setSelectedIds([]);
  }, []);

  // Get selected lead objects for bulk actions
  const selectedLeads = useMemo(
    () => mappedLeads.filter((lead) => selectedIds.includes(lead.id)),
    [mappedLeads, selectedIds]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Manage your studios and investors
            {pagination && ` (${pagination.total.toLocaleString()} total)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <LeadsFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        searchTerm={searchTerm}
      />

      {/* Bulk actions */}
      <LeadsBulkActions
        selectedCount={selectedIds.length}
        selectedLeads={selectedLeads}
        onDelete={handleDelete}
        onArchive={handleArchive}
        onSetPriority={handleSetPriority}
        onSetStage={handleSetStage}
      />

      {/* Table */}
      <LeadsTable
        leads={mappedLeads}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onQualify={handleQualify}
        loading={isLoading}
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={limit}
          isLoading={isFetching}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}

      {/* Create dialog */}
      <LeadCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
};

export default LeadsPaginated;
