import { test } from "node:test";
import assert from "node:assert/strict";
import { lotLayout, ZONE_TYPES } from "./layout.js";
import { SPOT_TYPES } from "./status.js";

const LEFT = "left side (straight)";
const RIGHT = "right side (diagonal)";
const BACK = "back side (straight)";

const spot = (label, type) => ({ id: `s${label}`, label, type });

// The lot as actually surveyed at Ridge Rd: 14 spots, 7 angled on the right,
// 2 across the back, 5 straight on the left.
const RIDGE_RD = [
  ...["1", "2", "3", "4", "5", "6", "7"].map((l) => spot(l, RIGHT)),
  ...["8", "9"].map((l) => spot(l, BACK)),
  ...["10", "11", "12", "13", "14"].map((l) => spot(l, LEFT)),
];

const byLabel = (stalls) => Object.fromEntries(stalls.map((s) => [s.label, s]));

test("ZONE_TYPES covers every SPOT_TYPES value exactly once", () => {
  // The mapping is derived from the vocabulary rather than retyped, so this
  // guards the derivation: adding a type must not silently collide or vanish.
  assert.deepEqual(Object.values(ZONE_TYPES).sort(), [...SPOT_TYPES].sort());
  assert.equal(ZONE_TYPES.left, LEFT);
  assert.equal(ZONE_TYPES.right, RIGHT);
  assert.equal(ZONE_TYPES.back, BACK);
});

test("each SPOT_TYPES value lands in its matching zone", () => {
  const { stalls } = lotLayout([spot("1", RIGHT), spot("2", BACK), spot("3", LEFT)]);
  const s = byLabel(stalls);
  assert.equal(s["1"].zone, "right");
  assert.equal(s["2"].zone, "back");
  assert.equal(s["3"].zone, "left");
});

test('numeric label ordering: "10" sorts after "9", not after "1"', () => {
  // Labels are strings, so a naive localeCompare would order 1, 10, 2 ... and
  // put spot 10 second from the top instead of last. This is the bug the
  // numeric collator exists to prevent.
  const { stalls } = lotLayout(
    ["9", "10", "1", "2"].map((l) => spot(l, LEFT)),
  );
  assert.deepEqual(
    [...stalls].sort((a, b) => a.labelY - b.labelY).map((s) => s.label),
    ["1", "2", "9", "10"],
  );
});

test("left column ascends top-to-bottom (10 at the back wall, 14 at the street)", () => {
  const { stalls } = lotLayout(RIDGE_RD);
  const left = stalls.filter((s) => s.zone === "left").sort((a, b) => a.labelY - b.labelY);
  assert.deepEqual(left.map((s) => s.label), ["10", "11", "12", "13", "14"]);
});

test("right column descends top-to-bottom (7 at the back wall, 1 at the entrance)", () => {
  // Deliberately the reverse of the left column -- it matches how the physical
  // angled stalls are numbered, so the diagram must not "helpfully" normalize it.
  const { stalls } = lotLayout(RIDGE_RD);
  const right = stalls.filter((s) => s.zone === "right").sort((a, b) => a.labelY - b.labelY);
  assert.deepEqual(right.map((s) => s.label), ["7", "6", "5", "4", "3", "2", "1"]);
});

test("back row descends left-to-right (9 then 8) and is centered above the lot", () => {
  const { stalls, outline } = lotLayout(RIDGE_RD);
  const back = stalls.filter((s) => s.zone === "back").sort((a, b) => a.labelX - b.labelX);
  assert.deepEqual(back.map((s) => s.label), ["9", "8"]);

  // The row straddles the lot's horizontal midpoint.
  const mid = outline.x + outline.w / 2;
  assert.equal((back[0].labelX + back[1].labelX) / 2, mid);
  assert.ok(back[0].labelY < outline.y, "back row sits above the lot boundary");
});

test("untyped and unrecognized-type spots go to unplaced, in ascending label order", () => {
  const { stalls, unplaced } = lotLayout([
    spot("10", ""),
    spot("2", "front side (diagonal)"),
    spot("9", LEFT),
  ]);
  assert.deepEqual(stalls.map((s) => s.label), ["9"]);
  // Ascending, and numeric here too -- 2 before 10.
  assert.deepEqual(unplaced.map((s) => s.label), ["2", "10"]);
  // The original objects are passed through untouched so the caller can render
  // them as a plain "not on the map yet" list.
  assert.equal(unplaced[1].type, "");
});

