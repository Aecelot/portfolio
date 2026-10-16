import { useState, useEffect } from 'react';
import { getPipelinesRealtime, updateLeadStage } from '@/lib/firestore';
import type { Pipeline } from '@/types/pipeline';

export const usePipeline = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = getPipelinesRealtime((pipelinesData) => {
      setPipelines(pipelinesData);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const getStudioPipeline = () => {
    return pipelines.find(p => p.type === 'studio');
  };

  const getInvestorPipeline = () => {
    return pipelines.find(p => p.type === 'investor');
  };

  const getCommunityPipeline = () => {
    return pipelines.find(p => p.type === 'community');
  };

  const moveLeadToStage = async (leadId: string, stageId: string) => {
    try {
      await updateLeadStage(leadId, stageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move lead');
      throw err;
    }
  };

  return {
    pipelines,
    loading,
    error,
    getStudioPipeline,
    getInvestorPipeline,
    getCommunityPipeline,
    moveLeadToStage,
  };
};