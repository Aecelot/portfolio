import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type { EmailSequence, SequenceFormData, LeadSequenceStatus, MergeFields } from '@/types';

export function useSequences() {
  const { user } = useAuth();
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setSequences([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'sequences'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sequenceList: EmailSequence[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as EmailSequence[];
        setSequences(sequenceList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching sequences:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const createSequence = useCallback(
    async (data: SequenceFormData) => {
      if (!user) throw new Error('Not authenticated');

      const docRef = await addDoc(collection(db, 'sequences'), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.uid,
      });

      return docRef.id;
    },
    [user]
  );

  const updateSequence = useCallback(
    async (id: string, data: Partial<SequenceFormData>) => {
      const docRef = doc(db, 'sequences', id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
      });
    },
    []
  );

  const deleteSequence = useCallback(async (id: string) => {
    // Check if any leads are using this sequence
    const activeLeads = await getDocs(
      query(
        collection(db, 'leadSequences'),
        where('sequenceId', '==', id),
        where('status', '==', 'active')
      )
    );

    if (!activeLeads.empty) {
      throw new Error('Cannot delete sequence with active leads');
    }

    await deleteDoc(doc(db, 'sequences', id));
  }, []);

  return {
    sequences,
    loading,
    error,
    createSequence,
    updateSequence,
    deleteSequence,
  };
}

export function useLeadSequence(leadId: string) {
  const [sequenceStatus, setSequenceStatus] = useState<LeadSequenceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'leadSequences'),
      where('leadId', '==', leadId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setSequenceStatus(null);
      } else {
        const doc = snapshot.docs[0];
        setSequenceStatus({
          id: doc.id,
          ...doc.data(),
        } as LeadSequenceStatus);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [leadId]);

  const startSequence = useCallback(
    async (
      sequenceId: string,
      sequenceName: string,
      recipientEmail: string,
      recipientName: string,
      mergeFields: MergeFields
    ) => {
      const firstSendDate = new Date();
      // Send first email in 1 hour (or adjust as needed)
      firstSendDate.setHours(firstSendDate.getHours() + 1);

      await addDoc(collection(db, 'leadSequences'), {
        leadId,
        sequenceId,
        sequenceName,
        currentStep: 1,
        status: 'active',
        startedAt: Timestamp.now(),
        nextSendAt: Timestamp.fromDate(firstSendDate),
        history: [],
        recipientEmail,
        recipientName,
        mergeFields,
      });
    },
    [leadId]
  );

  const pauseSequence = useCallback(async () => {
    if (!sequenceStatus) return;
    await updateDoc(doc(db, 'leadSequences', sequenceStatus.id), {
      status: 'paused',
      nextSendAt: null,
    });
  }, [sequenceStatus]);

  const resumeSequence = useCallback(async () => {
    if (!sequenceStatus) return;

    const nextSendDate = new Date();
    nextSendDate.setHours(nextSendDate.getHours() + 1);

    await updateDoc(doc(db, 'leadSequences', sequenceStatus.id), {
      status: 'active',
      nextSendAt: Timestamp.fromDate(nextSendDate),
    });
  }, [sequenceStatus]);

  const stopSequence = useCallback(async () => {
    if (!sequenceStatus) return;
    await deleteDoc(doc(db, 'leadSequences', sequenceStatus.id));
    setSequenceStatus(null);
  }, [sequenceStatus]);

  return {
    sequenceStatus,
    loading,
    startSequence,
    pauseSequence,
    resumeSequence,
    stopSequence,
  };
}
