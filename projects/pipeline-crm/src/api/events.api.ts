/**
 * Events API - Direct Firestore access for event tracking.
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
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Event, EventFormData, EventFilters } from '@/types/event';

const COLLECTION = 'events';

/**
 * List all events with optional filtering.
 */
export async function listEvents(filters?: EventFilters): Promise<Event[]> {
  let q = query(collection(db, COLLECTION), orderBy('startDate', 'asc'));

  // Note: Firestore has limitations on compound queries
  // For complex filtering, we filter client-side after fetching
  const snapshot = await getDocs(q);
  
  let events = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Event[];

  // Client-side filtering
  if (filters) {
    if (filters.type) {
      events = events.filter((e) => e.type === filters.type);
    }
    if (filters.status) {
      events = events.filter((e) => e.status === filters.status);
    }
    if (filters.priority) {
      events = events.filter((e) => e.priority === filters.priority);
    }
    if (filters.isOnline !== undefined) {
      events = events.filter((e) => e.isOnline === filters.isOnline);
    }
    if (filters.dateFrom) {
      events = events.filter((e) => e.startDate >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      events = events.filter((e) => e.startDate <= filters.dateTo!);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      events = events.filter(
        (e) =>
          e.name.toLowerCase().includes(search) ||
          e.location.toLowerCase().includes(search) ||
          e.description?.toLowerCase().includes(search)
      );
    }
  }

  return events;
}

/**
 * Get a single event by ID.
 */
export async function getEvent(id: string): Promise<Event | null> {
  const docRef = doc(db, COLLECTION, id);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Event;
}

/**
 * Create a new event.
 */
export async function createEvent(data: EventFormData): Promise<string> {
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
 * Update an existing event.
 */
export async function updateEvent(id: string, data: Partial<EventFormData>): Promise<void> {
  const docRef = doc(db, COLLECTION, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete an event.
 */
export async function deleteEvent(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * Get upcoming events (next 90 days).
 */
export async function getUpcomingEvents(): Promise<Event[]> {
  const today = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const events = await listEvents({
    dateFrom: today,
    dateTo: future,
  });
  
  return events.filter((e) => 
    e.status !== 'passed' && 
    e.status !== 'declined' && 
    e.status !== 'completed'
  );
}

/**
 * Get events with upcoming deadlines.
 */
export async function getEventsWithDeadlines(): Promise<Event[]> {
  const events = await listEvents();
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  return events.filter(
    (e) =>
      e.applicationDeadline &&
      e.applicationDeadline >= today &&
      e.applicationDeadline <= nextMonth &&
      e.status !== 'applied' &&
      e.status !== 'accepted' &&
      e.status !== 'attending'
  );
}
