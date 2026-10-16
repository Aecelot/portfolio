import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { mockLeads } from '../../mocks/leads';

describe('StatsCards', () => {
  it('renders loading state', () => {
    render(<StatsCards leads={[]} loading={true} />);

    // Should show skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders zero stats when no leads', () => {
    render(<StatsCards leads={[]} loading={false} />);

    expect(screen.getByText('Total Leads')).toBeInTheDocument();
    expect(screen.getByText('Studios')).toBeInTheDocument();
    expect(screen.getByText('Investors')).toBeInTheDocument();
    expect(screen.getByText('High Priority')).toBeInTheDocument();

    // All values should be 0
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(4);
  });

  it('calculates correct stats from leads', () => {
    render(<StatsCards leads={mockLeads} loading={false} />);

    // Total leads (4)
    expect(screen.getByText('4')).toBeInTheDocument();

    // Studios: 2, Investors: 2, High Priority: 2 (lead-1 and lead-4 are high)
    // So we should have 3 occurrences of "2"
    const twos = screen.getAllByText('2');
    expect(twos.length).toBe(3); // studios, investors, and high priority
  });

  it('displays correct card titles', () => {
    render(<StatsCards leads={[]} loading={false} />);

    expect(screen.getByText('Total Leads')).toBeInTheDocument();
    expect(screen.getByText('Studios')).toBeInTheDocument();
    expect(screen.getByText('Investors')).toBeInTheDocument();
    expect(screen.getByText('High Priority')).toBeInTheDocument();
  });

  it('displays correct descriptions', () => {
    render(<StatsCards leads={[]} loading={false} />);

    expect(screen.getByText('Studios and Investors')).toBeInTheDocument();
    expect(screen.getByText('Game studios tracked')).toBeInTheDocument();
    expect(screen.getByText('Investors tracked')).toBeInTheDocument();
    expect(screen.getByText('Leads needing attention')).toBeInTheDocument();
  });
});
