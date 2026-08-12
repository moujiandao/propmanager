import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeAdapter } from "./fake.js";
import {
  setStatus, addComment, translateComment, translateRequest,
  deleteComment, addType, submitRequest, updateRequest, deleteRequest,
} from "./core.js";

test("setStatus writes the status to the request", async () => {
  const a = createFakeAdapter({ requests: [{ id: "r1", status: "new" }] });
  const res = await setStatus(a, "r1", "in-progress");
  assert.deepEqual(res, { id: "r1", status: "in-progress", closedAt: null });
  assert.equal(a._store.requests[0].status, "in-progress");
});

test("setStatus stamps closed_at when a ticket is closed", async () => {
  const a = createFakeAdapter({ requests: [{ id: "r1", status: "new" }] });
  const res = await setStatus(a, "r1", "closed", { now: "2026-08-03T17:00:00Z" });
  assert.equal(res.closedAt, "2026-08-03T17:00:00Z");
  assert.equal(a._store.requests[0].closed_at, "2026-08-03T17:00:00Z");
});

test("setStatus keeps the original close date when an already-closed ticket is re-closed", async () => {
  // Dropping a closed card back onto the Closed column must not rewrite when
  // the work actually finished.
  const a = createFakeAdapter({ requests: [{ id: "r1", status: "closed", closed_at: "2026-07-01T09:00:00Z" }] });
  await setStatus(a, "r1", "closed", { existingClosedAt: "2026-07-01T09:00:00Z", now: "2026-08-03T17:00:00Z" });
  assert.equal(a._store.requests[0].closed_at, "2026-07-01T09:00:00Z");
});

test("setStatus clears closed_at when a ticket is reopened", async () => {
  const a = createFakeAdapter({ requests: [{ id: "r1", status: "closed", closed_at: "2026-07-01T09:00:00Z" }] });
  await setStatus(a, "r1", "in-progress", { existingClosedAt: "2026-07-01T09:00:00Z" });
  assert.equal(a._store.requests[0].closed_at, null);
});

test("setStatus treats the legacy 'resolved' status as closed", async () => {
  const a = createFakeAdapter({ requests: [{ id: "r1", status: "new" }] });
  await setStatus(a, "r1", "resolved", { now: "2026-08-03T17:00:00Z" });
  assert.equal(a._store.requests[0].closed_at, "2026-08-03T17:00:00Z");
});

test("setStatus writes status and closed_at in a single update", async () => {
  // One update, so a request is never observed closed-without-a-date.
  const a = createFakeAdapter({ requests: [{ id: "r1", status: "new" }] });
  const patches = [];
  const orig = a.updateRequest;
  a.updateRequest = (id, patch) => { patches.push(patch); return orig(id, patch); };
  await setStatus(a, "r1", "closed", { now: "2026-08-03T17:00:00Z" });
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0], { status: "closed", closed_at: "2026-08-03T17:00:00Z" });
});

test("addComment maps snake->camel, trims, and persists", async () => {
  const a = createFakeAdapter();
  const c = await addComment(a, {
    requestId: "r1", parentId: null, landlordId: "L1",
    body: "  leaky tap  ", authorType: "landlord", authorId: "u1", authorName: "Bri",
  });
  assert.equal(c.body, "leaky tap");
  assert.equal(c.maintenanceRequestId, "r1");
  assert.equal(c.landlordId, "L1");
  assert.equal(c.bodyZh, "");
  assert.equal(c.deletedAt, null);
  assert.ok(c.id && c.createdAt);
  // persisted row is snake_case
  assert.equal(a._store.comments[0].author_type, "landlord");
});

test("addComment rejects empty body and missing landlordId", async () => {
  const a = createFakeAdapter();
  await assert.rejects(() => addComment(a, { body: "   ", landlordId: "L1" }), /empty/);
  await assert.rejects(() => addComment(a, { body: "hi", landlordId: "" }), /landlordId/);
});

test("translateComment writes body_zh and returns the translation", async () => {
  const a = createFakeAdapter({ comments: [{ id: "c1", body: "leak", landlord_id: "L1" }] });
  const t = await translateComment(a, { id: "c1", body: "leak", landlordId: "L1" });
  assert.equal(t, "[zh] leak");
  assert.equal(a._store.comments[0].body_zh, "[zh] leak");
});

test("translateComment is a no-op when the translator returns nothing", async () => {
  const a = createFakeAdapter({ comments: [{ id: "c1", body: "x", landlord_id: "L1" }], translateWith: () => "" });
  const t = await translateComment(a, { id: "c1", body: "x", landlordId: "L1" });
  assert.equal(t, null);
  assert.equal(a._store.comments[0].body_zh, undefined);
});

test("translateRequest writes description_zh", async () => {
  const a = createFakeAdapter({ requests: [{ id: "r1", description: "broken heater" }] });
  const t = await translateRequest(a, { id: "r1", description: "broken heater", landlordId: "L1" });
  assert.equal(t, "[zh] broken heater");
  assert.equal(a._store.requests[0].description_zh, "[zh] broken heater");
});

test("deleteComment soft-deletes (tombstone) when there are replies", async () => {
  const a = createFakeAdapter({ comments: [{ id: "c1", body: "hi" }] });
  const res = await deleteComment(a, { id: "c1" }, true, "2026-06-26T00:00:00Z");
  assert.deepEqual(res, { soft: true, deletedAt: "2026-06-26T00:00:00Z" });
  assert.equal(a._store.comments[0].deleted_at, "2026-06-26T00:00:00Z");
  assert.equal(a._store.comments.length, 1); // not removed
});

