import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ColumnSort, SortField } from '@/types/filters';
import { DEFAULT_SORT } from '@/types/filters';

interface ColumnSortProps {
  sort: ColumnSort;
  onChange: (sort: ColumnSort) => void;
}

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'icpScore', label: 'ICP Score' },
  { field: 'name', label: 'Name' },
  { field: 'enteredStageAt', label: 'Date Entered' },
];

export const ColumnSortDropdown: React.FC<ColumnSortProps> = ({ sort, onChange }) => {
  const isDefault = sort.field === DEFAULT_SORT.field && sort.direction === DEFAULT_SORT.direction;

  const handleSelect = (field: SortField) => {
    if (sort.field === field) {
      // Toggle direction if same field
      onChange({
        field,
        direction: sort.direction === 'desc' ? 'asc' : 'desc',
      });
    } else {
      // Default to desc for new field
      onChange({ field, direction: 'desc' });
    }
  };

  const getSortIcon = () => {
    if (isDefault) return <ArrowUpDown className="h-3.5 w-3.5" />;
    return sort.direction === 'desc' ? (
      <ArrowDown className="h-3.5 w-3.5" />
    ) : (
      <ArrowUp className="h-3.5 w-3.5" />
    );
  };

  const getCurrentLabel = () => {
    const option = SORT_OPTIONS.find((o) => o.field === sort.field);
    return option?.label || 'Sort';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={!isDefault ? 'secondary' : 'ghost'}
          size="sm"
          className={`h-6 px-1.5 gap-1 ${!isDefault ? 'bg-primary/20 text-primary' : ''}`}
        >
          {getSortIcon()}
          <span className="text-xs hidden sm:inline">{getCurrentLabel()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.field}
            onClick={() => handleSelect(option.field)}
            className="flex items-center justify-between"
          >
            <span>{option.label}</span>
            {sort.field === option.field && (
              sort.direction === 'desc' ? (
                <ArrowDown className="h-3.5 w-3.5 text-primary" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5 text-primary" />
              )
            )}
          </DropdownMenuItem>
        ))}
        {!isDefault && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(DEFAULT_SORT)}>
              Reset to default
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
