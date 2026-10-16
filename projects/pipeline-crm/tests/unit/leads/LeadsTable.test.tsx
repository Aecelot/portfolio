import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { mockLeads } from '../../mocks/leads';

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('LeadsTable', () => {
  const mockOnSelectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    renderWithRouter(
      <LeadsTable
        leads={[]}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        loading={true}
      />
    );

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state when no leads', () => {
    renderWithRouter(
      <LeadsTable
        leads={[]}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    expect(screen.getByText('No leads found.')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or add a new lead.')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    renderWithRouter(
      <LeadsTable
        leads={mockLeads}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
  });

  it('renders lead data', () => {
    renderWithRouter(
      <LeadsTable
        leads={mockLeads.slice(0, 2)}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    expect(screen.getByText('Awesome Games Studio')).toBeInTheDocument();
    expect(screen.getByText('Gaming Ventures Capital')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders type badges', () => {
    renderWithRouter(
      <LeadsTable
        leads={mockLeads.slice(0, 2)}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    expect(screen.getByText('studio')).toBeInTheDocument();
    expect(screen.getByText('investor')).toBeInTheDocument();
  });

  it('renders priority badges', () => {
    renderWithRouter(
      <LeadsTable
        leads={mockLeads.slice(0, 2)}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('links to lead detail pages', () => {
    renderWithRouter(
      <LeadsTable
        leads={mockLeads.slice(0, 1)}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    const link = screen.getByRole('link', { name: /Awesome Games Studio/ });
    expect(link).toHaveAttribute('href', '/leads/lead-1');
  });

  it('shows selected state for selected rows', () => {
    renderWithRouter(
      <LeadsTable
        leads={mockLeads.slice(0, 2)}
        selectedIds={['lead-1']}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    const rows = screen.getAllByRole('row');
    // First row is header, second row should be selected
    const selectedRow = rows.find(row => row.getAttribute('data-state') === 'selected');
    expect(selectedRow).toBeTruthy();
  });

  it('calls onSelectionChange when checkbox is clicked', () => {
    renderWithRouter(
      <LeadsTable
        leads={mockLeads.slice(0, 2)}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all", rest are row checkboxes
    fireEvent.click(checkboxes[1]); // Click first row checkbox

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['lead-1']);
  });

  it('selects all when header checkbox is clicked', () => {
    renderWithRouter(
      <LeadsTable
        leads={mockLeads.slice(0, 2)}
        selectedIds={[]}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Click "select all" checkbox

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['lead-1', 'lead-2']);
  });

  it('deselects all when header checkbox is clicked while all selected', () => {
    renderWithRouter(
      <LeadsTable
        leads={mockLeads.slice(0, 2)}
        selectedIds={['lead-1', 'lead-2']}
        onSelectionChange={mockOnSelectionChange}
        loading={false}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Click "select all" checkbox

    expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
  });
});
