import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { getActivitiesForLeadRealtime, createActivity } from '@/lib/firestore';
import type { Activity, ActivityFormData, ActivityType, ActivityChange } from '@/types/activity';

export const useActivities = (leadId: string) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = getActivitiesForLeadRealtime(leadId, (activitiesData) => {
      setActivities(activitiesData);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [leadId]);

  return {
    activities,
    loading,
    error,
  };
};

// Helper hook for logging activities
export const useActivityLogger = () => {
  const { user } = useAuth();

  const logActivity = async (
    leadId: string,
    type: ActivityType,
    description: string,
    changes?: ActivityChange[]
  ) => {
    if (!user) return;

    const activityData: ActivityFormData = {
      leadId,
      type,
      description,
      changes,
      userId: user.uid,
      userEmail: user.email || 'Unknown',
    };

    try {
      await createActivity(activityData);
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const logLeadCreated = async (leadId: string, leadName: string) => {
    await logActivity(leadId, 'lead_created', `Created lead "${leadName}"`);
  };

  const logLeadUpdated = async (
    leadId: string,
    leadName: string,
    changes: ActivityChange[]
  ) => {
    const fieldNames = changes.map(c => c.field).join(', ');
    await logActivity(
      leadId,
      'lead_updated',
      `Updated ${fieldNames} for "${leadName}"`,
      changes
    );
  };

  const logStageChanged = async (
    leadId: string,
    leadName: string,
    fromStage: string,
    toStage: string
  ) => {
    await logActivity(
      leadId,
      'stage_changed',
      `Moved "${leadName}" from ${fromStage} to ${toStage}`,
      [{ field: 'stage', from: fromStage, to: toStage }]
    );
  };

  const logNoteAdded = async (leadId: string, leadName: string) => {
    await logActivity(leadId, 'note_added', `Added note to "${leadName}"`);
  };

  const logNoteUpdated = async (leadId: string, leadName: string) => {
    await logActivity(leadId, 'note_updated', `Updated note on "${leadName}"`);
  };

  const logNoteDeleted = async (leadId: string, leadName: string) => {
    await logActivity(leadId, 'note_deleted', `Deleted note from "${leadName}"`);
  };

  return {
    logActivity,
    logLeadCreated,
    logLeadUpdated,
    logStageChanged,
    logNoteAdded,
    logNoteUpdated,
    logNoteDeleted,
  };
};
