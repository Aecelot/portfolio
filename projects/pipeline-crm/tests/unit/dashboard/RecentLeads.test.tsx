import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RecentLeads } from '@/components/dashboard/RecentLeads';
import { mockLeads } from '../../mocks/leads';

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('RecentLeads', () => {
  it('renders loading state', () => {
    renderWithRouter(<RecentLeads leads={[]} loading={true} />);

    expect(screen.getByText('Recent Leads')).toBeInTheDocument();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state when no leads', () => {
    renderWithRouter(<RecentLeads leads={[]} loading={false} />);

    expect(screen.getByText('Recent Leads')).toBeInTheDocument();
    expect(screen.getByText('No leads yet. Add your first lead to get started.')).toBeInTheDocument();
  });

  it('renders leads list', () => {
    renderWithRouter(<RecentLeads leads={mockLeads} loading={false} />);

    expect(screen.getByText('Recent Leads')).toBeInTheDocument();
    expect(screen.getByText('View all')).toBeInTheDocument();

    // Check lead names appear
    expect(screen.getByText('Awesome Games Studio')).toBeInTheDocument();
    expect(screen.getByText('Gaming Ventures Capital')).toBeInTheDocument();
  });

  it('respects limit prop', () => {
    renderWithRouter(<RecentLeads leads={mockLeads} loading={false} limit={2} />);

    // Should only show 2 leads
    const links = screen.getAllByRole('link').filter(link =>
      link.getAttribute('href')?.startsWith('/leads/')
    );
    expect(links.length).toBe(2);
  });

  it('displays lead contact names', () => {
    renderWithRouter(<RecentLeads leads={mockLeads.slice(0, 2)} loading={false} />);

    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it('displays priority badges', () => {
    renderWithRouter(<RecentLeads leads={mockLeads.slice(0, 2)} loading={false} />);

    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('links to lead detail pages', () => {
    renderWithRouter(<RecentLeads leads={mockLeads.slice(0, 1)} loading={false} />);

    const link = screen.getByRole('link', { name: /Awesome Games Studio/ });
    expect(link).toHaveAttribute('href', '/leads/lead-1');
  });

  it('links to leads list page', () => {
    renderWithRouter(<RecentLeads leads={mockLeads} loading={false} />);

    const viewAllLink = screen.getByRole('link', { name: 'View all' });
    expect(viewAllLink).toHaveAttribute('href', '/leads');
  });
});
