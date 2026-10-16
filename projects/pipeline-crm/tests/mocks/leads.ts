import type { Lead } from '@/types/lead';
import type { Pipeline, PipelineStage } from '@/types/pipeline';

// Mock studio lead
export const mockStudioLead: Lead = {
  id: 'lead-1',
  type: 'studio',
  name: 'Awesome Games Studio',
  status: 'active',
  priority: 'high',
  owner: 'user-1',
  contact: {
    name: 'John Doe',
    role: 'CEO',
    email: 'john@awesomegames.com',
    phone: '+1-555-123-4567',
    linkedin: 'https://linkedin.com/in/johndoe',
  },
  website: 'https://awesomegames.com',
  country: 'USA',
  location: 'San Francisco, CA',
  tags: ['indie', 'mobile'],
  notes: 'Great potential partner',
  studio: {
    size: '50-100',
    type: 'indie',
    games: ['Game A', 'Game B'],
    focus: 'Mobile RPGs',
    fitScore: 85,
    fitReason: 'Strong mobile expertise',
  },
  pipeline: {
    pipelineId: 'pipeline-studios',
    stageId: 'contacted',
    enteredStageAt: new Date(),
  },
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-20'),
  createdBy: 'user-1',
};

// Mock investor lead
export const mockInvestorLead: Lead = {
  id: 'lead-2',
  type: 'investor',
  name: 'Gaming Ventures Capital',
  status: 'active',
  priority: 'medium',
  owner: 'user-1',
  contact: {
    name: 'Jane Smith',
    role: 'Partner',
    email: 'jane@gamingventures.com',
    phone: '+1-555-987-6543',
    linkedin: 'https://linkedin.com/in/janesmith',
  },
  website: 'https://gamingventures.com',
  country: 'USA',
  location: 'New York, NY',
  tags: ['vc', 'gaming'],
  notes: 'Interested in Series A',
  investor: {
    type: 'VC',
    founded: '2015',
    investmentFocus: 'Gaming & Entertainment',
    fundingPreferences: 'Series A, Series B',
    geographicalRegions: ['North America', 'Europe'],
    hqRegion: 'North America',
  },
  pipeline: {
    pipelineId: 'pipeline-investors',
    stageId: 'first-meeting',
    enteredStageAt: new Date(),
  },
  createdAt: new Date('2024-01-10'),
  updatedAt: new Date('2024-01-18'),
  createdBy: 'user-1',
};

// Mock leads array
export const mockLeads: Lead[] = [
  mockStudioLead,
  mockInvestorLead,
  {
    ...mockStudioLead,
    id: 'lead-3',
    name: 'Pixel Perfect Studios',
    priority: 'low',
    pipeline: {
      pipelineId: 'pipeline-studios',
      stageId: 'new-lead',
      enteredStageAt: new Date(),
    },
  },
  {
    ...mockInvestorLead,
    id: 'lead-4',
    name: 'Indie Fund Partners',
    priority: 'high',
    pipeline: {
      pipelineId: 'pipeline-investors',
      stageId: 'identified',
      enteredStageAt: new Date(),
    },
  },
];

// Mock studio pipeline stages
export const mockStudioStages: PipelineStage[] = [
  { id: 'new-lead', name: 'New Lead', color: 'gray', order: 0, isActive: true },
  { id: 'researched', name: 'Researched', color: 'blue', order: 1, isActive: true },
  { id: 'contacted', name: 'Contacted', color: 'yellow', order: 2, isActive: true },
  { id: 'meeting', name: 'Meeting', color: 'purple', order: 3, isActive: true },
  { id: 'proposal', name: 'Proposal', color: 'orange', order: 4, isActive: true },
  { id: 'negotiation', name: 'Negotiation', color: 'pink', order: 5, isActive: true },
  { id: 'won', name: 'Won', color: 'green', order: 6, isActive: true },
  { id: 'lost', name: 'Lost', color: 'red', order: 7, isActive: true },
];

// Mock investor pipeline stages
export const mockInvestorStages: PipelineStage[] = [
  { id: 'identified', name: 'Identified', color: 'gray', order: 0, isActive: true },
  { id: 'researched', name: 'Researched', color: 'blue', order: 1, isActive: true },
  { id: 'warm-intro', name: 'Warm Intro', color: 'yellow', order: 2, isActive: true },
  { id: 'first-meeting', name: 'First Meeting', color: 'purple', order: 3, isActive: true },
  { id: 'follow-up', name: 'Follow-up', color: 'orange', order: 4, isActive: true },
  { id: 'due-diligence', name: 'Due Diligence', color: 'pink', order: 5, isActive: true },
  { id: 'term-sheet', name: 'Term Sheet', color: 'indigo', order: 6, isActive: true },
  { id: 'closed', name: 'Closed', color: 'green', order: 7, isActive: true },
  { id: 'passed', name: 'Passed', color: 'red', order: 8, isActive: true },
];

// Mock pipelines
export const mockStudioPipeline: Pipeline = {
  id: 'pipeline-studios',
  name: 'Studios Pipeline',
  type: 'studio',
  stages: mockStudioStages,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockInvestorPipeline: Pipeline = {
  id: 'pipeline-investors',
  name: 'Investors Pipeline',
  type: 'investor',
  stages: mockInvestorStages,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockPipelines: Pipeline[] = [mockStudioPipeline, mockInvestorPipeline];
