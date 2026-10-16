import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeadsBulkActions } from '@/components/leads/LeadsBulkActions';

describe('LeadsBulkActions', () => {
  const mockOnDelete = vi.fn();
  const mockOnArchive = vi.fn();
  const mockOnSetPriority = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no items selected', () => {
    const { container } = render(
      <LeadsBulkActions
        selectedCount={0}
        onDelete={mockOnDelete}
        onArchive={mockOnArchive}
        onSetPriority={mockOnSetPriority}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders actions when items are selected', () => {
    render(
      <LeadsBulkActions
        selectedCount={3}
        onDelete={mockOnDelete}
        onArchive={mockOnArchive}
        onSetPriority={mockOnSetPriority}
      />
    );

    expect(screen.getByText('3 leads selected')).toBeInTheDocument();
    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('shows singular "lead" when one item selected', () => {
    render(
      <LeadsBulkActions
        selectedCount={1}
        onDelete={mockOnDelete}
        onArchive={mockOnArchive}
        onSetPriority={mockOnSetPriority}
      />
    );

    expect(screen.getByText('1 lead selected')).toBeInTheDocument();
  });

  it('calls onDelete when Delete button is clicked', () => {
    render(
      <LeadsBulkActions
        selectedCount={2}
        onDelete={mockOnDelete}
        onArchive={mockOnArchive}
        onSetPriority={mockOnSetPriority}
      />
    );

    fireEvent.click(screen.getByText('Delete'));

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onArchive when Archive button is clicked', () => {
    render(
      <LeadsBulkActions
        selectedCount={2}
        onDelete={mockOnDelete}
        onArchive={mockOnArchive}
        onSetPriority={mockOnSetPriority}
      />
    );

    fireEvent.click(screen.getByText('Archive'));

    expect(mockOnArchive).toHaveBeenCalledTimes(1);
  });

  it('calls onSetPriority with "high" when High Priority button is clicked', () => {
    render(
      <LeadsBulkActions
        selectedCount={2}
        onDelete={mockOnDelete}
        onArchive={mockOnArchive}
        onSetPriority={mockOnSetPriority}
      />
    );

    fireEvent.click(screen.getByText('High Priority'));

    expect(mockOnSetPriority).toHaveBeenCalledWith('high');
  });
});
