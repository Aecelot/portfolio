/**
 * Pipeline stage utilities
 * Adapted from crm_custom/src/deals/stages.ts
 */

import type { Lead } from '@/types/lead';
import type { PipelineStage } from '@/types/pipeline';

export type LeadsByStage = Record<string, Lead[]>;

/**
 * Groups leads by their pipeline stage
 * @param leads - Array of leads to group
 * @param stages - Array of pipeline stages (defines order)
 * @returns Object with stage IDs as keys and arrays of leads as values
 */
export const getLeadsByStage = (
  leads: Lead[],
  stages: PipelineStage[]
): LeadsByStage => {
  if (!stages || stages.length === 0) return {};

  // Initialize empty arrays for each stage
  const leadsByStage: LeadsByStage = stages.reduce(
    (acc, stage) => ({ ...acc, [stage.id]: [] }),
    {} as LeadsByStage
  );

  // Group leads into their stages
  leads.forEach((lead) => {
    const stageId = lead.pipeline?.stageId;
    if (stageId && leadsByStage[stageId]) {
      leadsByStage[stageId].push(lead);
    } else if (stages.length > 0) {
      // If lead has no stage or invalid stage, put in first stage
      leadsByStage[stages[0].id].push(lead);
    }
  });

  // Sort leads within each stage by enteredStageAt (newest first) or createdAt
  stages.forEach((stage) => {
    leadsByStage[stage.id] = leadsByStage[stage.id].sort((a, b) => {
      const dateA = a.pipeline?.enteredStageAt?.toDate?.() ?? a.createdAt?.toDate?.() ?? new Date(0);
      const dateB = b.pipeline?.enteredStageAt?.toDate?.() ?? b.createdAt?.toDate?.() ?? new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  });

  return leadsByStage;
};

/**
 * Gets the count of leads per stage
 */
export const getLeadCountsByStage = (
  leads: Lead[],
  stages: PipelineStage[]
): Record<string, number> => {
  const leadsByStage = getLeadsByStage(leads, stages);
  return Object.entries(leadsByStage).reduce(
    (acc, [stageId, stageLeads]) => ({ ...acc, [stageId]: stageLeads.length }),
    {} as Record<string, number>
  );
};

/**
 * Gets the stage color class for Tailwind
 */
export const getStageColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return colorMap[color] || colorMap.gray;
};

/**
 * Gets the stage border color class for Tailwind
 */
export const getStageBorderColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    gray: 'border-gray-300 dark:border-gray-600',
    blue: 'border-blue-300 dark:border-blue-600',
    yellow: 'border-yellow-300 dark:border-yellow-600',
    orange: 'border-orange-300 dark:border-orange-600',
    purple: 'border-purple-300 dark:border-purple-600',
    indigo: 'border-indigo-300 dark:border-indigo-600',
    cyan: 'border-cyan-300 dark:border-cyan-600',
    green: 'border-green-300 dark:border-green-600',
    red: 'border-red-300 dark:border-red-600',
  };
  return colorMap[color] || colorMap.gray;
};