test("deleteComment hard-deletes when there are no replies", async () => {
  const a = createFakeAdapter({ comments: [{ id: "c1", body: "hi" }] });
  const res = await deleteComment(a, { id: "c1" }, false);
  assert.equal(res.soft, false);
  assert.equal(a._store.comments.length, 0);
});

test("addType trims and persists the landlord-scoped type", async () => {
  const a = createFakeAdapter();
  const t = await addType(a, { landlordId: "L1", name: "  Plumbing  " });
  assert.equal(t.name, "Plumbing");
  assert.ok(t.id);
  assert.equal(a._store.types[0].landlord_id, "L1");
  await assert.rejects(() => addType(a, { landlordId: "L1", name: "  " }), /empty/);
});

test("submitRequest defaults status to new and returns mapped request", async () => {
  const a = createFakeAdapter();
  const r = await submitRequest(a, { tenantId: "t1", propertyId: "p1", unit: "2B", description: "no heat", priority: "high" });
  assert.equal(r.status, "new");
  assert.equal(r.tenantId, "t1");
  assert.equal(r.propertyId, "p1");
  assert.equal(r.priority, "high");
  assert.ok(r.id && r.date);
  assert.equal(a._store.requests[0].tenant_id, "t1");
});

test("updateRequest edits the request's own content and trims it", async () => {
  const a = createFakeAdapter({
    requests: [{ id: "r1", description: "Leak", type: "Plumbing", priority: "low", unit: "101", status: "new" }],
  });
  await updateRequest(a, "r1", { description: "  Kitchen sink leaking  ", type: "  Plumbing  ", priority: "high", unit: " 102 " });
  const r = a._store.requests[0];
  assert.equal(r.description, "Kitchen sink leaking");
  assert.equal(r.type, "Plumbing");
  assert.equal(r.priority, "high");
  assert.equal(r.unit, "102");
});

test("updateRequest clears the cached Chinese translation, which described the old text", async () => {
  // The stalest kind of stale: Chinese confidently describing something the
  // English no longer says. Clearing it puts the Translate button back.
  const a = createFakeAdapter({
    requests: [{ id: "r1", description: "Leak", description_zh: "漏水", status: "new" }],
  });
  await updateRequest(a, "r1", { description: "Broken window" });
  assert.equal(a._store.requests[0].description_zh, null);
});

test("updateRequest touches neither status nor the request's home", async () => {
  // setStatus owns status together with closed_at; re-pointing a request at a
  // different tenant or property would be a different request.
  const a = createFakeAdapter({
    requests: [{ id: "r1", description: "Leak", status: "in-progress", closed_at: null, tenant_id: "t1", property_id: "p1" }],
  });
  await updateRequest(a, "r1", { description: "Leak", status: "closed", tenantId: "t9", propertyId: "p9" });
  const r = a._store.requests[0];
  assert.equal(r.status, "in-progress");
  assert.equal(r.tenant_id, "t1");
  assert.equal(r.property_id, "p1");
});

test("updateRequest refuses to blank the description", async () => {
  const a = createFakeAdapter({ requests: [{ id: "r1", description: "Leak" }] });
  await assert.rejects(() => updateRequest(a, "r1", { description: "   " }), /description is required/);
  assert.equal(a._store.requests[0].description, "Leak", "rejected edit left the row untouched");
});

test("deleteRequest removes the request, its comments and its attachment files", async () => {
  const a = createFakeAdapter({
    requests: [{ id: "r1" }, { id: "r2" }],
    comments: [{ id: "c1", maintenance_request_id: "r1" }, { id: "c2", maintenance_request_id: "r2" }],
    attachments: [{ id: "a1", maintenance_request_id: "r1" }],
  });
  const result = await deleteRequest(a, "r1", ["landlord/r1/photo.jpg"]);
  assert.equal(result.filesRemoved, true);
  assert.deepEqual(a._store.requests.map((r) => r.id), ["r2"]);
  // Comments and attachment rows cascade in the database; the fake mirrors that
  // so a test sees the same aftermath the real schema produces.
  assert.deepEqual(a._store.comments.map((c) => c.id), ["c2"], "only the deleted request's comments go");
  assert.deepEqual(a._store.attachments, []);
  // The FILES do not cascade, which is the whole reason paths are passed in.
  assert.deepEqual(a._store.removedFiles, ["landlord/r1/photo.jpg"]);
});

test("deleteRequest with no attachments touches storage at all", async () => {
  const a = createFakeAdapter({ requests: [{ id: "r1" }] });
  const result = await deleteRequest(a, "r1");
  assert.equal(result.filesRemoved, true);
  assert.equal(a._store.removedFiles, undefined, "no attachments means no storage call");
});

test("a failed file cleanup reports rather than throws — the request is already gone", async () => {
  // Turning this into an error would tell the caller the delete failed when it
  // did not. The orphaned file is worth reporting, not worth lying about.
  const a = createFakeAdapter({ requests: [{ id: "r1" }] });
  a.removeFiles = async () => { throw new Error("storage unavailable"); };
  const result = await deleteRequest(a, "r1", ["landlord/r1/photo.jpg"]);
  assert.equal(result.filesRemoved, false);
  assert.match(result.fileError.message, /storage unavailable/);
  assert.deepEqual(a._store.requests, [], "the request really is gone");
});

test("deleteRequest on an unknown id throws", async () => {
  const a = createFakeAdapter({ requests: [{ id: "r1" }] });
  await assert.rejects(() => deleteRequest(a, "missing"), /not found/);
  assert.equal(a._store.requests.length, 1);
});
