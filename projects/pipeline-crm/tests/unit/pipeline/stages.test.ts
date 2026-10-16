import { describe, it, expect } from 'vitest';
import {
  getLeadsByStage,
  getLeadCountsByStage,
  getStageColorClass,
  getStageBorderColorClass,
} from '@/lib/stages';
import type { Lead } from '@/types/lead';
import type { PipelineStage } from '@/types/pipeline';

const mockStages: PipelineStage[] = [
  { id: 'stage-1', name: 'New Lead', color: 'gray', order: 1, isActive: true },
  { id: 'stage-2', name: 'Contacted', color: 'blue', order: 2, isActive: true },
  { id: 'stage-3', name: 'Meeting', color: 'yellow', order: 3, isActive: true },
];

const mockLeads: Lead[] = [
  {
    id: 'lead-1',
    type: 'studio',
    name: 'Studio A',
    status: 'active',
    priority: 'high',
    owner: 'user-1',
    contact: { name: 'John', email: 'john@a.com', role: 'CEO', phone: '', linkedin: '' },
    website: '',
    country: 'USA',
    location: 'LA',
    tags: [],
    notes: '',
    pipeline: { pipelineId: 'p1', stageId: 'stage-1', enteredStageAt: new Date() },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
    createdBy: 'user-1',
  },
  {
    id: 'lead-2',
    type: 'studio',
    name: 'Studio B',
    status: 'active',
    priority: 'medium',
    owner: 'user-1',
    contact: { name: 'Jane', email: 'jane@b.com', role: 'CTO', phone: '', linkedin: '' },
    website: '',
    country: 'UK',
    location: 'London',
    tags: [],
    notes: '',
    pipeline: { pipelineId: 'p1', stageId: 'stage-2', enteredStageAt: new Date() },
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date(),
    createdBy: 'user-1',
  },
  {
    id: 'lead-3',
    type: 'studio',
    name: 'Studio C',
    status: 'active',
    priority: 'low',
    owner: 'user-1',
    contact: { name: 'Bob', email: 'bob@c.com', role: 'PM', phone: '', linkedin: '' },
    website: '',
    country: 'USA',
    location: 'NY',
    tags: [],
    notes: '',
    pipeline: { pipelineId: 'p1', stageId: 'stage-1', enteredStageAt: new Date() },
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date(),
    createdBy: 'user-1',
  },
];

describe('getLeadsByStage', () => {
  it('groups leads by their pipeline stage', () => {
    const result = getLeadsByStage(mockLeads, mockStages);

    expect(result['stage-1']).toHaveLength(2);
    expect(result['stage-2']).toHaveLength(1);
    expect(result['stage-3']).toHaveLength(0);
  });

  it('returns empty object when no stages provided', () => {
    const result = getLeadsByStage(mockLeads, []);

    expect(result).toEqual({});
  });

  it('returns empty arrays for stages with no leads', () => {
    const result = getLeadsByStage([], mockStages);

    expect(result['stage-1']).toEqual([]);
    expect(result['stage-2']).toEqual([]);
    expect(result['stage-3']).toEqual([]);
  });

  it('puts leads with invalid stage in first stage', () => {
    const leadWithInvalidStage: Lead = {
      ...mockLeads[0],
      id: 'lead-invalid',
      pipeline: { pipelineId: 'p1', stageId: 'nonexistent', enteredStageAt: new Date() },
    };

    const result = getLeadsByStage([leadWithInvalidStage], mockStages);

    // Invalid stage leads go to first stage
    expect(result['stage-1']).toHaveLength(1);
    expect(result['stage-1'][0].id).toBe('lead-invalid');
  });

  it('puts leads with no pipeline.stageId in first stage', () => {
    const leadWithNoStage: Lead = {
      ...mockLeads[0],
      id: 'lead-no-stage',
      pipeline: { pipelineId: 'p1', stageId: '', enteredStageAt: new Date() },
    };

    const result = getLeadsByStage([leadWithNoStage], mockStages);

    expect(result['stage-1']).toHaveLength(1);
  });
});

describe('getLeadCountsByStage', () => {
  it('returns correct counts per stage', () => {
    const result = getLeadCountsByStage(mockLeads, mockStages);

    expect(result['stage-1']).toBe(2);
    expect(result['stage-2']).toBe(1);
    expect(result['stage-3']).toBe(0);
  });

  it('returns zeros when no leads', () => {
    const result = getLeadCountsByStage([], mockStages);

    expect(result['stage-1']).toBe(0);
    expect(result['stage-2']).toBe(0);
    expect(result['stage-3']).toBe(0);
  });
});

describe('getStageColorClass', () => {
  it('returns correct color class for each color', () => {
    expect(getStageColorClass('gray')).toContain('bg-gray');
    expect(getStageColorClass('blue')).toContain('bg-blue');
    expect(getStageColorClass('yellow')).toContain('bg-yellow');
    expect(getStageColorClass('green')).toContain('bg-green');
    expect(getStageColorClass('red')).toContain('bg-red');
    expect(getStageColorClass('purple')).toContain('bg-purple');
    expect(getStageColorClass('orange')).toContain('bg-orange');
    expect(getStageColorClass('indigo')).toContain('bg-indigo');
    expect(getStageColorClass('cyan')).toContain('bg-cyan');
  });

  it('returns gray for unknown color', () => {
    expect(getStageColorClass('unknown')).toContain('bg-gray');
  });
});

describe('getStageBorderColorClass', () => {
  it('returns correct border color class for each color', () => {
    expect(getStageBorderColorClass('gray')).toContain('border-gray');
    expect(getStageBorderColorClass('blue')).toContain('border-blue');
    expect(getStageBorderColorClass('yellow')).toContain('border-yellow');
    expect(getStageBorderColorClass('green')).toContain('border-green');
    expect(getStageBorderColorClass('red')).toContain('border-red');
  });

  it('returns gray border for unknown color', () => {
    expect(getStageBorderColorClass('unknown')).toContain('border-gray');
  });
});
