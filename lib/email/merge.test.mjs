import { test } from "node:test";
import assert from "node:assert/strict";
import { renderString, renderTemplate, buildContext, MERGE_TAGS, sampleContext } from "./merge.js";
import { fmtDate, daysBetween } from "./format.js";

test("renderString fills known tags and blanks unknown ones", () => {
  const out = renderString("Hi {tenant_first_name}, due {nope}.", { tenant_first_name: "Jordan" });
  assert.equal(out, "Hi Jordan, due .");
});

test("renderString escapes values in HTML mode", () => {
  const out = renderString("<p>{tenant_name}</p>", { tenant_name: "A & B <x>" }, { html: true });
  assert.equal(out, "<p>A &amp; B &lt;x&gt;</p>");
});

test("renderString leaves values raw in text mode", () => {
  const out = renderString("{tenant_name}", { tenant_name: "A & B" });
  assert.equal(out, "A & B");
});

test("buildContext maps tenant/contract/property and formats dates+currency", () => {
  const ctx = buildContext({
    tenant: { name: "Jordan", lastName: "Rivera", moveOutDate: "2026-06-30", securityDeposit: 2400 },
    contract: { endDate: "2026-06-30", rentAmount: 2400 },
    property: { address: "123 Maple St", city: "Berkeley", state: "CA", zip: "94704" },
    unit: { unitNumber: "2B" },
    landlord: { name: "Acme Rentals" },
    eventDate: "2026-06-30",
    today: "2026-06-20",
  });
  assert.equal(ctx.tenant_name, "Jordan Rivera");
  assert.equal(ctx.move_out_date, "Jun 30, 2026");
  assert.equal(ctx.monthly_rent, "$2,400");
  assert.equal(ctx.security_deposit, "$2,400");
  assert.equal(ctx.property_address, "123 Maple St, Berkeley, CA, 94704");
  assert.equal(ctx.unit, "Unit 2B");
  assert.equal(ctx.days_until, "10");
  assert.equal(ctx.landlord_name, "Acme Rentals");
});

test("buildContext yields empty strings for missing fields (not literal tags)", () => {
  const ctx = buildContext({ tenant: { name: "Sam" } });
  assert.equal(ctx.move_out_date, "");
  assert.equal(ctx.lease_end, "");
  assert.equal(ctx.security_deposit, "");
  assert.equal(ctx.days_until, "");
});

test("renderTemplate derives text from html and escapes html body", () => {
  const ctx = { tenant_name: "A & B" };
  const r = renderTemplate({ subject: "Hi {tenant_name}", bodyHtml: "<p>Dear {tenant_name}</p>" }, ctx);
  assert.equal(r.subject, "Hi A & B");
  assert.equal(r.html, "<p>Dear A &amp; B</p>");
  assert.equal(r.text, "Dear A & B");
});

test("renderTemplate builds html from a plaintext body", () => {
  const r = renderTemplate({ subject: "x", bodyText: "Line1\nLine2 {tenant_first_name}" }, { tenant_first_name: "Jo" });
  assert.equal(r.text, "Line1\nLine2 Jo");
  assert.equal(r.html, "Line1<br>Line2 Jo");
});

test("MERGE_TAGS and sampleContext stay in sync", () => {
  const sample = sampleContext();
  for (const m of MERGE_TAGS) assert.ok(m.tag in sample, `${m.tag} missing from sample`);
});

test("fmtDate guards YYYY-MM-DD against UTC-midnight off-by-one", () => {
  // Without the T00:00:00 guard this renders as Jun 29 in negative-offset zones.
  assert.equal(fmtDate("2026-06-30"), "Jun 30, 2026");
  assert.equal(fmtDate(null), "—");
});

test("daysBetween counts whole days, future positive", () => {
  assert.equal(daysBetween("2026-06-20", "2026-06-30"), 10);
  assert.equal(daysBetween("2026-06-30", "2026-06-20"), -10);
});
