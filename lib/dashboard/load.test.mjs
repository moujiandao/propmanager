import { test } from "node:test";
import assert from "node:assert/strict";
import { DashboardLoadError, EMPTY_DATA, loadAllData } from "./load.js";

function queryClient(overrides = {}) {
  const empty = { data: [], error: null };
  return {
    from(table) {
      const result = overrides[table] || empty;
      const query = {
        select: () => query,
        order: () => query,
        eq: () => query,
        neq: () => query,
        limit: () => query,
        maybeSingle: () => query,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    },
  };
}

test("an empty landlord portfolio remains valid data", async () => {
  const data = await loadAllData(queryClient(), { role: "landlord" });
  assert.deepEqual(data, EMPTY_DATA);
});

test("a failed dashboard query throws instead of becoming an empty collection", async () => {
  const supabase = queryClient({
    maintenance_requests: { data: null, error: { message: "connection lost" } },
  });

  await assert.rejects(
    () => loadAllData(supabase, { role: "landlord" }),
    (error) => error instanceof DashboardLoadError
      && error.query === "maintenanceRequests"
      && /connection lost/.test(error.message),
  );
});

test("a failed tenant profile query also rejects the load", async () => {
  const supabase = queryClient({
    tenant_profiles: { data: null, error: { message: "permission denied" } },
  });

  await assert.rejects(
    () => loadAllData(supabase, { role: "tenant", id: "tenant-1" }),
    (error) => error instanceof DashboardLoadError && error.query === "tenantProfile",
  );
});
