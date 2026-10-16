/**
 * Leads service - business logic for leads API.
 * Handles Firestore queries, pagination, and data transformation.
 */

import { db } from "../../config";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { paginate } from "../shared/paginator";
import { PaginatedResponse, LeadListItem, LeadStats } from "../shared/types";
import { ListLeadsQuery, CreateLeadBody, UpdateLeadBody } from "./leads.schema";
import { ApiError } from "../middleware/error-handler";

const LEADS_COLLECTION = "leads";

// =============================================================================
// LIST LEADS (PAGINATED)
// =============================================================================

export async function listLeads(
  query: ListLeadsQuery
): Promise<PaginatedResponse<LeadListItem>> {
  const { page, limit, sort, order, type, category, status, priority, owner, search, pipelineStage } = query;

  // Start with collection reference
  let firestoreQuery = db.collection(LEADS_COLLECTION) as FirebaseFirestore.Query;

  // Apply filters that Firestore can handle directly (equality filters)
  if (type) {
    firestoreQuery = firestoreQuery.where("type", "==", type);
  }
  if (category) {
    firestoreQuery = firestoreQuery.where("category", "==", category);
  }
  if (status) {
    firestoreQuery = firestoreQuery.where("status", "==", status);
  }
  if (priority && priority !== "none") {
    firestoreQuery = firestoreQuery.where("priority", "==", priority);
  }
  if (owner) {
    firestoreQuery = firestoreQuery.where("owner", "==", owner);
  }
  if (pipelineStage) {
    firestoreQuery = firestoreQuery.where("pipeline.stageId", "==", pipelineStage);
  }

  // For search, we need to handle it differently
  // Firestore doesn't support full-text search, so we'll fetch and filter
  // For production scale, consider Algolia or Typesense
  let preCountedTotal: number | undefined;

  if (search) {
    // When searching, we need to fetch all matching docs and filter client-side
    // This is acceptable for <50k docs, but should be replaced with proper search for larger datasets
    const searchLower = search.toLowerCase();

    // Get all docs matching other filters
    const allDocs = await firestoreQuery.get();

    // Filter by search term
    const matchingDocs = allDocs.docs.filter((doc) => {
      const data = doc.data();
      return (
        data.name?.toLowerCase().includes(searchLower) ||
        data.contact?.name?.toLowerCase().includes(searchLower) ||
        data.contact?.email?.toLowerCase().includes(searchLower) ||
        data.website?.toLowerCase().includes(searchLower)
      );
    });

    // Sort manually
    matchingDocs.sort((a, b) => {
      const aVal = a.data()[sort];
      const bVal = b.data()[sort];

      // Handle Firestore Timestamps
      const aTime = aVal?.toMillis?.() ?? aVal ?? 0;
      const bTime = bVal?.toMillis?.() ?? bVal ?? 0;

      return order === "desc" ? bTime - aTime : aTime - bTime;
    });

    // Paginate manually
    const startIndex = (page - 1) * limit;
    const paginatedDocs = matchingDocs.slice(startIndex, startIndex + limit);

    return {
      data: paginatedDocs.map((doc) => transformLeadToListItem(doc)),
      pagination: {
        page,
        limit,
        total: matchingDocs.length,
        totalPages: Math.ceil(matchingDocs.length / limit),
        hasNext: page < Math.ceil(matchingDocs.length / limit),
        hasPrev: page > 1,
      },
    };
  }

  // Use the generic paginator for non-search queries
  return paginate<LeadListItem>({
    query: firestoreQuery,
    params: { page, limit, sort, order },
    sortField: sort,
    transform: transformLeadToListItem,
    preCountedTotal,
  });
}

// =============================================================================
// GET SINGLE LEAD
// =============================================================================

export async function getLead(id: string): Promise<FirebaseFirestore.DocumentData> {
  const doc = await db.collection(LEADS_COLLECTION).doc(id).get();

  if (!doc.exists) {
    throw ApiError.notFound("Lead");
  }

  const data = doc.data()!;

  return {
    id: doc.id,
    ...data,
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
    pipeline: {
      ...data.pipeline,
      enteredStageAt: formatTimestamp(data.pipeline?.enteredStageAt),
    },
  };
}

// =============================================================================
// CREATE LEAD
// =============================================================================

export async function createLead(
  data: CreateLeadBody,
  createdBy: string
): Promise<{ id: string }> {
  const now = FieldValue.serverTimestamp();

  const leadData = {
    ...data,
    createdBy,
    createdAt: now,
    updatedAt: now,
    pipeline: data.pipeline
      ? {
          ...data.pipeline,
          enteredStageAt: now,
        }
      : undefined,
  };

  const docRef = await db.collection(LEADS_COLLECTION).add(leadData);

  return { id: docRef.id };
}

