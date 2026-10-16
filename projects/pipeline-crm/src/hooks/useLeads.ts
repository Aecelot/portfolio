import { useState, useEffect, useMemo } from 'react';
import { getLeadsRealtime, createLead, updateLead, deleteLead } from '@/lib/firestore';
import type { Lead, LeadFilters } from '@/types/lead';

export const useLeads = (filters?: LeadFilters) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize filter values to prevent unnecessary re-renders
  const filterType = filters?.type;
  const filterCategory = filters?.category;
  const filterStatus = filters?.status;
  const filterPriority = filters?.priority;
  const filterOwner = filters?.owner;
  const filterSearch = filters?.search;

  const stableFilters = useMemo(() => ({
    type: filterType,
    category: filterCategory,
    status: filterStatus,
    priority: filterPriority,
    owner: filterOwner,
    search: filterSearch,
  }), [filterType, filterCategory, filterStatus, filterPriority, filterOwner, filterSearch]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = getLeadsRealtime((leadsData) => {
      // Apply client-side search filter if provided
      let filteredLeads = leadsData;
      if (stableFilters.search) {
        const searchTerm = stableFilters.search.toLowerCase();
        filteredLeads = leadsData.filter(lead =>
          lead.name?.toLowerCase().includes(searchTerm) ||
          lead.contact?.name?.toLowerCase().includes(searchTerm) ||
          lead.contact?.email?.toLowerCase().includes(searchTerm) ||
          lead.website?.toLowerCase().includes(searchTerm)
        );
      }

      setLeads(filteredLeads);
      setLoading(false);
    }, stableFilters);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [stableFilters]);

  const addLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      const id = await createLead(leadData);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead');
      throw err;
    }
  };

  const editLead = async (id: string, data: Partial<Lead>) => {
    try {
      await updateLead(id, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lead');
      throw err;
    }
  };

  const removeLead = async (id: string) => {
    try {
      await deleteLead(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete lead');
      throw err;
    }
  };

  return {
    leads,
    loading,
    error,
    addLead,
    editLead,
    removeLead,
  };
};