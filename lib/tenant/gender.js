// The tenant Gender vocabulary, and the mark the UI draws for it.
//
// A JS-enforced picklist rather than a DB CHECK, following the same test the
// rest of the app uses: it only ever *displays* gender, it never *dispatches* on
// it. Values you branch on want a database constraint; values you render want
// the freedom to grow without a migration. Adding a third option is a one-line
// change here.
//
// The column is nullable and "" is valid: gender is optional, and a tenant
// recorded before this field existed has none. Unset draws no mark at all
// rather than a placeholder, so the symbol only ever means something.
export const GENDERS = ["male", "female"];

// Both the validator and the normalizer read a value through this, so they
// cannot disagree about what counts as blank. Keeping the trim in only one of
// them is how "   " ends up simultaneously invalid and empty.
const canonical = (gender) => (gender || "").trim().toLowerCase();

export const isValidGender = (gender) => {
  const g = canonical(gender);
  return !g || GENDERS.includes(g);
};

// Normalize for writing: turns anything unrecognized into null so a bad value
// can't reach the column from a seed script or a direct API call, not just from
// the dropdown.
export const normalizeGender = (gender) => {
  const g = canonical(gender);
  return GENDERS.includes(g) ? g : null;
};

// The Mars and Venus signs. Kept here beside the vocabulary so a new option
// can't be added without deciding how it renders -- the pairing is the point.
const MARKS = {
  male: { symbol: "♂", color: "#2563eb" },   // ♂ blue
  female: { symbol: "♀", color: "#db2777" }, // ♀ pink
};

// { symbol, color } for a gender, or null when there is nothing to draw.
// Callers that can only render text (an <option>, a title attribute) use
// `.symbol` alone and lose the colour; that is the intended degradation.
export const genderMark = (gender) => MARKS[normalizeGender(gender)] || null;
