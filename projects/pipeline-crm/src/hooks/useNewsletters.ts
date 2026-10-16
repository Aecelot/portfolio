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
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type {
  Newsletter,
  NewsletterFormData,
  NewsletterStats,
  NewsletterRecipient,
} from '@/types/newsletter';

const DEFAULT_STATS: NewsletterStats = {
  total: 0,
  sent: 0,
  opened: 0,
  clicked: 0,
  unsubscribed: 0,
};

export function useNewsletters(listId?: string) {
  const { user } = useAuth();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setNewsletters([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, 'newsletters'),
      orderBy('createdAt', 'desc')
    );

    // Filter by listId if provided
    if (listId) {
      q = query(
        collection(db, 'newsletters'),
        where('listId', '==', listId),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newsletterList: Newsletter[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Newsletter[];
        setNewsletters(newsletterList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching newsletters:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, listId]);

  const createNewsletter = useCallback(
    async (data: NewsletterFormData) => {
      if (!user) throw new Error('Not authenticated');

      const docRef = await addDoc(collection(db, 'newsletters'), {
        ...data,
        status: 'draft',
        sentAt: null,
        stats: DEFAULT_STATS,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.uid,
      });

      return docRef.id;
    },
    [user]
  );

  const updateNewsletter = useCallback(
    async (id: string, data: Partial<NewsletterFormData>) => {
      const docRef = doc(db, 'newsletters', id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
      });
    },
    []
  );

  const deleteNewsletter = useCallback(async (id: string) => {
    // Only allow deleting drafts
    const newsletterDoc = await getDoc(doc(db, 'newsletters', id));
    if (newsletterDoc.exists()) {
      const data = newsletterDoc.data() as Newsletter;
      if (data.status !== 'draft') {
        throw new Error('Can only delete draft newsletters');
      }
    }

    // Delete associated recipients
    const recipients = await getDocs(
      query(
        collection(db, 'newsletterRecipients'),
        where('newsletterId', '==', id)
      )
    );

    for (const recipientDoc of recipients.docs) {
      await deleteDoc(recipientDoc.ref);
    }

    await deleteDoc(doc(db, 'newsletters', id));
  }, []);

  // Trigger newsletter sending via Cloud Function
  const sendNewsletter = useCallback(
    async (newsletterId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Update newsletter status to sending
      await updateDoc(doc(db, 'newsletters', newsletterId), {
        status: 'sending',
        updatedAt: Timestamp.now(),
      });

      // Create send request to trigger Cloud Function
      await addDoc(collection(db, 'newsletterSendRequests'), {
        newsletterId,
        status: 'pending',
        createdAt: Timestamp.now(),
        createdBy: user.uid,
      });
    },
    [user]
  );

  return {
    newsletters,
    loading,
    error,
    createNewsletter,
    updateNewsletter,
    deleteNewsletter,
    sendNewsletter,
  };
}

// Hook to get a single newsletter with its recipients
export function useNewsletter(newsletterId: string | null) {
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [recipients, setRecipients] = useState<NewsletterRecipient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!newsletterId) {
      setNewsletter(null);
      setRecipients([]);
      setLoading(false);
      return;
    }

    // Listen to newsletter
    const unsubNewsletter = onSnapshot(
      doc(db, 'newsletters', newsletterId),
      (snap) => {
        if (snap.exists()) {
          setNewsletter({
            id: snap.id,
            ...snap.data(),
          } as Newsletter);
        } else {
          setNewsletter(null);
        }
        setLoading(false);
      }
    );

    // Listen to recipients
    const recipientsQuery = query(
      collection(db, 'newsletterRecipients'),
      where('newsletterId', '==', newsletterId)
    );

    const unsubRecipients = onSnapshot(recipientsQuery, (snap) => {
      const recipientList: NewsletterRecipient[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as NewsletterRecipient[];
      setRecipients(recipientList);
    });

    return () => {
      unsubNewsletter();
      unsubRecipients();
    };
  }, [newsletterId]);

  return { newsletter, recipients, loading };
}
