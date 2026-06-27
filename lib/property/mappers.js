// The one home for the camelCase shape of a properties row. `state` defaults to
// "CA"; drive_link/image_url are normalized to "" / null.
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
});
