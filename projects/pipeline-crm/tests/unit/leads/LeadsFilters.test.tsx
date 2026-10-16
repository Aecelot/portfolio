import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeadsFilters } from '@/components/leads/LeadsFilters';
import type { LeadFilters } from '@/types/lead';

describe('LeadsFilters', () => {
  const mockOnFiltersChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all filter controls', () => {
    render(
      <LeadsFilters
        filters={{}}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.getByPlaceholderText('Search leads...')).toBeInTheDocument();
    // Radix Select displays text in triggers
    expect(screen.getByText('All Types')).toBeInTheDocument();
    expect(screen.getByText('All Priorities')).toBeInTheDocument();
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
  });

  it('shows search input with search term', () => {
    render(
      <LeadsFilters
        filters={{ search: 'test search' }}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.getByDisplayValue('test search')).toBeInTheDocument();
  });

  it('calls onFiltersChange when search input changes', () => {
    render(
      <LeadsFilters
        filters={{}}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search leads...');
    fireEvent.change(searchInput, { target: { value: 'new search' } });

    expect(mockOnFiltersChange).toHaveBeenCalledWith({ search: 'new search' });
  });

  it('renders type filter with correct triggers', () => {
    render(
      <LeadsFilters
        filters={{}}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Find all combobox triggers (the select triggers)
    const triggers = screen.getAllByRole('combobox');
    expect(triggers.length).toBe(3); // type, priority, status
  });

  it('renders priority filter trigger', () => {
    render(
      <LeadsFilters
        filters={{}}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Verify the priority filter text is shown
    expect(screen.getByText('All Priorities')).toBeInTheDocument();
  });

  it('renders status filter trigger', () => {
    render(
      <LeadsFilters
        filters={{}}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // Verify the status filter text is shown
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
  });

  it('shows Clear button when filters are active', () => {
    render(
      <LeadsFilters
        filters={{ type: 'studio' }}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('does not show Clear button when no filters are active', () => {
    render(
      <LeadsFilters
        filters={{}}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('clears all filters when Clear button is clicked', () => {
    render(
      <LeadsFilters
        filters={{ type: 'studio', priority: 'high', search: 'test' }}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    fireEvent.click(screen.getByText('Clear'));

    expect(mockOnFiltersChange).toHaveBeenCalledWith({});
  });

  it('displays selected filter values', () => {
    render(
      <LeadsFilters
        filters={{ type: 'investor', priority: 'medium', status: 'active' }}
        onFiltersChange={mockOnFiltersChange}
      />
    );

    // With Radix Select, the selected values are displayed in the trigger buttons
    expect(screen.getByText('Investors')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
