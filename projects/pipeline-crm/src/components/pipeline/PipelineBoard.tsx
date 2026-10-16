import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { PipelineColumn } from './PipelineColumn';
import { PipelineCardOverlay } from './PipelineCard';
import { getLeadsByStage } from '@/lib/stages';
import { useLeads } from '@/hooks/useLeads';
import { usePipeline } from '@/hooks/usePipeline';
import { useActivityLogger } from '@/hooks/useActivities';
import { Skeleton } from '@/components/ui/skeleton';
import type { ColumnFilter, ColumnSort } from '@/types/filters';
import {
  DEFAULT_SORT,
  checkIcpRange,
  getRegionFromCountry,
} from '@/types/filters';
import type { Lead } from '@/types/lead';

interface PipelineBoardProps {
  pipelineType: 'studio' | 'investor' | 'community' | 'competition';
  searchTerm?: string;
  // External filter/sort state (optional - for presets integration)
  externalFilters?: Record<string, ColumnFilter>;
  externalSorts?: Record<string, ColumnSort>;
  onFiltersChange?: (filters: Record<string, ColumnFilter>) => void;
  onSortsChange?: (sorts: Record<string, ColumnSort>) => void;
}

// Filter leads based on column filter settings
function applyFilter(leads: Lead[], filter: ColumnFilter): Lead[] {
  return leads.filter((lead) => {
    // ICP Range filter
    if (filter.icpRanges && filter.icpRanges.length > 0) {
      const score = (lead as any).icpScore;
      const matches = filter.icpRanges.some((range) => checkIcpRange(score, range));
      if (!matches) return false;
    }

    // Region filter
    if (filter.regions && filter.regions.length > 0) {
      const region = getRegionFromCountry(lead.country);
      if (!filter.regions.includes(region)) return false;
    }

    // Has contact filter
    if (filter.hasContact !== undefined) {
      const hasContact = !!(lead.contact?.email || lead.contact?.name);
      if (filter.hasContact && !hasContact) return false;
    }

    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      const leadTags = lead.tags || [];
      const hasMatchingTag = filter.tags.some((tag) =>
        leadTags.some((lt) => lt.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasMatchingTag) return false;
    }

    // Priority filter
    if (filter.priority && filter.priority.length > 0) {
      if (!filter.priority.includes(lead.priority)) return false;
    }

    return true;
  });
}

// Sort leads based on column sort settings
function applySort(leads: Lead[], sort: ColumnSort): Lead[] {
  const sorted = [...leads];
  const direction = sort.direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sort.field) {
      case 'icpScore': {
        const scoreA = (a as any).icpScore ?? 0;
        const scoreB = (b as any).icpScore ?? 0;
        return (scoreB - scoreA) * direction;
      }
      case 'name': {
        const nameA = a.name?.toLowerCase() || '';
        const nameB = b.name?.toLowerCase() || '';
        return nameA.localeCompare(nameB) * direction;
      }
      case 'enteredStageAt': {
        const dateA = a.pipeline?.enteredStageAt?.toDate?.()?.getTime() ?? 0;
        const dateB = b.pipeline?.enteredStageAt?.toDate?.()?.getTime() ?? 0;
        return (dateB - dateA) * direction;
      }
      default:
        return 0;
    }
  });

  return sorted;
}

