import { useCallback } from 'react';
import { useLeads } from './useLeads';
import { findDuplicates, type DuplicateMatch } from '@/lib/duplicateDetection';
import type { Lead } from '@/types/lead';

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: DuplicateMatch[];
}

/**
 * Hook for checking duplicate leads before creation
 */
export const useDuplicateDetection = () => {
  const { leads } = useLeads();

  const checkForDuplicates = useCallback(
    (newLead: Partial<Lead>): DuplicateCheckResult => {
      const duplicates = findDuplicates(newLead, leads);

      return {
        hasDuplicates: duplicates.length > 0,
        duplicates,
      };
    },
    [leads]
  );

  return { checkForDuplicates };
};
