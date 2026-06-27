import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeAdapter } from "./fake.js";
import {
  setStatus, addComment, translateComment, translateRequest,
  deleteComment, addType, submitRequest,
} from "./core.js";

test("setStatus writes the status to the request", async () => {
  const a = createFakeAdapter({ requests: [{ id: "r1", status: "new" }] });
  const res = await setStatus(a, "r1", "in-progress");
  assert.deepEqual(res, { id: "r1", status: "in-progress" });
  assert.equal(a._store.requests[0].status, "in-progress");
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
