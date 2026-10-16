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
  getDocs,
  where,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';
import type {
  NewsletterList,
  NewsletterListFormData,
  ComputedSubscriber,
} from '@/types/newsletter';
import type { Contact } from '@/types/contact';
import type { Lead } from '@/types/lead';

// Default lists to create on first load
const DEFAULT_LISTS: Omit<NewsletterListFormData, 'createdBy'>[] = [
  {
    name: 'Customer Newsletter',
    description: 'Newsletter for studios and potential customers',
    filterTags: [],
    filterLeadTypes: ['studio'],
    manualIncludes: [],
    manualExcludes: [],
  },
  {
    name: 'Investor Newsletter',
    description: 'Newsletter for investors and potential investors',
    filterTags: [],
    filterLeadTypes: ['investor'],
    manualIncludes: [],
    manualExcludes: [],
  },
];

export function useNewsletterLists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<NewsletterList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Create default lists if they don't exist
  const initializeDefaultLists = useCallback(async () => {
    if (!user || initialized) return;

    const existingLists = await getDocs(collection(db, 'newsletterLists'));

    if (existingLists.empty) {
      // Create default lists with predefined IDs for consistency
      for (let i = 0; i < DEFAULT_LISTS.length; i++) {
        const listData = DEFAULT_LISTS[i];
        const listId = i === 0 ? 'customer-newsletter' : 'investor-newsletter';
        await setDoc(doc(db, 'newsletterLists', listId), {
          ...listData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user.uid,
        });
      }
    }

    setInitialized(true);
  }, [user, initialized]);

  useEffect(() => {
    if (!user) {
      setLists([]);
      setLoading(false);
      return;
    }

    // Initialize default lists first
    initializeDefaultLists();

    const q = query(
      collection(db, 'newsletterLists'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const listData: NewsletterList[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as NewsletterList[];
        setLists(listData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching newsletter lists:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, initializeDefaultLists]);

  const createList = useCallback(
    async (data: NewsletterListFormData) => {
      if (!user) throw new Error('Not authenticated');

      const docRef = await addDoc(collection(db, 'newsletterLists'), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.uid,
      });

      return docRef.id;
    },
    [user]
  );

  const updateList = useCallback(
    async (id: string, data: Partial<NewsletterListFormData>) => {
      const docRef = doc(db, 'newsletterLists', id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
      });
    },
    []
  );

  const deleteList = useCallback(async (id: string) => {
    // Check if any newsletters use this list
    const newsletters = await getDocs(
      query(
        collection(db, 'newsletters'),
        where('listId', '==', id)
      )
    );

    if (!newsletters.empty) {
      throw new Error('Cannot delete list with existing newsletters');
    }

    await deleteDoc(doc(db, 'newsletterLists', id));
  }, []);

  // Add contact manually to a list
  const addContactToList = useCallback(
    async (listId: string, contactId: string) => {
      const list = lists.find(l => l.id === listId);
      if (!list) throw new Error('List not found');

      const newManualIncludes = [...(list.manualIncludes || [])];
      if (!newManualIncludes.includes(contactId)) {
        newManualIncludes.push(contactId);
      }

      // Also remove from excludes if present
      const newManualExcludes = (list.manualExcludes || []).filter(
        id => id !== contactId
      );

      await updateList(listId, {
        manualIncludes: newManualIncludes,
        manualExcludes: newManualExcludes,
      });
    },
    [lists, updateList]
  );

  // Remove contact manually from a list
  const removeContactFromList = useCallback(
    async (listId: string, contactId: string) => {
      const list = lists.find(l => l.id === listId);
      if (!list) throw new Error('List not found');

      // Remove from manual includes
      const newManualIncludes = (list.manualIncludes || []).filter(
        id => id !== contactId
      );

      // Add to manual excludes
      const newManualExcludes = [...(list.manualExcludes || [])];
      if (!newManualExcludes.includes(contactId)) {
        newManualExcludes.push(contactId);
      }

      await updateList(listId, {
        manualIncludes: newManualIncludes,
        manualExcludes: newManualExcludes,
      });
    },
    [lists, updateList]
  );

  return {
    lists,
    loading,
    error,
    createList,
    updateList,
    deleteList,
    addContactToList,
    removeContactFromList,
  };
}

// Hook to compute subscribers for a specific list
export function useListSubscribers(listId: string | null) {
  const [subscribers, setSubscribers] = useState<ComputedSubscriber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!listId) {
      setSubscribers([]);
      setLoading(false);
      return;
    }

    const computeSubscribers = async () => {
      setLoading(true);
      try {
        // Get the list configuration
        const listSnap = await getDocs(
          query(collection(db, 'newsletterLists'), where('__name__', '==', listId))
        );

        if (listSnap.empty) {
          setSubscribers([]);
          setLoading(false);
          return;
        }

        const list = listSnap.docs[0].data() as NewsletterList;

        // Get all contacts
        const contactsSnap = await getDocs(collection(db, 'contacts'));
        const contacts = contactsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Contact[];

        // Get all leads for lead type filtering
        const leadsSnap = await getDocs(collection(db, 'leads'));
        const leads = leadsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Lead[];

        // Build subscriber list
        const subscriberMap = new Map<string, ComputedSubscriber>();

        // 1. Add contacts matching tags
        if (list.filterTags && list.filterTags.length > 0) {
          for (const contact of contacts) {
            if (contact.tags?.some(tag => list.filterTags.includes(tag))) {
              if (contact.email) {
                subscriberMap.set(contact.id, {
                  contactId: contact.id,
                  email: contact.email,
                  name: contact.name,
                  company: contact.company,
                  source: 'tag',
                });
              }
            }
          }
        }

        // 2. Add contacts from leads matching lead types
        if (list.filterLeadTypes && list.filterLeadTypes.length > 0) {
          for (const lead of leads) {
            if (list.filterLeadTypes.includes(lead.type) && lead.contact?.email) {
              // Find matching contact or use lead contact info
              const matchingContact = contacts.find(
                c => c.email?.toLowerCase() === lead.contact.email?.toLowerCase()
              );

              const contactId = matchingContact?.id || `lead-${lead.id}`;

              if (!subscriberMap.has(contactId)) {
                subscriberMap.set(contactId, {
                  contactId,
                  email: lead.contact.email,
                  name: lead.contact.name || lead.name,
                  company: lead.name,
                  source: 'leadType',
                });
              }
            }
          }
        }

        // 3. Add manual includes
        if (list.manualIncludes && list.manualIncludes.length > 0) {
          for (const contactId of list.manualIncludes) {
            const contact = contacts.find(c => c.id === contactId);
            if (contact?.email && !subscriberMap.has(contactId)) {
              subscriberMap.set(contactId, {
                contactId: contact.id,
                email: contact.email,
                name: contact.name,
                company: contact.company,
                source: 'manual',
              });
            }
          }
        }

        // 4. Remove manual excludes
        if (list.manualExcludes) {
          for (const contactId of list.manualExcludes) {
            subscriberMap.delete(contactId);
          }
        }

        // 5. Remove unsubscribed contacts
        for (const contact of contacts) {
          if (contact.unsubscribedFrom?.includes(listId)) {
            subscriberMap.delete(contact.id);
          }
        }

        // Filter out entries without valid emails
        const finalSubscribers = Array.from(subscriberMap.values()).filter(
          s => s.email && s.email.includes('@')
        );

        setSubscribers(finalSubscribers);
      } catch (err) {
        console.error('Error computing subscribers:', err);
        setSubscribers([]);
      }
      setLoading(false);
    };

    computeSubscribers();
  }, [listId]);

  return { subscribers, loading };
}
