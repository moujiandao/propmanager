// Real parking persistence adapter. Spot CRUD is a plain RLS-protected write
// over the anon Supabase client (same shape as lib/property/adapter.js).
// Lease creation goes through /api/parking/leases/create instead: a new
// market renter needs its parking_renters row and its parking_leases row
// created together, with the renter rolled back if the lease insert fails --
// the same shape as app/api/contracts/create's contract + contract_tenants
// insert.
export function createParkingAdapter(supabase) {
  const ok = (error, what) => { if (error) throw new Error(`${what}: ${error.message || error}`); };
  return {
    async insertSpot(row) {
      const { error } = await supabase.from("parking_spots").insert(row);
      ok(error, "insertSpot");
    },
    async updateSpot(id, patch) {
      const { error } = await supabase.from("parking_spots").update(patch).eq("id", id);
      ok(error, "updateSpot");
    },
    async deleteSpot(id) {
      const { error } = await supabase.from("parking_spots").delete().eq("id", id);
      ok(error, "deleteSpot");
    },
    async createLease(payload) {
      const res = await fetch("/api/parking/leases/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "createLease failed");
      return json;
    },
    async updateLease(id, patch) {
      const { error } = await supabase.from("parking_leases").update(patch).eq("id", id);
      ok(error, "updateLease");
    },
  };
}
