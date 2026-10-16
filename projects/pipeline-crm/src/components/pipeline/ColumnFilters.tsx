import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { ColumnFilter, IcpRange, Region } from '@/types/filters';
import {
  ICP_RANGE_LABELS,
  REGION_LABELS,
  isFilterActive,
  countActiveFilters,
} from '@/types/filters';

interface ColumnFiltersProps {
  filter: ColumnFilter;
  onChange: (filter: ColumnFilter) => void;
  availableTags?: string[];
}

export const ColumnFilters: React.FC<ColumnFiltersProps> = ({
  filter,
  onChange,
  availableTags = [],
}) => {
  const active = isFilterActive(filter);
  const activeCount = countActiveFilters(filter);

  const toggleIcpRange = (range: IcpRange) => {
    const current = filter.icpRanges || [];
    const newRanges = current.includes(range)
      ? current.filter((r) => r !== range)
      : [...current, range];
    onChange({ ...filter, icpRanges: newRanges.length > 0 ? newRanges : undefined });
  };

  const toggleRegion = (region: Region) => {
    const current = filter.regions || [];
    const newRegions = current.includes(region)
      ? current.filter((r) => r !== region)
      : [...current, region];
    onChange({ ...filter, regions: newRegions.length > 0 ? newRegions : undefined });
  };

  const toggleTag = (tag: string) => {
    const current = filter.tags || [];
    const newTags = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    onChange({ ...filter, tags: newTags.length > 0 ? newTags : undefined });
  };

  const toggleHasContact = () => {
    onChange({
      ...filter,
      hasContact: filter.hasContact === undefined ? true : undefined,
    });
  };

  const clearAll = () => {
    onChange({});
  };

  // Get top 10 most common tags from availableTags
  const topTags = availableTags.slice(0, 10);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={active ? 'secondary' : 'ghost'}
          size="sm"
          className={`h-6 w-6 p-0 relative ${active ? 'bg-primary/20 text-primary' : ''}`}
        >
          <Filter className="h-3.5 w-3.5" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filters</span>
            {active && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={clearAll}
              >
                Clear all
              </Button>
            )}
          </div>

          {/* ICP Score */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">ICP Score</Label>
            <div className="space-y-1">
              {(Object.keys(ICP_RANGE_LABELS) as IcpRange[]).map((range) => (
                <div key={range} className="flex items-center space-x-2">
                  <Checkbox
                    id={`icp-${range}`}
                    checked={filter.icpRanges?.includes(range) || false}
                    onChange={() => toggleIcpRange(range)}
                  />
                  <label
                    htmlFor={`icp-${range}`}
                    className="text-sm cursor-pointer"
                  >
                    {ICP_RANGE_LABELS[range]}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Region</Label>
            <div className="space-y-1">
              {(Object.keys(REGION_LABELS) as Region[]).map((region) => (
                <div key={region} className="flex items-center space-x-2">
                  <Checkbox
                    id={`region-${region}`}
                    checked={filter.regions?.includes(region) || false}
                    onChange={() => toggleRegion(region)}
                  />
                  <label
                    htmlFor={`region-${region}`}
                    className="text-sm cursor-pointer"
                  >
                    {REGION_LABELS[region]}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Has Contact */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Contact</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-contact"
                checked={filter.hasContact === true}
                onChange={toggleHasContact}
              />
              <label htmlFor="has-contact" className="text-sm cursor-pointer">
                Has contact info
              </label>
            </div>
          </div>

          {/* Tags (if available) */}
          {topTags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <div className="flex flex-wrap gap-1">
                {topTags.map((tag) => (
                  <Button
                    key={tag}
                    variant={filter.tags?.includes(tag) ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                    {filter.tags?.includes(tag) && (
                      <X className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
