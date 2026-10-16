import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Building, DollarSign, ExternalLink, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { EmptyState } from '@/components/common';
import type { Lead } from '@/types/lead';

const ROW_HEIGHT = 65; // Estimated height of each table row in pixels
const VIRTUALIZATION_THRESHOLD = 99999; // TEMPORARILY disabled - Only virtualize when more than this many rows

interface LeadsTableProps {
  leads: Lead[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onQualify?: (id: string) => void;
  loading?: boolean;
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  none: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const typeColors: Record<string, string> = {
  studio: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  investor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const categoryColors: Record<string, string> = {
  prospect: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  lead: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
};

export const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  selectedIds,
  onSelectionChange,
  onQualify,
  loading,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = leads.length > VIRTUALIZATION_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5, // Render 5 extra items above/below viewport
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectionChange(leads.map((lead) => lead.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const allSelected = leads.length > 0 && selectedIds.length === leads.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < leads.length;

  if (loading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Fit</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
                <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="border rounded-lg">
        <EmptyState
          icon={Users}
          title="No leads found"
          description="Try adjusting your filters or add a new lead to get started."
        />
      </div>
    );
  }

  // Helper to render a table row
  const renderRow = (lead: Lead, isSelected: boolean) => {
    const createdAt = lead.createdAt instanceof Date
      ? lead.createdAt
      : lead.createdAt?.toDate?.() ?? new Date();
    const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true });

    return (
      <>
        <TableCell>
          <Checkbox
            checked={isSelected}
            onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
          />
        </TableCell>
        <TableCell>
          <Link
            to={`/leads/${lead.id}`}
            className="flex items-center gap-2 font-medium hover:underline"
          >
            {lead.type === 'studio' ? (
              <Building className="h-4 w-4 text-muted-foreground" />
            ) : (
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            )}
            {lead.name}
          </Link>
          {lead.website && (
            <a
              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {(() => {
                try {
                  return new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`).hostname;
                } catch {
                  return lead.website;
                }
              })()}
            </a>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className={typeColors[lead.type] || ''}>
            {lead.type || 'unknown'}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge
            variant="secondary"
            className={`${categoryColors[lead.category || 'prospect']} ${lead.category !== 'lead' && onQualify ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={(e) => {
              if (lead.category !== 'lead' && onQualify) {
                e.stopPropagation();
                e.preventDefault();
                onQualify(lead.id);
              }
            }}
            title={lead.category !== 'lead' ? 'Click to qualify as lead' : undefined}
          >
            {lead.category === 'lead' ? 'Lead' : 'Prospect'}
          </Badge>
        </TableCell>
        <TableCell>
          {lead.studio?.fitScore !== undefined ? (
            <span className={`font-medium ${lead.studio.fitScore >= 7 ? 'text-green-600' : lead.studio.fitScore >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
              {lead.studio.fitScore}/10
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{lead.contact?.name || '-'}</p>
            <p className="text-xs text-muted-foreground">{lead.contact?.role || ''}</p>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className={priorityColors[lead.priority] || priorityColors.none}>
            {lead.priority || 'none'}
          </Badge>
        </TableCell>
        <TableCell>
          <span className="capitalize">{lead.status}</span>
        </TableCell>
        <TableCell>
          <span className="text-muted-foreground">{timeAgo}</span>
        </TableCell>
      </>
    );
  };

  // Non-virtualized table (for small lists)
  if (!shouldVirtualize) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) (el as HTMLInputElement).indeterminate = someSelected;
                  }}
                  onChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Fit</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id);
              return (
                <TableRow key={lead.id} data-state={isSelected ? 'selected' : undefined}>
                  {renderRow(lead, isSelected)}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Virtualized table (for large lists)
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="border rounded-lg">
      {/* Sticky header */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as HTMLInputElement).indeterminate = someSelected;
                }}
                onChange={handleSelectAll}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Fit</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      {/* Virtualized scroll container */}
      <div
        ref={parentRef}
        className="max-h-[600px] overflow-auto"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <Table>
            <TableBody>
              {virtualItems.map((virtualRow) => {
                const lead = leads[virtualRow.index];
                const isSelected = selectedIds.includes(lead.id);

                return (
                  <TableRow
                    key={lead.id}
                    data-state={isSelected ? 'selected' : undefined}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderRow(lead, isSelected)}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
