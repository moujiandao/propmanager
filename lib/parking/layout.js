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
// Taller than the lot itself: the back row parks above it, outside the boundary.
const HEIGHT = 380;

// The lot boundary. It sits below the back row (which parks *outside* the lot,
// against the far wall) and is open at the bottom, where cars enter.
const OUTLINE = { x: 10, y: 70, w: 400, h: 300 };

const INSET = 12; // breathing room between the stalls and the boundary
const COL_W = 90;
// Depth of the angled bank: the distance a car noses in, from the aisle edge to
// the wall. Shallower than the straight column because at 45° the bank also
// spends this much of the lot's *height* on the stripes' climb -- every unit of
// depth is a unit of height the bays don't get to share as pitch. That trade is
// what sets how skinny a bay looks: real 45° parking runs about 0.7 pitch per
// unit of depth, and this depth against the column's height lands near there.
const RIGHT_DEPTH = 50;
const BACK_W = 70;
const BACK_H = 55;
const BACK_GAP = 5; // gap between the back row and the top of the lot

const COL_TOP = OUTLINE.y + INSET;
const COL_BOTTOM = OUTLINE.y + OUTLINE.h - INSET;
const LEFT_X = OUTLINE.x + INSET;
const WALL_X = OUTLINE.x + OUTLINE.w - INSET;   // the angled bank's far edge
const AISLE_X = WALL_X - RIGHT_DEPTH;           // the edge cars back out into
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
// How much of a bay the parked car takes up. Occupancy is drawn as this block
// rather than by filling the whole bay, so a lot reads the way a real one does:
// you see the cars, and the empty bays are the gaps between them.
const CAR_SCALE = 0.62;

const centroid = (corners) => {
  const sum = corners.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / corners.length, sum[1] / corners.length];
};

const toPoints = (corners) => corners.map(([x, y]) => `${round2(x)},${round2(y)}`).join(" ");

// Shrunk uniformly toward the bay's own centre, so the car inherits the bay's
// shape and angle for free -- an angled bay gets an angled car, and there is no
// second place where the lean is computed and could disagree.
const shrink = (corners, f) => {
  const [cx, cy] = centroid(corners);
  return corners.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
};

function stall(spot, zone, corners) {
  const [cx, cy] = centroid(corners);
  return {
    id: spot.id,
    label: spot.label,
    zone,
    points: toPoints(corners),
    car: toPoints(shrink(corners, CAR_SCALE)),
    labelX: round2(cx),
    labelY: round2(cy),
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
    return stall(spot, zone, corners(top, top + h, h));
  });
}

const leftCorners = (top, bottom) => [
  [LEFT_X, top],
  [LEFT_X + COL_W, top],
  [LEFT_X + COL_W, bottom],
  [LEFT_X, bottom],
];

// The angled bank. Each bay is bounded by two parallel 45° stripes and by the
// aisle and wall, which are VERTICAL -- that orientation is the whole thing.
// An earlier version stacked bays with horizontal dividers and slanted ends,
// which is the transpose of real angled parking and read as a pile of tilted
// boxes; here the stripes lean and the two long edges stand straight up, the
// way a bank of 45° stalls actually stripes out.
//
// At 45° a stripe climbs exactly as far as it runs, so the bank spends
// RIGHT_DEPTH of the lot's height on that climb before the first bay gets any
// room. Whatever is left over is shared out as the along-aisle pitch, so the
// bank always fills the column exactly however many spots it holds.
//
// Bays are laid bottom-up: i = 0 sits at the entrance end, matching the
// physical numbering (1 at the entrance, 7 at the back wall).
function angledBank(spots) {
  if (!spots.length) return [];
  const pitch = (COL_BOTTOM - COL_TOP - RIGHT_DEPTH) / spots.length;
  return spots.map((spot, i) => {
    const y = COL_BOTTOM - i * pitch;   // this bay's aisle-side lower corner
    return stall(spot, "right", [
      [AISLE_X, y],
      [AISLE_X, y - pitch],
      [WALL_X, y - pitch - RIGHT_DEPTH],
      [WALL_X, y - RIGHT_DEPTH],
    ]);
  });
}

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

  // Ordering matches the physical lot, which is why the zones disagree:
  // walking in from the entrance the left-hand numbers climb away from you
  // (10 nearest the back wall → 14 nearest the street), while the angled
  // right-hand stalls were numbered from the entrance inward. The back row
  // reads 9 then 8 left-to-right for the same reason. Sorting is always
  // ascending; the right bank needs no reversal because angledBank lays its
  // bays bottom-up, which puts 1 at the entrance on its own.
  const stalls = [
    ...stackColumn(zones.left, "left", leftCorners),
    ...angledBank(zones.right),
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
