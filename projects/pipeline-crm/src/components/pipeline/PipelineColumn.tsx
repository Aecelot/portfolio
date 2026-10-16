import React, { useState, useMemo, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { PipelineCard } from './PipelineCard';
import { ColumnFilters } from './ColumnFilters';
import { ColumnSortDropdown } from './ColumnSort';
import { getStageColorClass, getStageBorderColorClass } from '@/lib/stages';
import type { ColumnFilter, ColumnSort } from '@/types/filters';
import { DEFAULT_SORT, isFilterActive } from '@/types/filters';
import type { Lead } from '@/types/lead';
import type { PipelineStage } from '@/types/pipeline';

const LEADS_PER_PAGE = 10;

interface PipelineColumnProps {
  stage: PipelineStage;
  leads: Lead[];
  filter?: ColumnFilter;
  sort?: ColumnSort;
  onFilterChange?: (filter: ColumnFilter) => void;
  onSortChange?: (sort: ColumnSort) => void;
  availableTags?: string[];
}

export const PipelineColumn: React.FC<PipelineColumnProps> = ({
  stage,
  leads,
  filter = {},
  sort = DEFAULT_SORT,
  onFilterChange,
  onSortChange,
  availableTags = [],
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: {
      type: 'column',
      stage,
    },
  });

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(leads.length / LEADS_PER_PAGE));

  // Reset to page 1 if current page exceeds total (e.g., after filtering)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Get paginated leads for current page
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
    return leads.slice(startIndex, startIndex + LEADS_PER_PAGE);
  }, [leads, currentPage]);

  const leadIds = paginatedLeads.map((lead) => lead.id);
  const hasActiveFilter = isFilterActive(filter);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div
      className={`flex flex-col w-full md:min-w-[560px] md:max-w-[640px] md:w-auto bg-muted/50 rounded-lg ${
        isOver ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
    >
      {/* Column Header */}
      <div
        className={`p-3 rounded-t-lg border-b-2 ${getStageBorderColorClass(stage.color)}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={getStageColorClass(stage.color)}
            >
              {stage.name}
            </Badge>
            <span className="text-sm font-medium text-muted-foreground">
              {leads.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onFilterChange && (
              <ColumnFilters
                filter={filter}
                onChange={onFilterChange}
                availableTags={availableTags}
              />
            )}
            {onSortChange && (
              <ColumnSortDropdown sort={sort} onChange={onSortChange} />
            )}
          </div>
        </div>
        {/* Active filter indicator */}
        {hasActiveFilter && (
          <div className="mt-2 text-xs text-muted-foreground">
            Filtered results
          </div>
        )}
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto transition-colors ${
          isOver ? 'bg-primary/5' : ''
        }`}
      >
        <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
          {paginatedLeads.map((lead) => (
            <PipelineCard key={lead.id} lead={lead} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 text-sm text-muted-foreground border-2 border-dashed rounded-lg gap-1">
            <Inbox className="h-5 w-5" />
            <span>{hasActiveFilter ? 'No matches' : 'Drop leads here'}</span>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {leads.length > LEADS_PER_PAGE && (
        <div className="flex items-center justify-between p-2 border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="h-7 px-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="h-7 px-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
