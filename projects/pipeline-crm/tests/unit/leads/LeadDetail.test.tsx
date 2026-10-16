import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LeadDetail } from '@/pages/LeadDetail';
import { ConfigProvider } from '@/contexts/ConfigContext';
import type { Lead } from '@/types/lead';

// Mock useLeads hook
const mockRemoveLead = vi.fn();
const mockEditLead = vi.fn();
const mockAddLead = vi.fn();

vi.mock('@/hooks/useLeads', () => ({
  useLeads: () => ({
    leads: mockLeads,
    loading: mockLoading,
    addLead: mockAddLead,
    editLead: mockEditLead,
    removeLead: mockRemoveLead,
  }),
}));

let mockLeads: Lead[] = [];
let mockLoading = false;

const testLead: Lead = {
  id: 'lead-123',
  name: 'Test Studio',
  type: 'studio',
  status: 'new',
  priority: 'high',
  contact: {
    name: 'John Doe',
    email: 'john@teststudio.com',
    role: 'CEO',
    phone: '+1 555-1234',
  },
  website: 'https://teststudio.com',
  location: 'Los Angeles',
  country: 'USA',
  studio: {
    size: '50-100',
    type: 'indie',
    focus: 'RPG',
    games: ['Game A', 'Game B'],
    fitScore: 85,
    fitReason: 'Great fit for our platform',
  },
  notes: 'Test notes here',
  tags: ['rpg', 'indie'],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
};

const renderLeadDetail = (leadId: string) => {
  return render(
    <MemoryRouter initialEntries={[`/leads/${leadId}`]}>
      <ConfigProvider>
        <Routes>
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/leads" element={<div>Leads List</div>} />
        </Routes>
      </ConfigProvider>
    </MemoryRouter>
  );
};

describe('LeadDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLeads = [testLead];
    mockLoading = false;
  });

  it('shows loading skeleton when loading', () => {
    mockLoading = true;
    renderLeadDetail('lead-123');

    // Skeleton elements should be visible
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows not found message for invalid lead ID', () => {
    mockLeads = [];
    renderLeadDetail('nonexistent-id');

    expect(screen.getByText('Lead Not Found')).toBeInTheDocument();
    expect(screen.getByText(/doesn't exist or has been deleted/i)).toBeInTheDocument();
  });

  it('displays lead name and type', () => {
    renderLeadDetail('lead-123');

    expect(screen.getByText('Test Studio')).toBeInTheDocument();
    expect(screen.getByText('studio')).toBeInTheDocument();
  });

  it('displays contact information', () => {
    renderLeadDetail('lead-123');

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('CEO')).toBeInTheDocument();
    expect(screen.getByText('john@teststudio.com')).toBeInTheDocument();
  });

  it('displays studio details for studio type', () => {
    renderLeadDetail('lead-123');

    expect(screen.getByText('Studio Details')).toBeInTheDocument();
    expect(screen.getByText('50-100')).toBeInTheDocument();
    expect(screen.getByText('RPG')).toBeInTheDocument();
  });

  it('displays notes', () => {
    renderLeadDetail('lead-123');

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Test notes here')).toBeInTheDocument();
  });

  it('displays tags', () => {
    renderLeadDetail('lead-123');

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('rpg')).toBeInTheDocument();
    // 'indie' appears as both tag and studio type, so use getAllByText
    expect(screen.getAllByText('indie').length).toBeGreaterThanOrEqual(1);
  });

  it('displays location', () => {
    renderLeadDetail('lead-123');

    expect(screen.getByText('Los Angeles, USA')).toBeInTheDocument();
  });

  it('opens delete dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderLeadDetail('lead-123');

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    expect(screen.getByText(/"Test Studio"/)).toBeInTheDocument();
  });

  it('calls removeLead when delete is confirmed', async () => {
    const user = userEvent.setup();
    mockRemoveLead.mockResolvedValue(undefined);
    renderLeadDetail('lead-123');

    // Open delete dialog
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockRemoveLead).toHaveBeenCalledWith('lead-123');
    });
  });

  it('shows edit button', () => {
    renderLeadDetail('lead-123');

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('shows website link', () => {
    renderLeadDetail('lead-123');

    const websiteLink = screen.getByRole('link', { name: /website/i });
    expect(websiteLink).toHaveAttribute('href', 'https://teststudio.com');
  });
});

describe('LeadDetail with investor type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoading = false;
    mockLeads = [{
      ...testLead,
      id: 'investor-123',
      name: 'Test Investor',
      type: 'investor',
      studio: undefined,
      investor: {
        type: 'vc',
        founded: '2010',
        investmentFocus: 'Gaming',
        hqRegion: 'North America',
        geographicalRegions: ['North America', 'Europe'],
        fundingPreferences: 'Series A and B',
      },
    }];
  });

  it('displays investor details for investor type', () => {
    renderLeadDetail('investor-123');

    expect(screen.getByText('Investor Details')).toBeInTheDocument();
    expect(screen.getByText('vc')).toBeInTheDocument();
    expect(screen.getByText('2010')).toBeInTheDocument();
    expect(screen.getByText('Gaming')).toBeInTheDocument();
  });

  it('displays geographical regions', () => {
    renderLeadDetail('investor-123');

    // 'North America' appears as both hqRegion and in geographicalRegions
    expect(screen.getAllByText('North America').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Europe')).toBeInTheDocument();
  });
});
