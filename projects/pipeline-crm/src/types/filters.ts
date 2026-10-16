// Column filter types for pipeline view

export type IcpRange = '85+' | '70-84' | '50-69' | '<50';
export type Region = 'europe' | 'americas' | 'asia' | 'other';

export const ICP_RANGE_LABELS: Record<IcpRange, string> = {
  '85+': 'Qualified (85+)',
  '70-84': 'High Fit (70-84)',
  '50-69': 'Medium Fit (50-69)',
  '<50': 'Low Fit (<50)',
};

export const REGION_LABELS: Record<Region, string> = {
  europe: 'Europe',
  americas: 'Americas',
  asia: 'Asia/Pacific',
  other: 'Other',
};

// Map countries to regions
export const COUNTRY_TO_REGION: Record<string, Region> = {
  // Europe
  netherlands: 'europe',
  belgium: 'europe',
  germany: 'europe',
  france: 'europe',
  uk: 'europe',
  'united kingdom': 'europe',
  poland: 'europe',
  sweden: 'europe',
  finland: 'europe',
  denmark: 'europe',
  norway: 'europe',
  spain: 'europe',
  italy: 'europe',
  austria: 'europe',
  switzerland: 'europe',
  ireland: 'europe',
  portugal: 'europe',
  czech: 'europe',
  'czech republic': 'europe',
  hungary: 'europe',
  romania: 'europe',
  ukraine: 'europe',
  greece: 'europe',
  // Americas
  usa: 'americas',
  'united states': 'americas',
  us: 'americas',
  canada: 'americas',
  mexico: 'americas',
  brazil: 'americas',
  argentina: 'americas',
  chile: 'americas',
  colombia: 'americas',
  // Asia/Pacific
  japan: 'asia',
  china: 'asia',
  'south korea': 'asia',
  korea: 'asia',
  taiwan: 'asia',
  singapore: 'asia',
  indonesia: 'asia',
  malaysia: 'asia',
  thailand: 'asia',
  vietnam: 'asia',
  philippines: 'asia',
  india: 'asia',
  australia: 'asia',
  'new zealand': 'asia',
  'hong kong': 'asia',
};

export function getRegionFromCountry(country: string | undefined): Region {
  if (!country) return 'other';
  const normalized = country.toLowerCase().trim();
  return COUNTRY_TO_REGION[normalized] || 'other';
}

export function checkIcpRange(score: number | undefined, range: IcpRange): boolean {
  if (score === undefined || score === null) return range === '<50';
  switch (range) {
    case '85+': return score >= 85;
    case '70-84': return score >= 70 && score < 85;
    case '50-69': return score >= 50 && score < 70;
    case '<50': return score < 50;
    default: return false;
  }
}

export type SortField = 'icpScore' | 'name' | 'enteredStageAt';
export type SortDirection = 'asc' | 'desc';

export interface ColumnSort {
  field: SortField;
  direction: SortDirection;
}

export interface ColumnFilter {
  icpRanges?: IcpRange[];
  regions?: Region[];
  tags?: string[];
  hasContact?: boolean;
  priority?: ('high' | 'medium' | 'low' | 'none')[];
}

export interface FilterPreset {
  id: string;
  name: string;
  pipelineType: 'studio' | 'investor' | 'community';
  stageId?: string; // null = applies to all columns
  filters: ColumnFilter;
  sort?: ColumnSort;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export const DEFAULT_SORT: ColumnSort = {
  field: 'icpScore',
  direction: 'desc',
};

export function isFilterActive(filter: ColumnFilter | undefined): boolean {
  if (!filter) return false;
  return !!(
    (filter.icpRanges && filter.icpRanges.length > 0) ||
    (filter.regions && filter.regions.length > 0) ||
    (filter.tags && filter.tags.length > 0) ||
    filter.hasContact !== undefined ||
    (filter.priority && filter.priority.length > 0)
  );
}

export function countActiveFilters(filter: ColumnFilter | undefined): number {
  if (!filter) return 0;
  let count = 0;
  if (filter.icpRanges?.length) count++;
  if (filter.regions?.length) count++;
  if (filter.tags?.length) count++;
  if (filter.hasContact !== undefined) count++;
  if (filter.priority?.length) count++;
  return count;
}
