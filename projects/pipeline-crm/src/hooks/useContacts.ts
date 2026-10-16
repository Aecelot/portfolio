import { useState, useEffect, useMemo } from 'react';
import {
  getContactsRealtime,
  createContact,
  updateContact,
  deleteContact,
  getLeadContactLinksForContact,
} from '@/lib/firestore';
import type { Contact, ContactFormData, ContactFilters, ContactWithMeta } from '@/types/contact';

export const useContacts = (filters?: ContactFilters) => {
  const [contacts, setContacts] = useState<ContactWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize filter values to prevent unnecessary re-renders
  const filterSearch = filters?.search;
  const filterTags = filters?.tags;
  const filterCompany = filters?.company;

  const stableFilters = useMemo(() => ({
    search: filterSearch,
    tags: filterTags,
    company: filterCompany,
  }), [filterSearch, filterTags, filterCompany]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = getContactsRealtime(async (contactsData) => {
      // Enrich contacts with linked leads count
      const enrichedContacts: ContactWithMeta[] = await Promise.all(
        contactsData.map(async (contact) => {
          try {
            const links = await getLeadContactLinksForContact(contact.id);
            return {
              ...contact,
              linkedLeadsCount: links.length,
            };
          } catch {
            return {
              ...contact,
              linkedLeadsCount: 0,
            };
          }
        })
      );

      setContacts(enrichedContacts);
      setLoading(false);
    }, stableFilters);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [stableFilters]);

  const addContact = async (contactData: ContactFormData): Promise<string> => {
    try {
      const id = await createContact(contactData);
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create contact';
      setError(errorMessage);
      throw err;
    }
  };

  const editContact = async (id: string, data: Partial<Contact>) => {
    try {
      await updateContact(id, data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update contact';
      setError(errorMessage);
      throw err;
    }
  };

  const removeContact = async (id: string) => {
    try {
      await deleteContact(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete contact';
      setError(errorMessage);
      throw err;
    }
  };

  return {
    contacts,
    loading,
    error,
    addContact,
    editContact,
    removeContact,
  };
};
