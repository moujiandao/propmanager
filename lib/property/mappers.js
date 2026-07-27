// The one home for the camelCase shape of a properties row. `state` defaults to
// "CA"; drive_link/image_url are normalized to "" / null. `inProduction` defaults
// true so rows predating the column (or a null from a partial insert) still count
// as active — only an explicit `false` excludes a property's tenants from the
// dashboard, Tenants, Payments, and To Do List pages.
export const mapProperty = (p) => ({
  id: p.id,
  address: p.address,
  city: p.city,
  state: p.state || "CA",
  zip: p.zip,
  units: p.units,
  type: p.type,
  status: p.status,
  driveLink: p.drive_link || "",
  imageUrl: p.image_url || null,
  inProduction: p.in_production !== false,
});
