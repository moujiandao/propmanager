import { statusForRow } from "./status.js";

// The one home for the camelCase shape of a tenant_profiles row. This entity has
// the most touchpoints in the app (a new column shows up in the add/edit modal,
// the detail page, the create/update routes, this mapper, and the dashboard), so
// keeping the read-shape in a single place is where this seam pays off.
//
// `status` is DERIVED from the move-in/move-out dates via lib/tenant/status.js —
// the stored `status` column is legacy and deliberately not read here, so a row
// whose column disagrees with its dates (including legacy `active`/`inactive`)
// resolves to whatever the dates say.
export const mapTenant = (t) => ({
  id: t.id,
  name: t.name,
  lastName: t.last_name || "",
  email: t.email,
  phone: t.phone || "",
  propertyId: t.property_id,
  unit: t.unit,
  status: statusForRow(t),
  bankConnected: t.bank_connected || false,
  recurringPayment: t.recurring_payment || false,
  monthlyRent: t.monthly_rent || 0,
  moveInDate: t.move_in_date,
  moveOutDate: t.move_out_date,
  hasCosigner: t.has_cosigner || false,
  studentStatus: t.student_status,
  studentYear: t.student_year,
  zelleName: t.zelle_name,
  homeAddress: t.home_address,
  age: t.age,
  unitId: t.unit_id,
  notes: t.notes || "",
  securityDeposit: t.security_deposit || 0,
  securityDepositRefunded: t.security_deposit_refunded || false,
  landlordId: t.landlord_id || null,
  createdAt: t.created_at || null,
  updatedAt: t.updated_at || null,
});
