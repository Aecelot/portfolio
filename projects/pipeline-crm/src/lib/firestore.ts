import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Lead, LeadFilters } from '../types/lead';
import type { Note, NoteFormData } from '../types/note';
import type { Pipeline } from '../types/pipeline';
import type { Tag } from '../types/tag';
import type { Activity, ActivityFormData } from '../types/activity';
import type { Contact, ContactFormData, LeadContactLink, LeadContactLinkFormData, ContactFilters } from '../types/contact';
import type { Task, TaskFormData, TaskFilters } from '../types/task';

// Collections
const LEADS_COLLECTION = 'leads';
const NOTES_COLLECTION = 'notes';
const PIPELINES_COLLECTION = 'pipelines';
const TAGS_COLLECTION = 'tags';
const ACTIVITIES_COLLECTION = 'activities';
const CONTACTS_COLLECTION = 'contacts';
const TASKS_COLLECTION = 'tasks';
const LEAD_CONTACTS_COLLECTION = 'leadContacts';

// Lead operations
export const getLeads = (filters?: LeadFilters) => {
  let q = query(collection(db, LEADS_COLLECTION), orderBy('createdAt', 'desc'));
  
  if (filters) {
    if (filters.type) {
      q = query(q, where('type', '==', filters.type));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.priority && filters.priority !== 'none') {
      q = query(q, where('priority', '==', filters.priority));
    }
    if (filters.owner) {
      q = query(q, where('owner', '==', filters.owner));
    }
  }
  
  return getDocs(q);
};

export const getLeadsRealtime = (
  callback: (leads: Lead[]) => void,
  filters?: LeadFilters
) => {
  // Build query - only use simple filters to avoid index requirements
  let q;

  if (filters?.type) {
    q = query(collection(db, LEADS_COLLECTION), where('type', '==', filters.type));
  } else {
    q = query(collection(db, LEADS_COLLECTION));
  }

  return onSnapshot(q, (snapshot) => {
    console.log(`[Firestore] Fetched ${snapshot.docs.length} leads`);
    let leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Lead[];

    // Apply additional filters client-side
    if (filters) {
      if (filters.status) {
        leads = leads.filter(lead => lead.status === filters.status);
      }
      if (filters.priority && filters.priority !== 'none') {
        leads = leads.filter(lead => lead.priority === filters.priority);
      }
      if (filters.owner) {
        leads = leads.filter(lead => lead.owner === filters.owner);
      }
      if (filters.category) {
        leads = leads.filter(lead => (lead.category || 'prospect') === filters.category);
      }
    }

    // Sort by createdAt client-side
    leads.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() ?? new Date(0);
      const dateB = b.createdAt?.toDate?.() ?? new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`[Firestore] Returning ${leads.length} leads after filters`);
    callback(leads);
  }, (error) => {
    console.error('[Firestore] Leads fetch error:', error.message, error.code);
    callback([]);
  });
};

export const getLead = async (id: string): Promise<Lead | null> => {
  const docRef = doc(db, LEADS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Lead;
  }
  return null;
};

export const getLeadRealtime = (
  id: string,
  callback: (lead: Lead | null) => void
) => {
  const docRef = doc(db, LEADS_COLLECTION, id);
  
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const lead = { id: snapshot.id, ...snapshot.data() } as Lead;
      callback(lead);
    } else {
      callback(null);
    }
  });
};

