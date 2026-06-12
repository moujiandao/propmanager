// Merge-field rendering shared by the template preview (client) and the
// send engine (server). A template stores {tag} placeholders; buildContext
// resolves a tenant/contract/property into tag values; renderTemplate fills them.

import { fmt, fmtDate, daysBetween } from "./format.js";

// Canonical merge tags. Drives both rendering and the UI "insert tag" buttons.
// `sample` powers the live preview when no real tenant is selected.
export const MERGE_TAGS = [
  { tag: "tenant_name",       label: "Tenant full name",   sample: "Jordan Rivera" },
  { tag: "tenant_first_name", label: "Tenant first name",  sample: "Jordan" },
  { tag: "property_address",  label: "Property address",   sample: "123 Maple St, Berkeley, CA 94704" },
  { tag: "unit",              label: "Unit",               sample: "Unit 2B" },
  { tag: "move_in_date",      label: "Move-in date",       sample: "Aug 15, 2026" },
  { tag: "move_out_date",     label: "Move-out date",      sample: "Jun 30, 2026" },
  { tag: "lease_end",         label: "Lease end date",     sample: "Jun 30, 2026" },
  { tag: "monthly_rent",      label: "Monthly rent",       sample: "$2,400" },
  { tag: "security_deposit",  label: "Security deposit",   sample: "$2,400" },
  { tag: "days_until",        label: "Days until event",   sample: "10" },
  { tag: "landlord_name",     label: "Landlord name",      sample: "Your Property Team" },
];

const fullAddress = (property) => {
  if (!property) return "";
  return [property.address, [property.city, property.state].filter(Boolean).join(", "), property.zip]
    .filter(Boolean)
    .join(", ");
};

// Assemble tag → value map from app entities. `eventDate` anchors {days_until}
// and is the date the reminder is about (move-out, lease end, etc.).
export function buildContext({ tenant, contract, property, unit, landlord, eventDate, today } = {}) {
  const unitLabel = unit?.unitNumber || tenant?.unit || "";
  const days = eventDate ? daysBetween(today || new Date(), eventDate) : null;
  return {
    tenant_name: tenant ? [tenant.name, tenant.lastName].filter(Boolean).join(" ") : "",
    tenant_first_name: tenant?.name || "",
    property_address: fullAddress(property),
    unit: unitLabel ? (/^unit/i.test(unitLabel) ? unitLabel : `Unit ${unitLabel}`) : "",
    move_in_date: tenant?.moveInDate ? fmtDate(tenant.moveInDate) : "",
    move_out_date: tenant?.moveOutDate ? fmtDate(tenant.moveOutDate) : "",
    lease_end: contract?.endDate ? fmtDate(contract.endDate) : "",
    monthly_rent: contract?.rentAmount != null ? fmt(contract.rentAmount) : (tenant?.monthlyRent ? fmt(tenant.monthlyRent) : ""),
    security_deposit: tenant?.securityDeposit ? fmt(tenant.securityDeposit) : "",
    days_until: days != null ? String(days) : "",
    landlord_name: landlord?.name || "",
  };
}

// Sample context for previews — uses each tag's `sample` value.
export function sampleContext() {
  return MERGE_TAGS.reduce((acc, m) => ({ ...acc, [m.tag]: m.sample }), {});
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Replace {tag} occurrences. Unknown tags resolve to "" (not the literal text).
// When `html` is true, values are HTML-escaped so data can't break the markup.
export function renderString(str, ctx = {}, { html = false } = {}) {
  if (!str) return "";
  return str.replace(/\{(\w+)\}/g, (_, tag) => {
    const val = ctx[tag] != null ? ctx[tag] : "";
    return html ? escapeHtml(val) : String(val);
  });
}

// Render a stored template ({ subject, bodyHtml, bodyText }) against a context.
// Falls back to deriving a plaintext body from bodyHtml, or an HTML body from
// bodyText, so callers always get both parts for multipart sending.
export function renderTemplate(template = {}, ctx = {}) {
  const subject = renderString(template.subject || "", ctx);
  const hasHtml = !!template.bodyHtml;
  const hasText = !!template.bodyText;
  const text = renderString(hasText ? template.bodyText : stripHtml(template.bodyHtml || ""), ctx);
  // Output is HTML in both branches, so escape merge values to protect the markup.
  const html = renderString(hasHtml ? template.bodyHtml : textToHtml(template.bodyText || ""), ctx, { html: true });
  return { subject, html, text };
}

const stripHtml = (s) => String(s).replace(/<br\s*\/?>(?=\s*)/gi, "\n").replace(/<[^>]+>/g, "").trim();
const textToHtml = (s) => escapeHtml(s).replace(/\n/g, "<br>");
