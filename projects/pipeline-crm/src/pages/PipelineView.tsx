import React, { useState, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PipelineBoard } from '@/components/pipeline';
import { FilterPresets } from '@/components/pipeline/FilterPresets';
import type { ColumnFilter, ColumnSort } from '@/types/filters';

export const PipelineView: React.FC = () => {
  const { type } = useParams<{ type: 'studios' | 'investors' | 'channels' | 'competition' }>();
  const [searchTerm, setSearchTerm] = useState('');

  // Lift filter/sort state to page level for presets integration
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({});
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSort>>({});

  // Convert URL param to pipeline type
  const pipelineType = type === 'investors' ? 'investor'
    : type === 'studios' ? 'studio'
    : type === 'channels' ? 'community'
    : type === 'competition' ? 'competition'
    : null;

  // Redirect if invalid type
  if (!pipelineType) {
    return <Navigate to="/pipeline/studios" replace />;
  }

  const pipelineTitle = pipelineType === 'investor' ? 'Investors'
    : pipelineType === 'community' ? 'Channels'
    : pipelineType === 'competition' ? 'Competition'
    : 'Studios';

  // Handle preset application
  const handleApplyPreset = useCallback((
    filters: Record<string, ColumnFilter>,
    sorts: Record<string, ColumnSort>
  ) => {
    setColumnFilters(filters);
    setColumnSorts(sorts);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{pipelineTitle} Pipeline</h1>
          <p className="text-muted-foreground">
            Drag and drop leads between stages
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads... (press / to focus)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <FilterPresets
            pipelineType={pipelineType}
            columnFilters={columnFilters}
            columnSorts={columnSorts}
            onApplyPreset={handleApplyPreset}
          />
        </div>
      </div>

      <PipelineBoard
        pipelineType={pipelineType}
        searchTerm={searchTerm}
        externalFilters={columnFilters}
        externalSorts={columnSorts}
        onFiltersChange={setColumnFilters}
        onSortsChange={setColumnSorts}
      />
    </div>
  );
};
