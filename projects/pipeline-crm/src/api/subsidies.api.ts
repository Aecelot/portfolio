/**
 * Subsidies API - Direct Firestore access for subsidy tracking.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Subsidy, SubsidyFormData, SubsidyFilters } from '@/types/subsidy';

const COLLECTION = 'subsidies';

/**
 * List all subsidies with optional filtering.
 */
export async function listSubsidies(filters?: SubsidyFilters): Promise<Subsidy[]> {
  let q = query(collection(db, COLLECTION), orderBy('deadline', 'asc'));

  const snapshot = await getDocs(q);
  
  let subsidies = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Subsidy[];

  // Client-side filtering
  if (filters) {
    if (filters.type) {
      subsidies = subsidies.filter((s) => s.type === filters.type);
    }
    if (filters.status) {
      subsidies = subsidies.filter((s) => s.status === filters.status);
    }
    if (filters.priority) {
      subsidies = subsidies.filter((s) => s.priority === filters.priority);
    }
    if (filters.provider) {
      subsidies = subsidies.filter((s) => 
        s.provider.toLowerCase().includes(filters.provider!.toLowerCase())
      );
    }
    if (filters.deadlineBefore) {
      subsidies = subsidies.filter((s) => 
        s.deadline && s.deadline <= filters.deadlineBefore!
      );
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      subsidies = subsidies.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.provider.toLowerCase().includes(search) ||
          s.description?.toLowerCase().includes(search) ||
          s.eligibility.toLowerCase().includes(search)
      );
    }
  }

  return subsidies;
}

/**
 * Get a single subsidy by ID.
 */
export async function getSubsidy(id: string): Promise<Subsidy | null> {
  const docRef = doc(db, COLLECTION, id);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Subsidy;
}

/**
 * Create a new subsidy.
 */
export async function createSubsidy(data: SubsidyFormData): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: user.uid,
  });

  return docRef.id;
}

/**
 * Update an existing subsidy.
 */
export async function updateSubsidy(id: string, data: Partial<SubsidyFormData>): Promise<void> {
  const docRef = doc(db, COLLECTION, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete a subsidy.
 */
export async function deleteSubsidy(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * Get subsidies with upcoming deadlines (next 60 days).
 */
export async function getUpcomingDeadlines(): Promise<Subsidy[]> {
  const subsidies = await listSubsidies();
  const today = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return subsidies.filter(
    (s) =>
      s.deadline &&
      s.deadline >= today &&
      s.deadline <= future &&
      s.status !== 'applied' &&
      s.status !== 'approved' &&
      s.status !== 'received' &&
      s.status !== 'rejected' &&
      s.status !== 'closed'
  );
}

/**
 * Get active applications (applied or under review).
 */
export async function getActiveApplications(): Promise<Subsidy[]> {
  const subsidies = await listSubsidies();
  return subsidies.filter(
    (s) => s.status === 'applied' || s.status === 'under-review'
  );
}

/**
 * Get subsidies by company.
 */
export async function getSubsidiesByCompany(company: 'company-a' | 'company-b' | 'both'): Promise<Subsidy[]> {
  const subsidies = await listSubsidies();
  return subsidies.filter(
    (s) => s.relevantFor.includes(company) || s.relevantFor.includes('both')
  );
}
