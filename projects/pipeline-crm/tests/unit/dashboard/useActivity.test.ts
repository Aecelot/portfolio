import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useActivity, getActivityDescription, getActivityIcon } from '@/hooks/useActivity';
import type { Activity } from '@/types/activity';
import { mockStudioLead } from '../../mocks/leads';

// Mock useLeads
vi.mock('@/hooks/useLeads', () => ({
  useLeads: vi.fn(() => ({
    leads: [],
    loading: false,
    error: null,
  })),
}));

import { useLeads } from '@/hooks/useLeads';

describe('useActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty activities when no leads', async () => {
    (useLeads as ReturnType<typeof vi.fn>).mockReturnValue({
      leads: [],
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useActivity());

    await waitFor(() => {
      expect(result.current.activities).toEqual([]);
      expect(result.current.loading).toBe(false);
    });
  });

  it('generates activities from leads', async () => {
    const leadWithDates = {
      ...mockStudioLead,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20'),
      pipeline: {
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
        enteredStageAt: new Date('2024-01-18'),
      },
    };

    (useLeads as ReturnType<typeof vi.fn>).mockReturnValue({
      leads: [leadWithDates],
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useActivity());

    await waitFor(() => {
      // Should generate activities: created, updated, stage changed
      expect(result.current.activities.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('respects limit parameter', async () => {
    const leads = [
      { ...mockStudioLead, id: '1', createdAt: new Date('2024-01-15') },
      { ...mockStudioLead, id: '2', createdAt: new Date('2024-01-14') },
      { ...mockStudioLead, id: '3', createdAt: new Date('2024-01-13') },
    ];

    (useLeads as ReturnType<typeof vi.fn>).mockReturnValue({
      leads,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useActivity(2));

    await waitFor(() => {
      expect(result.current.activities.length).toBeLessThanOrEqual(2);
    });
  });

  it('returns loading state from useLeads', async () => {
    (useLeads as ReturnType<typeof vi.fn>).mockReturnValue({
      leads: [],
      loading: true,
      error: null,
    });

    const { result } = renderHook(() => useActivity());

    expect(result.current.loading).toBe(true);
  });
});

describe('getActivityDescription', () => {
  it('returns correct description for LEAD_CREATED', () => {
    const activity: Activity = {
      id: 'test',
      type: 'LEAD_CREATED',
      leadId: 'lead-1',
      lead: mockStudioLead,
      timestamp: new Date(),
    };

    const description = getActivityDescription(activity);
    expect(description).toContain('Awesome Games Studio');
    expect(description).toContain('studio');
  });

  it('returns correct description for LEAD_UPDATED', () => {
    const activity: Activity = {
      id: 'test',
      type: 'LEAD_UPDATED',
      leadId: 'lead-1',
      lead: mockStudioLead,
      timestamp: new Date(),
    };

    const description = getActivityDescription(activity);
    expect(description).toContain('Awesome Games Studio');
    expect(description).toContain('updated');
  });

  it('returns correct description for LEAD_STAGE_CHANGED', () => {
    const activity: Activity = {
      id: 'test',
      type: 'LEAD_STAGE_CHANGED',
      leadId: 'lead-1',
      lead: mockStudioLead,
      timestamp: new Date(),
      data: { newStage: 'negotiation' },
    };

    const description = getActivityDescription(activity);
    expect(description).toContain('Awesome Games Studio');
    expect(description).toContain('negotiation');
  });

  it('handles missing lead gracefully', () => {
    const activity: Activity = {
      id: 'test',
      type: 'LEAD_CREATED',
      leadId: 'lead-1',
      timestamp: new Date(),
    };

    const description = getActivityDescription(activity);
    expect(description).toContain('Unknown lead');
  });
});

describe('getActivityIcon', () => {
  it('returns correct icon for LEAD_CREATED', () => {
    expect(getActivityIcon('LEAD_CREATED')).toBe('plus-circle');
  });

  it('returns correct icon for LEAD_UPDATED', () => {
    expect(getActivityIcon('LEAD_UPDATED')).toBe('edit');
  });

  it('returns correct icon for LEAD_STAGE_CHANGED', () => {
    expect(getActivityIcon('LEAD_STAGE_CHANGED')).toBe('arrow-right');
  });

  it('returns correct icon for NOTE_ADDED', () => {
    expect(getActivityIcon('NOTE_ADDED')).toBe('message-square');
  });
});
