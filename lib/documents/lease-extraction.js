// Values from document parsing are untrusted until a landlord has reviewed
// them. This module turns only the approved values into a safe import command.

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function approved(approvedFields, field) {
  return !approvedFields || approvedFields[field] === true;
}

function validDate(value, field) {
  const date = optionalString(value);
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date.`);
  }
  return date;
}

export function normalizePersonName(value) {
  const name = optionalString(value)?.replace(/\s+/g, " ");
  if (!name || name.length > 120 || !/^[\p{L}][\p{L}\p{M}\p{Zs}'.-]*$/u.test(name)) {
    throw new Error("Each approved tenant needs a valid name.");
  }
  return name;
}

function optionalEmail(value) {
  const email = optionalString(value);
  if (!email) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Approved email is malformed.");
  }
  return email;
}

function optionalPhone(value) {
  const phone = optionalString(value);
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!/^[0-9+().\-\s]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    throw new Error("Approved phone number is malformed.");
  }
  return phone;
}

function optionalProfileText(value, field) {
  const text = optionalString(value);
  if (!text) return null;
  if (text.length > 1000 || /[\u0000-\u001F]/.test(text)) throw new Error(`Approved ${field} is malformed.`);
  return text;
}

function optionalAge(value) {
  if (value === "" || value == null) return null;
  const age = Number(value);
  if (!Number.isInteger(age) || age < 0 || age > 125) throw new Error("Approved age is malformed.");
  return age;
}

function optionalStudentStatus(value) {
  const status = optionalString(value);
  if (!status) return null;
  if (!new Set(["undergrad", "masters", "phd", "none"]).has(status)) {
    throw new Error("Approved student status is malformed.");
  }
  return status;
}

function optionalRent(value) {
  if (value === "" || value == null) return null;
  const rent = Number(value);
  if (!Number.isFinite(rent) || rent <= 0) throw new Error("Approved rent amount must be greater than zero.");
  return rent;
}

function approvedPeople(extracted, selected) {
  const candidates = [extracted.tenant_name, ...(Array.isArray(extracted.housemates) ? extracted.housemates : [])]
    .filter((value) => value != null)
    .map(normalizePersonName);
  const selectedKeys = Array.isArray(selected)
    ? new Set(selected.map(normalizePersonName).map((name) => name.toLocaleLowerCase()))
    : new Set(candidates.map((name) => name.toLocaleLowerCase()));
  const people = candidates.filter((name) => selectedKeys.has(name.toLocaleLowerCase()));
  if (!people.length) throw new Error("Approve at least one person before applying this lease.");
  if (new Set(people.map((name) => name.toLocaleLowerCase())).size !== people.length) {
    throw new Error("The lease contains the same person more than once.");
  }
  return people;
}

// Returns the command used by process-lease. `primaryProfile` only carries
// personally identifying contact fields for the named primary tenant. The old
// loop copied one extracted email and phone number to every housemate.
export function reviewedLeaseImport(extracted, { approvedTenants, approvedFields } = {}) {
  if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
    throw new Error("Document extraction is missing or malformed.");
  }
  const people = approvedPeople(extracted, approvedTenants);
  const leaseRequested = approved(approvedFields, "lease_start_date") || approved(approvedFields, "rent_amount");
  const startDate = approved(approvedFields, "lease_start_date") ? validDate(extracted.lease_start_date, "Approved lease start date") : null;
  const endDate = approved(approvedFields, "lease_end_date") ? validDate(extracted.lease_end_date, "Approved lease end date") : null;
  const rentAmount = approved(approvedFields, "rent_amount") ? optionalRent(extracted.rent_amount) : null;

  if (leaseRequested && (!startDate || rentAmount == null)) {
    throw new Error("Creating a lease requires approved start date and rent amount.");
  }
  if (startDate && endDate && endDate < startDate) {
    throw new Error("Approved lease end date cannot precede the start date.");
  }

  const primaryProfile = {
    moveInDate: approved(approvedFields, "move_in_date") ? validDate(extracted.move_in_date, "Approved move-in date") : null,
    moveOutDate: approved(approvedFields, "move_out_date") ? validDate(extracted.move_out_date, "Approved move-out date") : null,
    email: approved(approvedFields, "email") ? optionalEmail(extracted.email) : null,
    phone: approved(approvedFields, "phone") ? optionalPhone(extracted.phone) : null,
    homeAddress: approved(approvedFields, "home_address") ? optionalProfileText(extracted.home_address, "home address") : null,
    age: approved(approvedFields, "age") ? optionalAge(extracted.age) : null,
    studentStatus: approved(approvedFields, "student_status") ? optionalStudentStatus(extracted.student_status) : null,
    studentYear: approved(approvedFields, "student_year") ? optionalProfileText(extracted.student_year, "student year") : null,
    zelleName: approved(approvedFields, "zelle_name") ? optionalProfileText(extracted.zelle_name, "Zelle name") : null,
    hasCosigner: approved(approvedFields, "has_cosigner") && typeof extracted.has_cosigner === "boolean"
      ? extracted.has_cosigner
      : null,
  };

  return {
    people,
    primaryName: normalizePersonName(extracted.tenant_name),
    primaryProfile,
    contract: leaseRequested ? { startDate, endDate, rentAmount } : null,
  };
}
