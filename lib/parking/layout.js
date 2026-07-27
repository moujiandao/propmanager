// Geometry for the parking-lot diagram. Pure, React-free and DOM-free: it turns
// a list of mapped spots (lib/parking/mappers.js) into positioned SVG polygons,
// so the shape of the lot is unit-testable and the renderer stays a dumb map
// over `stalls`. Same reasoning as lib/parking/status.js -- the rules that are
// easy to get subtly wrong (ordering, zone assignment, divide-by-zero) belong
// somewhere `node --test` can reach them.
//
// The numbers below are an arbitrary internal coordinate space; the SVG scales
// via viewBox, so only their relationships matter, not their absolute size.

import { SPOT_TYPES } from "./status.js";

const WIDTH = 420;
const HEIGHT = 340;

// The lot boundary. It sits below the back row (which parks *outside* the lot,
// against the far wall) and is open at the bottom, where cars enter.
const OUTLINE = { x: 10, y: 70, w: 400, h: 260 };

const INSET = 12; // breathing room between the stalls and the boundary
const COL_W = 90;
// Horizontal offset between a diagonal stall's top and bottom edges. ~22 is
// enough slant to read as angled parking at thumbnail size without the
// parallelograms looking like a rendering bug.
const SKEW = 22;
const BACK_W = 70;
const BACK_H = 55;
const BACK_GAP = 5; // gap between the back row and the top of the lot

const COL_TOP = OUTLINE.y + INSET;
const COL_BOTTOM = OUTLINE.y + OUTLINE.h - INSET;
const LEFT_X = OUTLINE.x + INSET;
// Anchored from the right edge, then pulled in by the skew so the *widest*
// point of the parallelogram (its top-right corner) still lands inside the lot.
const RIGHT_X = OUTLINE.x + OUTLINE.w - INSET - COL_W - SKEW;
const BACK_TOP = OUTLINE.y - BACK_GAP - BACK_H;
const BACK_CENTER_X = OUTLINE.x + OUTLINE.w / 2;

// zone key → the SPOT_TYPES value it renders. Derived from the vocabulary rather
// than retyping the strings, so the two can't drift; every SPOT_TYPES entry is
// literally "<zone> side (<shape>)". Exported for the renderer's zone labels.
export const ZONE_TYPES = Object.fromEntries(
  SPOT_TYPES.map((type) => [type.split(" ")[0], type]),
);

const ZONE_OF_TYPE = Object.fromEntries(
  Object.entries(ZONE_TYPES).map(([zone, type]) => [type, zone]),
);

// Only these three zones have geometry. A spot whose type is new to SPOT_TYPES
// but not drawn here falls through to `unplaced` instead of vanishing.
const DRAWN_ZONES = ["left", "right", "back"];

const round2 = (n) => Math.round(n * 100) / 100;

// Labels are strings in the database but numeric in practice, so "10" has to
// sort after "9" -- a plain string compare would put it after "1". Same
// comparator the spot cards in property-management-app.jsx use. Non-numeric
// labels ("A12", "") fall back to normal collation instead of throwing.
const byLabel = (a, b) =>
  String(a?.label ?? "").localeCompare(String(b?.label ?? ""), undefined, { numeric: true });

// Build a stall from its four corners, so the polygon and the text anchor are
// guaranteed to describe the same shape (the anchor is the corners' centroid,
// which is the true center for both rectangles and parallelograms).
function stall(spot, zone, corners) {
  const sum = corners.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return {
    id: spot.id,
    label: spot.label,
    zone,
    points: corners.map(([x, y]) => `${round2(x)},${round2(y)}`).join(" "),
    labelX: round2(sum[0] / corners.length),
    labelY: round2(sum[1] / corners.length),
  };
}

// Stack `spots` down a column, splitting the column's height evenly among them
// so any count fills the same space. Empty input returns [] before the divide,
// which is the divide-by-zero guard.
function stackColumn(spots, zone, corners) {
  if (!spots.length) return [];
  const h = (COL_BOTTOM - COL_TOP) / spots.length;
  return spots.map((spot, i) => {
    const top = COL_TOP + i * h;
    return stall(spot, zone, corners(top, top + h));
  });
}

const leftCorners = (top, bottom) => [
  [LEFT_X, top],
  [LEFT_X + COL_W, top],
  [LEFT_X + COL_W, bottom],
  [LEFT_X, bottom],
];

// The top edge is shifted right of the bottom edge, giving the "/" lean of the
// angled stalls in the lot.
const rightCorners = (top, bottom) => [
  [RIGHT_X + SKEW, top],
  [RIGHT_X + SKEW + COL_W, top],
  [RIGHT_X + COL_W, bottom],
  [RIGHT_X, bottom],
];

// The back row is a short horizontal strip centered on the lot's midpoint --
// it spans the gap between the two columns rather than either column's width.
function backRow(spots) {
  const startX = BACK_CENTER_X - (spots.length * BACK_W) / 2;
  return spots.map((spot, i) => {
    const x = startX + i * BACK_W;
    return stall(spot, "back", [
      [x, BACK_TOP],
      [x + BACK_W, BACK_TOP],
      [x + BACK_W, BACK_TOP + BACK_H],
      [x, BACK_TOP + BACK_H],
    ]);
  });
}

export function lotLayout(spots) {
  const all = Array.isArray(spots) ? spots : [];

  const zones = { left: [], right: [], back: [], unplaced: [] };
  for (const spot of all) {
    const zone = ZONE_OF_TYPE[spot?.type];
    zones[DRAWN_ZONES.includes(zone) ? zone : "unplaced"].push(spot);
  }
  for (const key of Object.keys(zones)) zones[key].sort(byLabel);

  // Ordering matches the physical lot, which is why the two columns disagree:
  // walking in from the entrance the left-hand numbers climb away from you
  // (10 nearest the back wall → 14 nearest the street), while the angled
  // right-hand stalls were numbered from the entrance inward, so 1 sits at the
  // bottom and 7 at the top. The back row reads 9 then 8 left-to-right for the
  // same reason. Sorting is always ascending; only the reversal differs.
  const stalls = [
    ...stackColumn(zones.left, "left", leftCorners),
    ...stackColumn([...zones.right].reverse(), "right", rightCorners),
    ...backRow([...zones.back].reverse()),
  ];

  return {
    width: WIDTH,
    height: HEIGHT,
    outline: { ...OUTLINE },
    stalls,
    unplaced: zones.unplaced,
  };
}