test("empty input yields no stalls, a usable viewBox, and no NaN", () => {
  const layout = lotLayout([]);
  assert.deepEqual(layout.stalls, []);
  assert.deepEqual(layout.unplaced, []);
  for (const n of [layout.width, layout.height, layout.outline.x, layout.outline.y, layout.outline.w, layout.outline.h]) {
    assert.ok(Number.isFinite(n), `expected a finite number, got ${n}`);
  }
  assert.ok(layout.width > 0 && layout.height > 0, "the viewBox must have positive extent");
  // Null / undefined must not throw either -- data can arrive before the fetch.
  assert.deepEqual(lotLayout(undefined).stalls, []);
  assert.deepEqual(lotLayout(null).stalls, []);
});

test("a zone with exactly one spot fills the column without dividing by zero", () => {
  const { stalls, outline } = lotLayout([spot("1", LEFT)]);
  assert.equal(stalls.length, 1);
  const ys = stalls[0].points.split(" ").map((p) => Number(p.split(",")[1]));
  const height = Math.max(...ys) - Math.min(...ys);
  assert.ok(Number.isFinite(height), "height must not be NaN or Infinity");
  // One spot spans (nearly) the whole lot rather than a 1/14th sliver.
  assert.ok(height > outline.h * 0.8, `single stall should fill the column, got ${height}`);
});

test("every stall's points string parses to 4 finite coordinate pairs", () => {
  // Cheap NaN guard: a single NaN in the points attribute makes the polygon
  // silently render as nothing, which is invisible in a screenshot review.
  const { stalls } = lotLayout(RIDGE_RD);
  for (const s of stalls) {
    const pairs = s.points.split(" ");
    assert.equal(pairs.length, 4, `${s.label} should be a quadrilateral`);
    for (const pair of pairs) {
      const [x, y] = pair.split(",").map(Number);
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `${s.label} has a bad point: ${pair}`);
    }
    assert.ok(Number.isFinite(s.labelX) && Number.isFinite(s.labelY), `${s.label} has a bad anchor`);
    assert.equal(typeof s.id, "string");
  }
});

test("diagonal stalls are parallelograms with a visible slant; straight ones are rectangles", () => {
  const { stalls } = lotLayout(RIDGE_RD);
  const topX = (s) => {
    const pts = s.points.split(" ").map((p) => p.split(",").map(Number));
    const minY = Math.min(...pts.map(([, y]) => y));
    return Math.min(...pts.filter(([, y]) => y === minY).map(([x]) => x));
  };
  const bottomX = (s) => {
    const pts = s.points.split(" ").map((p) => p.split(",").map(Number));
    const maxY = Math.max(...pts.map(([, y]) => y));
    return Math.min(...pts.filter(([, y]) => y === maxY).map(([x]) => x));
  };

  const right = stalls.find((s) => s.zone === "right");
  const skew = topX(right) - bottomX(right);
  assert.ok(skew >= 20 && skew <= 25, `slant should read clearly at small sizes, got ${skew}`);

  const left = stalls.find((s) => s.zone === "left");
  assert.equal(topX(left), bottomX(left), "straight stalls have no slant");
});

test("the 14-spot Ridge Rd lot produces 14 stalls and nothing unplaced", () => {
  const { stalls, unplaced } = lotLayout(RIDGE_RD);
  assert.equal(stalls.length, 14);
  assert.equal(unplaced.length, 0);
  assert.deepEqual(
    { left: stalls.filter((s) => s.zone === "left").length, right: stalls.filter((s) => s.zone === "right").length, back: stalls.filter((s) => s.zone === "back").length },
    { left: 5, right: 7, back: 2 },
  );
  // Ids are passed straight through so the renderer can key on them and wire
  // click handlers back to the spot record.
  assert.deepEqual([...stalls.map((s) => s.id)].sort(), [...RIDGE_RD.map((s) => s.id)].sort());
});

test("stalls within a column do not overlap and stay inside the lot boundary", () => {
  const { stalls, outline } = lotLayout(RIDGE_RD);
  for (const zone of ["left", "right"]) {
    const col = stalls.filter((s) => s.zone === zone).sort((a, b) => a.labelY - b.labelY);
    for (const s of col) {
      const xs = s.points.split(" ").map((p) => Number(p.split(",")[0]));
      assert.ok(Math.min(...xs) >= outline.x, `${s.label} spills past the left edge`);
      assert.ok(Math.max(...xs) <= outline.x + outline.w, `${s.label} spills past the right edge`);
    }
    for (let i = 1; i < col.length; i++) {
      assert.ok(col[i].labelY > col[i - 1].labelY, `${zone} stalls must not stack on top of each other`);
    }
  }
});
