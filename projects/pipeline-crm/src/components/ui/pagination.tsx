/**
 * Pagination component for navigating through paginated data.
 */

import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  /** Current page number (1-indexed) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  total: number;
  /** Items per page */
  limit: number;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when limit changes */
  onLimitChange?: (limit: number) => void;
  /** Optional className for the container */
  className?: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

/**
 * Pagination component with page numbers, navigation, and page size selector.
 *
 * @example
 * <Pagination
 *   page={1}
 *   totalPages={10}
 *   total={487}
 *   limit={50}
 *   onPageChange={(page) => setPage(page)}
 *   onLimitChange={(limit) => setLimit(limit)}
 * />
 */
export function Pagination({
  page,
  totalPages,
  total,
  limit,
  isLoading = false,
  onPageChange,
  onLimitChange,
  className,
}: PaginationProps) {
  // Calculate display range
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  // Generate page numbers to display
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 py-4",
        className
      )}
    >
      {/* Items count and page size selector */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of{" "}
          {total.toLocaleString()}
        </span>

        {onLimitChange && (
          <div className="flex items-center gap-2">
            <span>per page:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              disabled={isLoading}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={page <= 1 || isLoading}
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-muted-foreground"
                >
                  ...
                </span>
              );
            }

            return (
              <Button
                key={pageNum}
                variant={pageNum === page ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(pageNum as number)}
                disabled={isLoading}
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        {/* Next page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages || isLoading}
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Generate array of page numbers to display.
 * Shows first, last, current, and nearby pages with ellipsis.
 */
function getPageNumbers(
  currentPage: number,
  totalPages: number
): (number | "...")[] {
  // If 7 or fewer pages, show all
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  let rangeStart = Math.max(2, currentPage - 1);
  let rangeEnd = Math.min(totalPages - 1, currentPage + 1);

  // Adjust range to always show 3 numbers in the middle
  if (rangeStart === 2) {
    rangeEnd = Math.min(totalPages - 1, 4);
  }
  if (rangeEnd === totalPages - 1) {
    rangeStart = Math.max(2, totalPages - 3);
  }

  // Add ellipsis before range if needed
  if (rangeStart > 2) {
    pages.push("...");
  }

  // Add range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  // Add ellipsis after range if needed
  if (rangeEnd < totalPages - 1) {
    pages.push("...");
  }

  // Always show last page
  pages.push(totalPages);

  return pages;
}

export default Pagination;
