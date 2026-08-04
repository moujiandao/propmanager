// Maintenance aggregate — write operations, React-free.
//
// Every op takes an `adapter` (the narrow domain-shaped persistence seam, see
// adapter.js / fake.js) plus camelCase inputs, performs the write, and returns
// the resulting domain object in camelCase — or throws. No React, no `setData`,
// no Supabase chain: that lets the whole aggregate be tested through this
// interface against an in-memory fake. Optimistic local-state updates and
// rollback live in the React hook that wraps these (one layer up).

import { mapMaintenanceComment, mapMaintenance } from "./mappers.js";
import { nextClosedAt } from "./status.js";

// Set a request's workflow status, stamping/clearing closed_at alongside it.
//
// `existingClosedAt` is the request's current closedAt (the caller has the row
// in hand). Passing it is what makes re-closing an already-closed ticket a
// no-op for the date — see nextClosedAt in status.js for the rule. `now` is
// injectable so the transition is testable without freezing the clock.
//
// Status and closed_at are written in ONE update so a request can never be
// observed closed-without-a-date or dated-while-open.
export async function setStatus(adapter, id, status, { existingClosedAt = null, now = new Date().toISOString() } = {}) {
  const closedAt = nextClosedAt(status, existingClosedAt, now);
  await adapter.updateRequest(id, { status, closed_at: closedAt });
  return { id, status, closedAt };
}

// Add a comment (top-level or reply). Returns the new comment, mapped.
export async function addComment(adapter, { requestId, parentId, landlordId, body, authorType, authorId, authorName }) {
  const trimmed = (body || "").trim();
  if (!trimmed) throw new Error("Comment body is empty.");
  if (!landlordId) throw new Error("Missing landlordId for comment.");
  const row = {
    maintenance_request_id: requestId,
    parent_comment_id: parentId || null,
    landlord_id: landlordId,
    body: trimmed,
    author_type: authorType,
    author_id: authorId,
    author_name: authorName,
  };
  const inserted = await adapter.insertComment(row);
  return mapMaintenanceComment({ ...row, id: inserted.id, created_at: inserted.created_at, body_zh: "", deleted_at: null });
}

// Translate a comment body to Chinese and persist it. Returns the translation,
// or null if the translator produced nothing (caller leaves state untouched).
export async function translateComment(adapter, comment) {
  const translation = await adapter.translate(comment.body, comment.landlordId);
  if (!translation) return null;
  await adapter.updateComment(comment.id, { body_zh: translation });
  return translation;
}

// Translate a request description to Chinese and persist it.
export async function translateRequest(adapter, { id, description, landlordId }) {
  const translation = await adapter.translate(description, landlordId);
  if (!translation) return null;
  await adapter.updateRequest(id, { description_zh: translation });
  return translation;
}

// Delete a comment. Soft-delete (tombstone) when a top-level comment still has
// replies, so the thread structure survives; hard-delete otherwise. `hasReplies`
// is supplied by the caller, which already holds the thread. Returns whether it
// was a soft delete and (if so) the tombstone timestamp.
export async function deleteComment(adapter, comment, hasReplies, now = new Date().toISOString()) {
  if (hasReplies) {
    await adapter.updateComment(comment.id, { deleted_at: now });
    return { soft: true, deletedAt: now };
  }
  await adapter.deleteComment(comment.id);
  return { soft: false, deletedAt: null };
}

// Add a maintenance type for a landlord. Returns { id, name }.
export async function addType(adapter, { landlordId, name }) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Type name is empty.");
  const created = await adapter.insertType({ landlord_id: landlordId, name: trimmed });
  return { id: created.id, name: created.name };
}

// Tenant self-submission of a request (direct insert, status defaults to new).
// Returns the new request, mapped.
export async function submitRequest(adapter, { tenantId, propertyId, unit, description, priority }) {
  const row = {
    tenant_id: tenantId,
    property_id: propertyId,
    unit: unit,
    description: description,
    priority: priority,
    status: "new",
  };
  const inserted = await adapter.insertRequest(row);
  return mapMaintenance({ ...row, id: inserted.id, created_at: inserted.created_at });
}

// Landlord creation of a request with attachments — delegates to the upload
// route behind the adapter (multipart). Returns whatever the route returns.
export async function createRequest(adapter, formData) {
  return adapter.createRequest(formData);
}
