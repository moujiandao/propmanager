// The payment vocabularies.
//
// Enforced in JS rather than as DB CHECK constraints, but for a different
// reason than the parking module's spot `type`: the app genuinely DOES dispatch
// on status (the month grid keys itself on `completed`), so by the rule in
// CLAUDE.md this one has earned a database constraint. It doesn't have one
// today, and adding it to a table with live rows is a schema decision rather
// than a code one, so the picklist holds the line at every write path in the
// meantime. If that CHECK ever lands, this list is what it should be built from.
export const PAYMENT_STATUSES = ["pending", "completed", "failed"];
// "parking" marks a payment against the tenant's parking lease rather than
// their rent. The month grid keys its two checkbox rows on this, and the
// dashboard's "who has paid rent this month" must not count a parking-only
// payment, so both go through isRentPayment/isParkingPayment below.
export const PAYMENT_TYPES = ["recurring", "one-time", "parking"];

export const isValidPaymentStatus = (s) => PAYMENT_STATUSES.includes(s);
export const isValidPaymentType = (t) => !t || PAYMENT_TYPES.includes(t);

// A payment counts as settled when it is completed. The month grid's checkbox
// means exactly this, so the two can't drift apart.
export const isPaid = (payment) => payment?.status === "completed";

// Parking vs rent. Every pre-existing row (type null/recurring/one-time) is
// rent, so the rent predicate is the negative: a row is rent unless it says
// parking. Written once here so the grid, the dashboard and the summary route
// can't drift on what counts as "paid rent".
export const isParkingPayment = (payment) => payment?.type === "parking";
export const isRentPayment = (payment) => !!payment && !isParkingPayment(payment);
