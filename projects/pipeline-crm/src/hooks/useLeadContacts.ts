import { useState, useEffect } from 'react';
import {
  getLeadContactLinksForLeadRealtime,
  getContact,
  createLeadContactLink,
  updateLeadContactLink,
  deleteLeadContactLink,
  setContactAsPrimary,
} from '@/lib/firestore';
import type { Contact } from '@/types/contact';
import type { LeadContactLink, LeadContactLinkFormData } from '@/types/contact';

export interface LinkedContact extends Contact {
  linkId: string;
  isPrimary: boolean;
  linkRole?: string;
}

export const useLeadContacts = (leadId: string) => {
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId) {
      setLinkedContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = getLeadContactLinksForLeadRealtime(leadId, async (links) => {
      try {
        // Fetch contact details for each link
        const contactsWithLinks: LinkedContact[] = [];

        for (const link of links) {
          const contact = await getContact(link.contactId);
          if (contact) {
            contactsWithLinks.push({
              ...contact,
              linkId: link.id,
              isPrimary: link.isPrimary,
              linkRole: link.role,
            });
          }
        }

        // Sort by primary first, then by name
        contactsWithLinks.sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) {
            return a.isPrimary ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        setLinkedContacts(contactsWithLinks);
        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load contacts';
        setError(errorMessage);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [leadId]);

  const linkContact = async (linkData: Omit<LeadContactLinkFormData, 'leadId'>) => {
    try {
      await createLeadContactLink({
        ...linkData,
        leadId,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link contact';
      setError(errorMessage);
      throw err;
    }
  };

  const unlinkContact = async (linkId: string) => {
    try {
      await deleteLeadContactLink(linkId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlink contact';
      setError(errorMessage);
      throw err;
    }
  };

  const updateLink = async (linkId: string, data: Partial<LeadContactLink>) => {
    try {
      await updateLeadContactLink(linkId, data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update contact link';
      setError(errorMessage);
      throw err;
    }
  };

  const setPrimary = async (linkId: string) => {
    try {
      await setContactAsPrimary(leadId, linkId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set primary contact';
      setError(errorMessage);
      throw err;
    }
  };

  return {
    linkedContacts,
    loading,
    error,
    linkContact,
    unlinkContact,
    updateLink,
    setPrimary,
  };
};