export const createLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, LEADS_COLLECTION), {
    ...leadData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateLead = async (id: string, data: Partial<Lead>) => {
  const docRef = doc(db, LEADS_COLLECTION, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteLead = async (id: string) => {
  const docRef = doc(db, LEADS_COLLECTION, id);
  await deleteDoc(docRef);
};

export const updateLeadStage = async (id: string, stageId: string) => {
  const docRef = doc(db, LEADS_COLLECTION, id);
  await updateDoc(docRef, {
    'pipeline.stageId': stageId,
    'pipeline.enteredStageAt': serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// Note operations
export const getNotesForLead = async (leadId: string): Promise<Note[]> => {
  const q = query(
    collection(db, NOTES_COLLECTION),
    where('leadId', '==', leadId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Note[];
};

export const getNotesForLeadRealtime = (
  leadId: string,
  callback: (notes: Note[]) => void
) => {
  const q = query(
    collection(db, NOTES_COLLECTION),
    where('leadId', '==', leadId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const notes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Note[];
    callback(notes);
  });
};

export const createNote = async (noteData: NoteFormData): Promise<string> => {
  const docRef = await addDoc(collection(db, NOTES_COLLECTION), {
    ...noteData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateNote = async (id: string, data: Partial<Note>): Promise<void> => {
  const docRef = doc(db, NOTES_COLLECTION, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteNote = async (id: string): Promise<void> => {
  const docRef = doc(db, NOTES_COLLECTION, id);
  await deleteDoc(docRef);
};

// Pipeline operations
export const getPipelines = async () => {
  const snapshot = await getDocs(collection(db, PIPELINES_COLLECTION));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Pipeline[];
};

export const getPipelinesRealtime = (callback: (pipelines: Pipeline[]) => void) => {
  return onSnapshot(collection(db, PIPELINES_COLLECTION), (snapshot) => {
    const pipelines = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Pipeline[];
    callback(pipelines);
  }, (error) => {
    console.error('Pipeline fetch error:', error);
    callback([]);
  });
};

export const createPipeline = async (pipeline: Omit<Pipeline, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, PIPELINES_COLLECTION), {
    ...pipeline,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

// Initialize default pipelines
export const initializeDefaultPipelines = async () => {
  const batch = writeBatch(db);
  
  // Studio pipeline
  const studioRef = doc(collection(db, PIPELINES_COLLECTION));
  batch.set(studioRef, {
    name: 'Studio Pipeline',
    type: 'studio',
    stages: [
      { id: 'new-lead', name: 'New Lead', color: 'gray', order: 1, isActive: true },
      { id: 'researched', name: 'Researched', color: 'blue', order: 2, isActive: true },
      { id: 'qualified-lead', name: 'Qualified Lead', color: 'cyan', order: 3, isActive: true },
      { id: 'contacted', name: 'Contacted', color: 'yellow', order: 4, isActive: true },
      { id: 'meeting', name: 'Meeting', color: 'orange', order: 5, isActive: true },
      { id: 'proposal', name: 'Proposal', color: 'purple', order: 6, isActive: true },
      { id: 'negotiation', name: 'Negotiation', color: 'indigo', order: 7, isActive: true },
      { id: 'won', name: 'Won', color: 'green', order: 8, isActive: true },
      { id: 'lost', name: 'Lost', color: 'red', order: 9, isActive: false },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  // Investor pipeline
  const investorRef = doc(collection(db, PIPELINES_COLLECTION));
  batch.set(investorRef, {
    name: 'Investor Pipeline',
    type: 'investor',
    stages: [
      { id: 'identified', name: 'Identified', color: 'gray', order: 1, isActive: true },
      { id: 'researched', name: 'Researched', color: 'blue', order: 2, isActive: true },
      { id: 'warm-intro', name: 'Warm Intro', color: 'yellow', order: 3, isActive: true },
      { id: 'first-meeting', name: 'First Meeting', color: 'orange', order: 4, isActive: true },
      { id: 'follow-up', name: 'Follow-up', color: 'purple', order: 5, isActive: true },
      { id: 'due-diligence', name: 'Due Diligence', color: 'indigo', order: 6, isActive: true },
      { id: 'term-sheet', name: 'Term Sheet', color: 'cyan', order: 7, isActive: true },
      { id: 'closed', name: 'Closed', color: 'green', order: 8, isActive: true },
      { id: 'passed', name: 'Passed', color: 'red', order: 9, isActive: false },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Community/Channels pipeline - tracks relationship progression with communities
  const communityRef = doc(collection(db, PIPELINES_COLLECTION));
  batch.set(communityRef, {
    name: 'Channels Pipeline',
    type: 'community',
    stages: [
      { id: 'identified', name: 'Identified', color: 'gray', order: 1, isActive: true },
      { id: 'researched', name: 'Researched', color: 'blue', order: 2, isActive: true },
      { id: 'joined', name: 'Joined', color: 'cyan', order: 3, isActive: true },
      { id: 'participating', name: 'Participating', color: 'yellow', order: 4, isActive: true },
      { id: 'relationship-built', name: 'Relationship Built', color: 'orange', order: 5, isActive: true },
      { id: 'promotion-approved', name: 'Promotion Approved', color: 'purple', order: 6, isActive: true },
      { id: 'active-channel', name: 'Active Channel', color: 'indigo', order: 7, isActive: true },
      { id: 'high-performing', name: 'High-Performing', color: 'green', order: 8, isActive: true },
      { id: 'inactive', name: 'Inactive', color: 'red', order: 9, isActive: false },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Competition pipeline - tracks competitive research and monitoring
  const competitionRef = doc(collection(db, PIPELINES_COLLECTION));
  batch.set(competitionRef, {
    name: 'Competition Pipeline',
    type: 'competition',
    stages: [
      { id: 'new', name: 'New', color: 'gray', order: 1, isActive: true },
      { id: 'researched', name: 'Researched', color: 'blue', order: 2, isActive: true },
      { id: 'tracking', name: 'Tracking', color: 'yellow', order: 3, isActive: true },
      { id: 'outreach-product-a', name: 'Outreach - Product A', color: 'red', order: 4, isActive: true },
      { id: 'outreach-product-b', name: 'Outreach - Product B', color: 'orange', order: 5, isActive: true },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return [studioRef.id, investorRef.id, communityRef.id, competitionRef.id];
};

// Tag operations
export const getTagsRealtime = (callback: (tags: Tag[]) => void) => {
  const q = query(collection(db, TAGS_COLLECTION), orderBy('name'));
  return onSnapshot(q, (snapshot) => {
    const tags = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Tag[];
    callback(tags);
  }, (error) => {
    console.error('Tags fetch error:', error);
    callback([]);
  });
};

export const createTag = async (tagData: Omit<Tag, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, TAGS_COLLECTION), {
    ...tagData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateTag = async (id: string, data: Partial<Tag>): Promise<void> => {
  const docRef = doc(db, TAGS_COLLECTION, id);
  await updateDoc(docRef, data);
};

export const deleteTag = async (id: string): Promise<void> => {
  const docRef = doc(db, TAGS_COLLECTION, id);
  await deleteDoc(docRef);
};

// Activity operations
export const getActivitiesForLeadRealtime = (
  leadId: string,
  callback: (activities: Activity[]) => void
) => {
  const q = query(
    collection(db, ACTIVITIES_COLLECTION),
    where('leadId', '==', leadId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Activity[];
    callback(activities);
  }, (error) => {
    console.error('Activities fetch error:', error);
    callback([]);
  });
};

export const createActivity = async (activityData: ActivityFormData): Promise<string> => {
  const docRef = await addDoc(collection(db, ACTIVITIES_COLLECTION), {
    ...activityData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const deleteActivitiesForLead = async (leadId: string): Promise<void> => {
  const q = query(
    collection(db, ACTIVITIES_COLLECTION),
    where('leadId', '==', leadId)
  );
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
};

// Migration: Add createdBy field to existing leads
export const migrateLeadsWithCreatedBy = async (userId: string): Promise<{ updated: number; skipped: number }> => {
  const snapshot = await getDocs(collection(db, LEADS_COLLECTION));
  let updated = 0;
  let skipped = 0;

  const batch = writeBatch(db);

  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (!data.createdBy) {
      batch.update(docSnap.ref, { createdBy: userId });
      updated++;
    } else {
      skipped++;
    }
  });

  if (updated > 0) {
    await batch.commit();
  }

  return { updated, skipped };
};

// Contact operations
export const getContactsRealtime = (
  callback: (contacts: Contact[]) => void,
  filters?: ContactFilters
) => {
  const q = query(collection(db, CONTACTS_COLLECTION));

  return onSnapshot(q, (snapshot) => {
    let contacts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Contact[];

    // Apply filters client-side
    if (filters) {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        contacts = contacts.filter(contact =>
          contact.name.toLowerCase().includes(searchLower) ||
          contact.email.toLowerCase().includes(searchLower) ||
          contact.company?.toLowerCase().includes(searchLower) ||
          contact.role?.toLowerCase().includes(searchLower)
        );
      }
      if (filters.tags && filters.tags.length > 0) {
        contacts = contacts.filter(contact =>
          contact.tags?.some(tag => filters.tags!.includes(tag))
        );
      }
      if (filters.company) {
        contacts = contacts.filter(contact =>
          contact.company?.toLowerCase().includes(filters.company!.toLowerCase())
        );
      }
    }

    // Sort by name
    contacts.sort((a, b) => a.name.localeCompare(b.name));

    callback(contacts);
  }, (error) => {
    console.error('Contacts fetch error:', error);
    callback([]);
  });
};

export const getContact = async (id: string): Promise<Contact | null> => {
  const docRef = doc(db, CONTACTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Contact;
  }
  return null;
};

export const createContact = async (contactData: ContactFormData): Promise<string> => {
  const docRef = await addDoc(collection(db, CONTACTS_COLLECTION), {
    ...contactData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateContact = async (id: string, data: Partial<Contact>): Promise<void> => {
  const docRef = doc(db, CONTACTS_COLLECTION, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteContact = async (id: string): Promise<void> => {
  // First delete all lead-contact links for this contact
  const linksQuery = query(
    collection(db, LEAD_CONTACTS_COLLECTION),
    where('contactId', '==', id)
  );
  const linksSnapshot = await getDocs(linksQuery);

  const batch = writeBatch(db);
  linksSnapshot.docs.forEach(linkDoc => {
    batch.delete(linkDoc.ref);
  });

  // Delete the contact itself
  const docRef = doc(db, CONTACTS_COLLECTION, id);
  batch.delete(docRef);

  await batch.commit();
};

// Lead-Contact link operations
export const getLeadContactLinksForLead = async (leadId: string): Promise<LeadContactLink[]> => {
  const q = query(
    collection(db, LEAD_CONTACTS_COLLECTION),
    where('leadId', '==', leadId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as LeadContactLink[];
};

export const getLeadContactLinksForLeadRealtime = (
  leadId: string,
  callback: (links: LeadContactLink[]) => void
) => {
  const q = query(
    collection(db, LEAD_CONTACTS_COLLECTION),
    where('leadId', '==', leadId)
  );

  return onSnapshot(q, (snapshot) => {
    const links = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeadContactLink[];
    callback(links);
  }, (error) => {
    console.error('Lead contact links fetch error:', error);
    callback([]);
  });
};

export const getLeadContactLinksForContact = async (contactId: string): Promise<LeadContactLink[]> => {
  const q = query(
    collection(db, LEAD_CONTACTS_COLLECTION),
    where('contactId', '==', contactId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as LeadContactLink[];
};

export const createLeadContactLink = async (linkData: LeadContactLinkFormData): Promise<string> => {
  // If setting as primary, first unset any existing primary for this lead
  if (linkData.isPrimary) {
    const existingLinks = await getLeadContactLinksForLead(linkData.leadId);
    const batch = writeBatch(db);

    existingLinks.forEach(link => {
      if (link.isPrimary) {
        batch.update(doc(db, LEAD_CONTACTS_COLLECTION, link.id), { isPrimary: false });
      }
    });

    if (existingLinks.some(l => l.isPrimary)) {
      await batch.commit();
    }
  }

  const docRef = await addDoc(collection(db, LEAD_CONTACTS_COLLECTION), {
    ...linkData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateLeadContactLink = async (id: string, data: Partial<LeadContactLink>): Promise<void> => {
  // If setting as primary, first unset any existing primary for this lead
  if (data.isPrimary) {
    const linkDoc = await getDoc(doc(db, LEAD_CONTACTS_COLLECTION, id));
    if (linkDoc.exists()) {
      const linkData = linkDoc.data() as LeadContactLink;
      const existingLinks = await getLeadContactLinksForLead(linkData.leadId);
      const batch = writeBatch(db);

      existingLinks.forEach(link => {
        if (link.isPrimary && link.id !== id) {
          batch.update(doc(db, LEAD_CONTACTS_COLLECTION, link.id), { isPrimary: false });
        }
      });

      if (existingLinks.some(l => l.isPrimary && l.id !== id)) {
        await batch.commit();
      }
    }
  }

  const docRef = doc(db, LEAD_CONTACTS_COLLECTION, id);
  await updateDoc(docRef, data);
};

export const deleteLeadContactLink = async (id: string): Promise<void> => {
  const docRef = doc(db, LEAD_CONTACTS_COLLECTION, id);
  await deleteDoc(docRef);
};

export const setContactAsPrimary = async (leadId: string, contactLinkId: string): Promise<void> => {
  const existingLinks = await getLeadContactLinksForLead(leadId);
  const batch = writeBatch(db);

  existingLinks.forEach(link => {
    const newIsPrimary = link.id === contactLinkId;
    if (link.isPrimary !== newIsPrimary) {
      batch.update(doc(db, LEAD_CONTACTS_COLLECTION, link.id), { isPrimary: newIsPrimary });
    }
  });

  await batch.commit();
};

// Migration: Add "Qualified Lead" stage to studio pipeline
export const migrateStudioPipelineWithQualifiedLead = async (): Promise<{ updated: boolean; message: string }> => {
  const pipelinesSnapshot = await getDocs(collection(db, PIPELINES_COLLECTION));

  for (const pipelineDoc of pipelinesSnapshot.docs) {
    const pipeline = pipelineDoc.data() as Pipeline;

    if (pipeline.type === 'studio') {
      // Check if "Qualified Lead" stage already exists
      const hasQualifiedLead = pipeline.stages.some(s => s.id === 'qualified-lead' || s.name === 'Qualified Lead');

      if (hasQualifiedLead) {
        return { updated: false, message: 'Studio pipeline already has Qualified Lead stage' };
      }

      // Create new stages array with Qualified Lead inserted after Researched
      const newStages = [
        { id: 'new-lead', name: 'New Lead', color: 'gray', order: 1, isActive: true },
        { id: 'researched', name: 'Researched', color: 'blue', order: 2, isActive: true },
        { id: 'qualified-lead', name: 'Qualified Lead', color: 'cyan', order: 3, isActive: true },
        { id: 'contacted', name: 'Contacted', color: 'yellow', order: 4, isActive: true },
        { id: 'meeting', name: 'Meeting', color: 'orange', order: 5, isActive: true },
        { id: 'proposal', name: 'Proposal', color: 'purple', order: 6, isActive: true },
        { id: 'negotiation', name: 'Negotiation', color: 'indigo', order: 7, isActive: true },
        { id: 'won', name: 'Won', color: 'green', order: 8, isActive: true },
        { id: 'lost', name: 'Lost', color: 'red', order: 9, isActive: false },
      ];

      await updateDoc(pipelineDoc.ref, {
        stages: newStages,
        updatedAt: serverTimestamp(),
      });

      return { updated: true, message: 'Studio pipeline updated with Qualified Lead stage' };
    }
  }

  return { updated: false, message: 'No studio pipeline found' };
};

// Migration: Convert embedded lead.contact to separate Contact entities
export const migrateEmbeddedContacts = async (userId: string): Promise<{ created: number; linked: number; skipped: number }> => {
  const leadsSnapshot = await getDocs(collection(db, LEADS_COLLECTION));
  let created = 0;
  let linked = 0;
  let skipped = 0;

  // Map to track contacts by email to avoid duplicates
  const contactsByEmail = new Map<string, string>();

  // First, get all existing contacts
  const existingContactsSnapshot = await getDocs(collection(db, CONTACTS_COLLECTION));
  existingContactsSnapshot.docs.forEach(docSnap => {
    const contact = docSnap.data() as Contact;
    if (contact.email) {
      contactsByEmail.set(contact.email.toLowerCase(), docSnap.id);
    }
  });

  for (const leadDoc of leadsSnapshot.docs) {
    const lead = leadDoc.data() as Lead;

    // Skip if no embedded contact or no email
    if (!lead.contact?.email) {
      skipped++;
      continue;
    }

    const email = lead.contact.email.toLowerCase();
    let contactId: string;

    // Check if contact already exists
    if (contactsByEmail.has(email)) {
      contactId = contactsByEmail.get(email)!;
    } else {
      // Create new contact
      const newContactRef = await addDoc(collection(db, CONTACTS_COLLECTION), {
        name: lead.contact.name || '',
        email: lead.contact.email,
        role: lead.contact.role || '',
        phone: lead.contact.phone || '',
        linkedin: lead.contact.linkedin || '',
        company: lead.name, // Use lead name as company
        tags: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
      });
      contactId = newContactRef.id;
      contactsByEmail.set(email, contactId);
      created++;
    }

    // Check if link already exists
    const existingLinksQuery = query(
      collection(db, LEAD_CONTACTS_COLLECTION),
      where('leadId', '==', leadDoc.id),
      where('contactId', '==', contactId)
    );
    const existingLinksSnapshot = await getDocs(existingLinksQuery);

    if (existingLinksSnapshot.empty) {
      // Create link
      await addDoc(collection(db, LEAD_CONTACTS_COLLECTION), {
        leadId: leadDoc.id,
        contactId: contactId,
        isPrimary: true,
        role: lead.contact.role || '',
        createdAt: serverTimestamp(),
        createdBy: userId,
      });
      linked++;
    }
  }

  return { created, linked, skipped };
};

// Initialize community pipeline (for existing databases)
export const initializeCommunityPipeline = async (): Promise<{ created: boolean; message: string }> => {
  const pipelinesSnapshot = await getDocs(collection(db, PIPELINES_COLLECTION));

  // Check if community pipeline already exists
  const hasCommunityPipeline = pipelinesSnapshot.docs.some(
    doc => (doc.data() as { type?: string }).type === 'community'
  );

  if (hasCommunityPipeline) {
    return { created: false, message: 'Community pipeline already exists' };
  }

  // Create community pipeline
  await addDoc(collection(db, PIPELINES_COLLECTION), {
    name: 'Channels Pipeline',
    type: 'community',
    stages: [
      { id: 'identified', name: 'Identified', color: 'gray', order: 1, isActive: true },
      { id: 'researched', name: 'Researched', color: 'blue', order: 2, isActive: true },
      { id: 'joined', name: 'Joined', color: 'cyan', order: 3, isActive: true },
      { id: 'participating', name: 'Participating', color: 'yellow', order: 4, isActive: true },
      { id: 'relationship-built', name: 'Relationship Built', color: 'orange', order: 5, isActive: true },
      { id: 'promotion-approved', name: 'Promotion Approved', color: 'purple', order: 6, isActive: true },
      { id: 'active-channel', name: 'Active Channel', color: 'indigo', order: 7, isActive: true },
      { id: 'high-performing', name: 'High-Performing', color: 'green', order: 8, isActive: true },
      { id: 'inactive', name: 'Inactive', color: 'red', order: 9, isActive: false },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { created: true, message: 'Community pipeline created successfully' };
};

// Initialize community-specific tags
export const initializeCommunityTags = async (userId: string): Promise<{ created: number; skipped: number }> => {
  const existingTagsSnapshot = await getDocs(collection(db, TAGS_COLLECTION));
  const existingTagNames = new Set(
    existingTagsSnapshot.docs.map(doc => (doc.data() as { name?: string }).name?.toLowerCase())
  );

  const communityTags = [
    { name: 'narrative-focused', color: 'purple' },
    { name: 'high-engagement', color: 'green' },
    { name: 'jam-related', color: 'orange' },
    { name: 'student-focused', color: 'blue' },
    { name: 'tool-friendly', color: 'cyan' },
    { name: 'quick-win', color: 'yellow' },
    { name: 'influencer-present', color: 'pink' },
    { name: 'seasonal', color: 'indigo' },
    { name: 'verified-active', color: 'green' },
    { name: 'relationship-needed', color: 'orange' },
  ];

  let created = 0;
  let skipped = 0;

  for (const tag of communityTags) {
    if (existingTagNames.has(tag.name.toLowerCase())) {
      skipped++;
      continue;
    }

    await addDoc(collection(db, TAGS_COLLECTION), {
      name: tag.name,
      color: tag.color,
      createdAt: serverTimestamp(),
      createdBy: userId,
    });
    created++;
  }

  return { created, skipped };
};

// Initialize competition pipeline (for existing databases)
export const initializeCompetitionPipeline = async (): Promise<{ created: boolean; message: string }> => {
  const pipelinesSnapshot = await getDocs(collection(db, PIPELINES_COLLECTION));

  // Check if competition pipeline already exists
  const hasCompetitionPipeline = pipelinesSnapshot.docs.some(
    doc => (doc.data() as { type?: string }).type === 'competition'
  );

  if (hasCompetitionPipeline) {
    return { created: false, message: 'Competition pipeline already exists' };
  }

  // Create competition pipeline
  await addDoc(collection(db, PIPELINES_COLLECTION), {
    name: 'Competition Pipeline',
    type: 'competition',
    stages: [
      { id: 'new', name: 'New', color: 'gray', order: 1, isActive: true },
      { id: 'researched', name: 'Researched', color: 'blue', order: 2, isActive: true },
      { id: 'tracking', name: 'Tracking', color: 'yellow', order: 3, isActive: true },
      { id: 'outreach-product-a', name: 'Outreach - Product A', color: 'red', order: 4, isActive: true },
      { id: 'outreach-product-b', name: 'Outreach - Product B', color: 'orange', order: 5, isActive: true },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { created: true, message: 'Competition pipeline created successfully' };
};

// ============================================================================
// Task operations
// ============================================================================

export const getTasksRealtime = (
  callback: (tasks: Task[]) => void,
  filters?: TaskFilters
) => {
  const q = query(collection(db, TASKS_COLLECTION), orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    let tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    // Apply filters client-side
    if (filters) {
      if (filters.assignee) {
        tasks = tasks.filter(task => task.assignee === filters.assignee);
      }
      if (filters.status) {
        tasks = tasks.filter(task => task.status === filters.status);
      }
      if (filters.project) {
        tasks = tasks.filter(task => task.project === filters.project);
      }
    }

    callback(tasks);
  });
};

export const createTask = async (data: TaskFormData, userId: string) => {
  const docRef = await addDoc(collection(db, TASKS_COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  });
  return docRef.id;
};

export const updateTask = async (id: string, data: Partial<TaskFormData>) => {
  const taskRef = doc(db, TASKS_COLLECTION, id);
  await updateDoc(taskRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteTask = async (id: string) => {
  const taskRef = doc(db, TASKS_COLLECTION, id);
  await deleteDoc(taskRef);
};