export const PipelineBoard: React.FC<PipelineBoardProps> = ({
  pipelineType,
  searchTerm = '',
  externalFilters,
  externalSorts,
  onFiltersChange,
  onSortsChange,
}) => {
  const { leads, loading: leadsLoading } = useLeads({ type: pipelineType });
  const { pipelines, loading: pipelinesLoading, moveLeadToStage } = usePipeline();
  const { logStageChanged } = useActivityLogger();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimisticLeads, setOptimisticLeads] = useState<Lead[] | null>(null);

  // Internal filter and sort state (used when no external state provided)
  const [internalFilters, setInternalFilters] = useState<Record<string, ColumnFilter>>({});
  const [internalSorts, setInternalSorts] = useState<Record<string, ColumnSort>>({});

  // Use external or internal state
  const columnFilters = externalFilters ?? internalFilters;
  const columnSorts = externalSorts ?? internalSorts;

  // Sync external filters when they change
  useEffect(() => {
    if (externalFilters) {
      setInternalFilters(externalFilters);
    }
  }, [externalFilters]);

  useEffect(() => {
    if (externalSorts) {
      setInternalSorts(externalSorts);
    }
  }, [externalSorts]);

  // Collect all unique tags from leads for filter options
  const availableTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    leads.forEach((lead) => {
      lead.tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 20);
  }, [leads]);

  // Filter leads based on search term
  const filteredLeads = useMemo(() => {
    if (!searchTerm.trim()) return leads;
    const term = searchTerm.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.name?.toLowerCase().includes(term) ||
        lead.contact?.name?.toLowerCase().includes(term) ||
        lead.contact?.email?.toLowerCase().includes(term) ||
        lead.location?.toLowerCase().includes(term) ||
        lead.country?.toLowerCase().includes(term)
    );
  }, [leads, searchTerm]);

  // Get the relevant pipeline
  const pipeline = useMemo(() => {
    return pipelines.find((p) => p.type === pipelineType);
  }, [pipelines, pipelineType]);

  // Get active stages (sorted by order)
  const stages = useMemo(() => {
    if (!pipeline) return [];
    return [...pipeline.stages]
      .filter((s) => s.isActive)
      .sort((a, b) => a.order - b.order);
  }, [pipeline]);

  // Use optimistic leads if available
  const displayLeads = optimisticLeads ?? filteredLeads;

  // Group leads by stage, then apply per-column filters and sorts
  const leadsByStage = useMemo(() => {
    const grouped = getLeadsByStage(displayLeads, stages);
    
    const result: Record<string, Lead[]> = {};
    for (const stageId of Object.keys(grouped)) {
      let stageLeads = grouped[stageId];
      
      const filter = columnFilters[stageId];
      if (filter) {
        stageLeads = applyFilter(stageLeads, filter);
      }
      
      const sort = columnSorts[stageId] || DEFAULT_SORT;
      stageLeads = applySort(stageLeads, sort);
      
      result[stageId] = stageLeads;
    }
    
    return result;
  }, [displayLeads, stages, columnFilters, columnSorts]);

  // Get the active lead being dragged
  const activeLead = useMemo(() => {
    if (!activeId) return null;
    return displayLeads.find((lead) => lead.id === activeId) ?? null;
  }, [activeId, displayLeads]);

  // Callbacks for filter/sort changes
  const handleFilterChange = useCallback((stageId: string, filter: ColumnFilter) => {
    const newFilters = { ...columnFilters, [stageId]: filter };
    setInternalFilters(newFilters);
    onFiltersChange?.(newFilters);
  }, [columnFilters, onFiltersChange]);

  const handleSortChange = useCallback((stageId: string, sort: ColumnSort) => {
    const newSorts = { ...columnSorts, [stageId]: sort };
    setInternalSorts(newSorts);
    onSortsChange?.(newSorts);
  }, [columnSorts, onSortsChange]);

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeLeadId = active.id as string;
    const overId = over.id as string;

    const activeLead = displayLeads.find((l) => l.id === activeLeadId);
    if (!activeLead) return;

    let targetStageId: string | null = null;
    const overStage = stages.find((s) => s.id === overId);
    if (overStage) {
      targetStageId = overStage.id;
    } else {
      const overLead = displayLeads.find((l) => l.id === overId);
      if (overLead) {
        targetStageId = overLead.pipeline?.stageId ?? null;
      }
    }

    if (targetStageId && targetStageId !== activeLead.pipeline?.stageId) {
      setOptimisticLeads((prev) => {
        const currentLeads = prev ?? leads;
        return currentLeads.map((lead) =>
          lead.id === activeLeadId
            ? {
                ...lead,
                pipeline: {
                  ...lead.pipeline,
                  stageId: targetStageId!,
                  enteredStageAt: new Date(),
                },
              }
            : lead
        );
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      setOptimisticLeads(null);
      return;
    }

    const activeLeadId = active.id as string;
    const activeLead = leads.find((l) => l.id === activeLeadId);
    if (!activeLead) {
      setOptimisticLeads(null);
      return;
    }

    let targetStageId: string | null = null;
    const overStage = stages.find((s) => s.id === over.id);
    if (overStage) {
      targetStageId = overStage.id;
    } else {
      const overLead = displayLeads.find((l) => l.id === over.id);
      if (overLead) {
        targetStageId = overLead.pipeline?.stageId ?? null;
      }
    }

    if (targetStageId && targetStageId !== activeLead.pipeline?.stageId) {
      try {
        const fromStage = stages.find((s) => s.id === activeLead.pipeline?.stageId);
        const toStage = stages.find((s) => s.id === targetStageId);
        await moveLeadToStage(activeLeadId, targetStageId);
        await logStageChanged(
          activeLeadId,
          activeLead.name,
          fromStage?.name || 'Unknown',
          toStage?.name || 'Unknown'
        );
      } catch {
        toast.error('Failed to move lead');
        setOptimisticLeads(null);
        return;
      }
    }

    setOptimisticLeads(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOptimisticLeads(null);
  };

  // Loading state
  if (leadsLoading || pipelinesLoading) {
    return (
      <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto pb-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-full md:min-w-[280px] md:w-auto">
            <Skeleton className="h-12 w-full rounded-t-lg" />
            <Skeleton className="h-[200px] md:h-[400px] w-full rounded-b-lg mt-1" />
          </div>
        ))}
      </div>
    );
  }

  // No pipeline configured
  if (!pipeline || stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No pipeline stages configured. Please set up your pipeline first.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto pb-4">
        {stages.map((stage) => (
          <PipelineColumn
            key={stage.id}
            stage={stage}
            leads={leadsByStage[stage.id] || []}
            filter={columnFilters[stage.id] || {}}
            sort={columnSorts[stage.id] || DEFAULT_SORT}
            onFilterChange={(filter) => handleFilterChange(stage.id, filter)}
            onSortChange={(sort) => handleSortChange(stage.id, sort)}
            availableTags={availableTags}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? <PipelineCardOverlay lead={activeLead} /> : null}
      </DragOverlay>
    </DndContext>
  );
};