// =============================================================================
// UPDATE LEAD
// =============================================================================

export async function updateLead(
  id: string,
  data: UpdateLeadBody
): Promise<void> {
  const docRef = db.collection(LEADS_COLLECTION).doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw ApiError.notFound("Lead");
  }

  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Handle nested pipeline update (merge, don't replace)
  if (data.pipeline) {
    const existingPipeline = doc.data()?.pipeline || {};
    const mergedPipeline: Record<string, unknown> = {
      ...existingPipeline,
      ...data.pipeline,
    };

    // If stage changed, update enteredStageAt
    if (data.pipeline.stageId && data.pipeline.stageId !== existingPipeline.stageId) {
      mergedPipeline.enteredStageAt = FieldValue.serverTimestamp();
    }

    updateData.pipeline = mergedPipeline;
  }

  // Handle nested contact update (merge, don't replace)
  if (data.contact) {
    const existingContact = doc.data()?.contact || {};
    updateData.contact = {
      ...existingContact,
      ...data.contact,
    };
  }

  await docRef.update(updateData);
}

// =============================================================================
// DELETE LEAD
// =============================================================================

export async function deleteLead(id: string): Promise<void> {
  const docRef = db.collection(LEADS_COLLECTION).doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw ApiError.notFound("Lead");
  }

  // Delete the lead
  await docRef.delete();

  // Also delete associated notes, activities, and contact links
  const batch = db.batch();

  // Delete notes
  const notesSnapshot = await db
    .collection("notes")
    .where("leadId", "==", id)
    .get();
  notesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  // Delete activities
  const activitiesSnapshot = await db
    .collection("activities")
    .where("leadId", "==", id)
    .get();
  activitiesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  // Delete lead-contact links
  const linksSnapshot = await db
    .collection("leadContacts")
    .where("leadId", "==", id)
    .get();
  linksSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  if (
    notesSnapshot.size > 0 ||
    activitiesSnapshot.size > 0 ||
    linksSnapshot.size > 0
  ) {
    await batch.commit();
  }
}

// =============================================================================
// STATS
// =============================================================================

export async function getLeadsStats(type?: string): Promise<LeadStats> {
  let query = db.collection(LEADS_COLLECTION) as FirebaseFirestore.Query;

  if (type) {
    query = query.where("type", "==", type);
  }

  const snapshot = await query.get();

  const stats: LeadStats = {
    total: snapshot.size,
    byType: {},
    byStatus: {},
    byPriority: {},
    recentlyUpdated: 0,
  };

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  snapshot.docs.forEach((doc) => {
    const data = doc.data();

    // Count by type
    const leadType = data.type || "unknown";
    stats.byType[leadType] = (stats.byType[leadType] || 0) + 1;

    // Count by status
    const status = data.status || "unknown";
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    // Count by priority
    const priority = data.priority || "none";
    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;

    // Count recently updated
    const updatedAt = data.updatedAt?.toDate?.();
    if (updatedAt && updatedAt > oneWeekAgo) {
      stats.recentlyUpdated++;
    }
  });

  return stats;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Transform a Firestore document to a LeadListItem for list responses.
 * Includes only the fields needed for list display.
 */
function transformLeadToListItem(
  doc: FirebaseFirestore.QueryDocumentSnapshot
): LeadListItem {
  const data = doc.data();

  const item: LeadListItem = {
    id: doc.id,
    type: data.type,
    name: data.name,
    status: data.status,
    priority: data.priority || "none",
    category: data.category,
    owner: data.owner,
    website: data.website || "",
    country: data.country || "",
    tags: data.tags || [],
    pipeline: {
      pipelineId: data.pipeline?.pipelineId || "",
      stageId: data.pipeline?.stageId || "",
    },
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };

  // Include contact summary
  if (data.contact) {
    item.contact = {
      name: data.contact.name || "",
      email: data.contact.email || "",
    };
  }

  // Include type-specific summary
  if (data.type === "studio" || data.type === "publisher") {
    item.studio = {
      size: data.studio?.size || "",
      fitScore: data.studio?.fitScore || 0,
    };
  } else if (data.type === "investor") {
    item.investor = {
      type: data.investor?.type || "",
      fitScore: data.investor?.fitScore,
    };
  } else if (data.type === "community") {
    item.community = {
      platform: data.community?.platform || "",
      estimatedReach: data.community?.estimatedReach || 0,
      fitScore: data.community?.fitScore || 0,
    };
  }

  return item;
}

/**
 * Format Firestore Timestamp to ISO string.
 */
function formatTimestamp(timestamp: unknown): string {
  if (!timestamp) return "";

  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }

  if (typeof timestamp === "object" && "toDate" in timestamp) {
    return (timestamp as Timestamp).toDate().toISOString();
  }

  return "";
}
