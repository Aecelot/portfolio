import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FilterPreset, ColumnFilter, ColumnSort } from '@/types/filters';
import { useAuth } from '@/contexts/AuthContext';

const COLLECTION = 'filterPresets';

export const useFilterPresets = (pipelineType: 'studio' | 'investor' | 'community' | 'competition') => {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const q = query(
      collection(db, COLLECTION),
      where('pipelineType', '==', pipelineType),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const presetsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FilterPreset[];
        setPresets(presetsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching filter presets:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [pipelineType]);

  const savePreset = useCallback(
    async (
      name: string,
      filters: Record<string, ColumnFilter>,
      sorts: Record<string, ColumnSort>,
      stageId?: string
    ) => {
      if (!user) throw new Error('Not authenticated');

      // Flatten filters/sorts into preset format
      // For now, save the entire state
      const preset = {
        name,
        pipelineType,
        stageId: stageId || null,
        filters: stageId ? filters[stageId] || {} : filters,
        sort: stageId ? sorts[stageId] : undefined,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, COLLECTION), preset);
    },
    [pipelineType, user]
  );

  const updatePreset = useCallback(
    async (
      id: string,
      updates: Partial<Pick<FilterPreset, 'name' | 'filters' | 'sort'>>
    ) => {
      await updateDoc(doc(db, COLLECTION, id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    },
    []
  );

  const deletePreset = useCallback(async (id: string) => {
    await deleteDoc(doc(db, COLLECTION, id));
  }, []);

  return {
    presets,
    loading,
    error,
    savePreset,
    updatePreset,
    deletePreset,
  };
};
