import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOptimisticRecordUpdate,
  rollbackOptimisticRecordUpdate,
  applyOptimisticRecordRemoval,
  rollbackOptimisticRecordRemoval,
} from "./optimistic.js";

test("a failed maintenance edit restores only its own record", () => {
  const initial = {
    maintenance: [
      { id: "r1", status: "new" },
      { id: "r2", status: "new" },
    ],
  };
  const first = applyOptimisticRecordUpdate(initial, "maintenance", "r1", (record) => ({ ...record, status: "in-progress" }));
  const second = applyOptimisticRecordUpdate(first.data, "maintenance", "r2", (record) => ({ ...record, status: "closed" }));

  const rolledBack = rollbackOptimisticRecordUpdate(
    second.data,
    "maintenance",
    "r1",
    first.previous,
    first.optimistic,
  );

  assert.deepEqual(rolledBack.maintenance, [
    { id: "r1", status: "new" },
    { id: "r2", status: "closed" },
  ]);
});

test("a failed removal restores its record without undoing a concurrent edit", () => {
  const initial = {
    maintenance: [
      { id: "r1", status: "new" },
      { id: "r2", status: "new" },
    ],
  };
  const removed = applyOptimisticRecordRemoval(initial, "maintenance", "r1");
  const edited = applyOptimisticRecordUpdate(removed.data, "maintenance", "r2", (record) => ({ ...record, status: "closed" }));

  const rolledBack = rollbackOptimisticRecordRemoval(
    edited.data,
    "maintenance",
    "r1",
    removed.previous,
    removed.index,
  );

  assert.deepEqual(rolledBack.maintenance, [
    { id: "r1", status: "new" },
    { id: "r2", status: "closed" },
  ]);
});

test("a failed older edit cannot overwrite a later successful edit to the same record", () => {
  const initial = { maintenance: [{ id: "r1", status: "new" }] };
  const first = applyOptimisticRecordUpdate(initial, "maintenance", "r1", (record) => ({ ...record, status: "in-progress" }));
  const second = applyOptimisticRecordUpdate(first.data, "maintenance", "r1", (record) => ({ ...record, status: "closed" }));

  const rolledBack = rollbackOptimisticRecordUpdate(
    second.data,
    "maintenance",
    "r1",
    first.previous,
    first.optimistic,
  );

  assert.equal(rolledBack.maintenance[0], second.optimistic);
  assert.equal(rolledBack.maintenance[0].status, "closed");
});
