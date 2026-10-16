import { useMemo } from 'react';
import { useLeads } from './useLeads';
import type { ActivityType } from '@/types/activity';
import type { Timestamp } from 'firebase/firestore';

// Interface for derived activities (from leads, not from Firestore)
interface DerivedActivity {
  id: string;
  leadId: string;
  type: ActivityType;
  description: string;
  userId: string;
  userEmail: string;
  createdAt: Date;
  leadName?: string;
  leadType?: string;
  stageId?: string;
}

/**
 * Derives activities from leads based on their timestamps.
 * This is a simplified approach that doesn't require a separate activity collection.
 * Used for the dashboard activity feed.
 */
export const useActivity = (limit: number = 50) => {
  const { leads, loading, error } = useLeads();

  const activities = useMemo(() => {
    if (!leads.length) return [];

    const activityList: DerivedActivity[] = [];

    // Generate activities from leads
    leads.forEach((lead) => {
      // Lead created activity
      if (lead.createdAt) {
        const createdAt = lead.createdAt instanceof Date
          ? lead.createdAt
          : (lead.createdAt as Timestamp)?.toDate?.() ?? new Date();

        activityList.push({
          id: `lead_created.${lead.id}.${createdAt.getTime()}`,
          type: 'lead_created',
          leadId: lead.id,
          leadName: lead.name,
          leadType: lead.type,
          userId: lead.createdBy || '',
          userEmail: '',
          description: `${lead.name} was added as a new ${lead.type ?? 'lead'}`,
          createdAt,
        });
      }

      // Lead updated activity (only if different from created)
      if (lead.updatedAt && lead.createdAt) {
        const updatedAt = lead.updatedAt instanceof Date
          ? lead.updatedAt
          : (lead.updatedAt as Timestamp)?.toDate?.() ?? new Date();
        const createdAt = lead.createdAt instanceof Date
          ? lead.createdAt
          : (lead.createdAt as Timestamp)?.toDate?.() ?? new Date();

        // Only add update activity if it's significantly different from create (more than 1 minute)
        if (updatedAt.getTime() - createdAt.getTime() > 60000) {
          activityList.push({
            id: `lead_updated.${lead.id}.${updatedAt.getTime()}`,
            type: 'lead_updated',
            leadId: lead.id,
            leadName: lead.name,
            leadType: lead.type,
            userId: '',
            userEmail: '',
            description: `${lead.name} was updated`,
            createdAt: updatedAt,
          });
        }
      }

      // Stage change activity
      if (lead.pipeline?.enteredStageAt) {
        const enteredStageAt = lead.pipeline.enteredStageAt instanceof Date
          ? lead.pipeline.enteredStageAt
          : (lead.pipeline.enteredStageAt as Timestamp)?.toDate?.() ?? new Date();

        activityList.push({
          id: `stage_changed.${lead.id}.${enteredStageAt.getTime()}`,
          type: 'stage_changed',
          leadId: lead.id,
          leadName: lead.name,
          leadType: lead.type,
          stageId: lead.pipeline.stageId,
          userId: '',
          userEmail: '',
          description: `${lead.name} moved to ${lead.pipeline.stageId ?? 'a new stage'}`,
          createdAt: enteredStageAt,
        });
      }
    });

    // Sort by timestamp descending and limit
    return activityList
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }, [leads, limit]);

  return {
    activities,
    loading,
    error,
  };
};

/**
 * Get icon name for an activity type
 */
export const getActivityIcon = (type: ActivityType): string => {
  switch (type) {
    case 'lead_created':
      return 'plus-circle';
    case 'lead_updated':
      return 'edit';
    case 'stage_changed':
      return 'arrow-right';
    case 'note_added':
      return 'message-square';
    default:
      return 'activity';
  }
};
