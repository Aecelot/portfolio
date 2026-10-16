export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isActive: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  type: 'studio' | 'investor' | 'community' | 'competition';
  stages: PipelineStage[];
  createdAt: any;
  updatedAt: any;
}

export const DEFAULT_STUDIO_STAGES: Omit<PipelineStage, 'id'>[] = [
  { name: 'New Lead', color: 'gray', order: 1, isActive: true },
  { name: 'Researched', color: 'blue', order: 2, isActive: true },
  { name: 'Qualified Lead', color: 'cyan', order: 3, isActive: true },
  { name: 'Contacted', color: 'yellow', order: 4, isActive: true },
  { name: 'Meeting', color: 'orange', order: 5, isActive: true },
  { name: 'Proposal', color: 'purple', order: 6, isActive: true },
  { name: 'Negotiation', color: 'indigo', order: 7, isActive: true },
  { name: 'Won', color: 'green', order: 8, isActive: true },
  { name: 'Lost', color: 'red', order: 9, isActive: false },
];

export const DEFAULT_INVESTOR_STAGES: Omit<PipelineStage, 'id'>[] = [
  { name: 'Identified', color: 'gray', order: 1, isActive: true },
  { name: 'Researched', color: 'blue', order: 2, isActive: true },
  { name: 'Warm Intro', color: 'yellow', order: 3, isActive: true },
  { name: 'First Meeting', color: 'orange', order: 4, isActive: true },
  { name: 'Follow-up', color: 'purple', order: 5, isActive: true },
  { name: 'Due Diligence', color: 'indigo', order: 6, isActive: true },
  { name: 'Term Sheet', color: 'cyan', order: 7, isActive: true },
  { name: 'Closed', color: 'green', order: 8, isActive: true },
  { name: 'Passed', color: 'red', order: 9, isActive: false },
];

// Community/Channels pipeline - tracks relationship progression with communities
export const DEFAULT_COMMUNITY_STAGES: Omit<PipelineStage, 'id'>[] = [
  { name: 'Identified', color: 'gray', order: 1, isActive: true },
  { name: 'Researched', color: 'blue', order: 2, isActive: true },
  { name: 'Joined', color: 'cyan', order: 3, isActive: true },
  { name: 'Participating', color: 'yellow', order: 4, isActive: true },
  { name: 'Relationship Built', color: 'orange', order: 5, isActive: true },
  { name: 'Promotion Approved', color: 'purple', order: 6, isActive: true },
  { name: 'Active Channel', color: 'indigo', order: 7, isActive: true },
  { name: 'High-Performing', color: 'green', order: 8, isActive: true },
  { name: 'Inactive', color: 'red', order: 9, isActive: false },
];

// Competition pipeline - tracks competitive research and monitoring
export const DEFAULT_COMPETITION_STAGES: Omit<PipelineStage, 'id'>[] = [
  { name: 'New', color: 'gray', order: 1, isActive: true },
  { name: 'Researched', color: 'blue', order: 2, isActive: true },
  { name: 'Tracking', color: 'yellow', order: 3, isActive: true },
  { name: 'Outreach - Product A', color: 'red', order: 4, isActive: true },
  { name: 'Outreach - Product B', color: 'orange', order: 5, isActive: true },
];