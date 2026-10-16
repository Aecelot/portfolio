import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { LeadFilters } from '@/types/lead';

interface LeadsFiltersProps {
  filters: LeadFilters;
  onFiltersChange: (filters: LeadFilters) => void;
  searchTerm?: string;
}

const typeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'studio', label: 'Studios' },
  { value: 'investor', label: 'Investors' },
];

const priorityOptions = [
  { value: 'all', label: 'All Priorities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'None' },
];

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

const categoryOptions = [
  { value: 'all', label: 'All Categories' },
  { value: 'prospect', label: 'Prospects' },
  { value: 'lead', label: 'Leads' },
];

export const LeadsFilters: React.FC<LeadsFiltersProps> = ({
  filters,
  onFiltersChange,
  searchTerm,
}) => {
  const handleTypeChange = (value: string) => {
    onFiltersChange({ ...filters, type: value === 'all' ? undefined : value as 'studio' | 'investor' });
  };

  const handlePriorityChange = (value: string) => {
    onFiltersChange({ ...filters, priority: value === 'all' ? undefined : value as 'high' | 'medium' | 'low' | 'none' });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value === 'all' ? undefined : value });
  };

  const handleCategoryChange = (value: string) => {
    onFiltersChange({ ...filters, category: value === 'all' ? undefined : value as 'prospect' | 'lead' });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value || undefined });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = filters.type || filters.category || filters.priority || filters.status || filters.search;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search leads..."
          value={filters.search || searchTerm || ''}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      <Select value={filters.type || 'all'} onValueChange={handleTypeChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          {typeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.category || 'all'} onValueChange={handleCategoryChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          {categoryOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.priority || 'all'} onValueChange={handlePriorityChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Priorities" />
        </SelectTrigger>
        <SelectContent>
          {priorityOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
};
