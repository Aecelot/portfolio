import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadForm } from '@/components/forms/LeadForm';
import { ConfigProvider } from '@/contexts/ConfigContext';

const renderWithConfig = (ui: React.ReactElement) => {
  return render(<ConfigProvider>{ui}</ConfigProvider>);
};

describe('LeadForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
  });

  it('renders all basic fields', () => {
    renderWithConfig(
      <LeadForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/lead type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
  });

  it('renders contact fields', () => {
    renderWithConfig(
      <LeadForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('Contact Person')).toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows studio fields when type is studio', () => {
    renderWithConfig(
      <LeadForm
        initialValues={{ type: 'studio' }}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Studio Details')).toBeInTheDocument();
    expect(screen.getByLabelText(/team size/i)).toBeInTheDocument();
  });

  it('shows investor fields when type is investor', () => {
    renderWithConfig(
      <LeadForm
        initialValues={{ type: 'investor' }}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Investor Details')).toBeInTheDocument();
    expect(screen.getByLabelText(/investor type/i)).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    const user = userEvent.setup();

    renderWithConfig(
      <LeadForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/company name is required/i)).toBeInTheDocument();
    });

    // Should not have called onSubmit
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();

    renderWithConfig(
      <LeadForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls onSubmit with form values when valid', async () => {
    const user = userEvent.setup();

    renderWithConfig(
      <LeadForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    );

    // Fill in required fields
    await user.type(screen.getByLabelText(/company name/i), 'Test Company');
    await user.type(screen.getByLabelText(/^name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Company',
          contact: expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
          }),
        })
      );
    });
  });

  it('shows custom submit label', () => {
    renderWithConfig(
      <LeadForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create Lead"
      />
    );

    expect(screen.getByRole('button', { name: /create lead/i })).toBeInTheDocument();
  });

  it('disables buttons when submitting', () => {
    renderWithConfig(
      <LeadForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isSubmitting={true}
      />
    );

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('uses initial values', () => {
    renderWithConfig(
      <LeadForm
        initialValues={{
          name: 'Existing Company',
          type: 'investor',
          contact: { name: 'Jane', email: 'jane@test.com', role: 'CEO' },
        }}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText(/company name/i)).toHaveValue('Existing Company');
    expect(screen.getByLabelText(/^name/i)).toHaveValue('Jane');
    expect(screen.getByLabelText(/email/i)).toHaveValue('jane@test.com');
  });
});
