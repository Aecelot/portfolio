import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import type { Activity } from '@/types/activity';
import { mockStudioLead, mockInvestorLead } from '../../mocks/leads';

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

const mockActivities: Activity[] = [
  {
    id: 'activity-1',
    type: 'LEAD_CREATED',
    leadId: 'lead-1',
    lead: mockStudioLead,
    userId: 'user-1',
    timestamp: new Date(),
  },
  {
    id: 'activity-2',
    type: 'LEAD_STAGE_CHANGED',
    leadId: 'lead-2',
    lead: mockInvestorLead,
    timestamp: new Date(Date.now() - 3600000), // 1 hour ago
    data: {
      newStage: 'negotiation',
    },
  },
  {
    id: 'activity-3',
    type: 'LEAD_UPDATED',
    leadId: 'lead-1',
    lead: mockStudioLead,
    timestamp: new Date(Date.now() - 7200000), // 2 hours ago
  },
];

describe('ActivityFeed', () => {
  it('renders loading state', () => {
    renderWithRouter(<ActivityFeed activities={[]} loading={true} />);

    expect(screen.getByText('Activity Feed')).toBeInTheDocument();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state when no activities', () => {
    renderWithRouter(<ActivityFeed activities={[]} loading={false} />);

    expect(screen.getByText('Activity Feed')).toBeInTheDocument();
    expect(screen.getByText('No recent activity.')).toBeInTheDocument();
    expect(screen.getByText('Activities will appear here as you work with leads.')).toBeInTheDocument();
  });

  it('renders activities list', () => {
    renderWithRouter(<ActivityFeed activities={mockActivities} loading={false} />);

    expect(screen.getByText('Activity Feed')).toBeInTheDocument();

    // Check activity descriptions
    expect(screen.getByText(/Awesome Games Studio was added as a new studio/)).toBeInTheDocument();
    expect(screen.getByText(/Gaming Ventures Capital moved to negotiation/)).toBeInTheDocument();
    expect(screen.getByText(/Awesome Games Studio was updated/)).toBeInTheDocument();
  });

  it('respects limit prop', () => {
    renderWithRouter(<ActivityFeed activities={mockActivities} loading={false} limit={1} />);

    // Should only show 1 activity
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(1);
  });

  it('links to lead detail pages', () => {
    renderWithRouter(<ActivityFeed activities={mockActivities.slice(0, 1)} loading={false} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/leads/lead-1');
  });

  it('displays relative timestamps', () => {
    renderWithRouter(<ActivityFeed activities={mockActivities} loading={false} />);

    // Should show relative time like "less than a minute ago", "about 1 hour ago", etc.
    // We check that some time indicators are present (one for each activity)
    const timestamps = screen.getAllByText(/ago/);
    expect(timestamps.length).toBe(mockActivities.length);
  });
});
