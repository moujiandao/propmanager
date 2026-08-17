const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const monthRange = (month) => {
  const match = MONTH_PATTERN.exec(month || "");
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, monthNumber - 1, 1))),
  };
};

const belongsToUnit = (tenant, unit) => {
  if (tenant.unitId) return tenant.unitId === unit.id;
  return tenant.propertyId === unit.propertyId
    && String(tenant.unit || "").trim() === String(unit.unitNumber || "").trim();
};

const unique = (values) => [...new Set(values)];

const occupantsForMonth = (tenants, unit, month) => {
  const range = monthRange(month);
  if (!range) return [];
  return tenants.filter((tenant) => belongsToUnit(tenant, unit)
    && (!tenant.moveInDate || tenant.moveInDate <= range.end)
    && (!tenant.moveOutDate || tenant.moveOutDate >= range.start));
};

const recipientKey = (tenants) => tenants
  .map((tenant) => tenant.id || `${tenant.name || ""}|${tenant.email || ""}`)
  .sort()
  .join(",");

export const isGeneratorTableComplete = (rows = []) => rows.length > 0 && rows.every((row) =>
  row.unitId
  && MONTH_PATTERN.test(row.month || "")
  && String(row.amount ?? "").trim() !== ""
  && Number.isFinite(Number(row.amount))
  && Number(row.amount) >= 0);

export function availableGeneratorUnits(units = [], properties = []) {
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  return units.filter((unit) => propertyById.get(unit.propertyId)?.inProduction !== false);
}

export function buildGeneratorRow({ tenants = [], unit = {}, month = "", amount = "" } = {}) {
  const range = monthRange(month);
  const occupants = occupantsForMonth(tenants, unit, month);
  const names = unique(occupants.map((tenant) => String(tenant.name || "").trim()).filter(Boolean));
  const emails = unique(occupants.map((tenant) => String(tenant.email || "").trim()).filter(Boolean));

  return {
    mergeValues: {
      name: new Intl.ListFormat("en", { type: "conjunction" }).format(names),
      unit_number: String(unit.unitNumber || ""),
      month_year: range?.label || "",
      amount: amount == null ? "" : String(amount),
    },
    emailAddresses: emails.join(", "),
    missingEmailNames: occupants
      .filter((tenant) => !String(tenant.email || "").trim())
      .map((tenant) => String(tenant.name || "").trim())
      .filter(Boolean),
  };
}

export function buildGeneratorGroups({ rows = [], units = [], tenants = [] } = {}) {
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const groups = new Map();

  for (const row of rows) {
    const unit = unitById.get(row.unitId);
    if (!unit) continue;
    const occupants = occupantsForMonth(tenants, unit, row.month);
    const key = `${unit.id}|${recipientKey(occupants)}`;
    const details = buildGeneratorRow({ tenants, unit, month: row.month, amount: row.amount });
    if (!groups.has(key)) {
      groups.set(key, { unitId: unit.id, details, items: [] });
    }
    groups.get(key).items.push({ month: row.month, label: details.mergeValues.month_year, amount: Number(row.amount) });
  }

  return [...groups.values()].map(({ unitId, details, items }) => {
    const ordered = items.sort((a, b) => a.month.localeCompare(b.month));
    return {
      unitId,
      mergeValues: {
        ...details.mergeValues,
        month_year: unique(ordered.map((item) => item.label)).join(", "),
        amount: ordered.reduce((total, item) => total + item.amount, 0).toFixed(2),
        bill_lines: ordered.map((item) => `${item.label}: $${item.amount.toFixed(2)}`).join("\n"),
      },
      emailAddresses: details.emailAddresses,
      missingEmailNames: details.missingEmailNames,
    };
  });
}
