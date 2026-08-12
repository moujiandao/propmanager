import { test } from "node:test";
import assert from "node:assert/strict";
import { lotLayout, ZONE_TYPES } from "./layout.js";
import { SPOT_TYPES } from "./status.js";

// The angle the bank is expected to stripe at, stated here rather than imported
// from layout.js -- importing it would make the assertion agree with itself.
const BAY_ANGLE = 60;

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

test("a zone with exactly one spot lays out without dividing by zero", () => {
  const heightOf = (s) => {
    const ys = s.points.split(" ").map((p) => Number(p.split(",")[1]));
    return Math.max(...ys) - Math.min(...ys);
  };

  const one = lotLayout([spot("1", LEFT)]);
  assert.equal(one.stalls.length, 1);
  assert.ok(Number.isFinite(heightOf(one.stalls[0])), "height must not be NaN or Infinity");
  // Capped rather than stretched to the whole lot: a lone head-in stall is
  // still just a stall. It sits centred in the column instead.
  assert.ok(heightOf(one.stalls[0]) <= 56.01, `single straight stall should keep its size, got ${heightOf(one.stalls[0])}`);

  // The angled bank has no such cap -- one bay does take the whole run, since
  // the bank's length is what the pitch divides.
  const bank = lotLayout([spot("1", RIGHT)]);
  assert.equal(bank.stalls.length, 1);
  assert.ok(Number.isFinite(heightOf(bank.stalls[0])), "height must not be NaN or Infinity");
  assert.ok(heightOf(bank.stalls[0]) > bank.outline.h * 0.8, "a single bay still fills the bank");
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

// The four edges of a stall, as [dx, dy] vectors around the polygon.
const edgesOf = (s) => {
  const pts = s.points.split(" ").map((p) => p.split(",").map(Number));
  return pts.map(([x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length];
    return [nx - x, ny - y];
  });
};

// The stall's angle to the aisle, in the usual parking sense: the aisle runs
// vertical, so it's how far the stripe leans off vertical. 90° would be head-in.
const stripeAngle = ([dx, dy]) => (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;

test("an angled bay is striped to the aisle at its configured angle, between vertical aisle and wall edges", () => {
  const { stalls } = lotLayout(RIDGE_RD);
  const edges = edgesOf(stalls.find((s) => s.zone === "right"));

  // Two edges stand straight up (the aisle a car backs into, and the wall it
  // noses toward); the other two are the stripes, which climb as far as they
  // climb. This orientation is the point: with the stripes horizontal and the
  // ends slanted instead -- the transpose -- the bank reads as tilted boxes.
  const vertical = edges.filter(([dx]) => Math.abs(dx) < 0.01);
  const slanted = edges.filter(([dx]) => Math.abs(dx) >= 0.01);
  assert.equal(vertical.length, 2, "aisle and wall edges are vertical");
  assert.equal(slanted.length, 2, "the other two edges are the stripes");
  for (const edge of slanted) {
    assert.ok(Math.abs(stripeAngle(edge) - BAY_ANGLE) < 0.01, `stripe should meet the aisle at ${BAY_ANGLE}°, got ${stripeAngle(edge).toFixed(2)}°`);
  }

  const left = edgesOf(stalls.find((s) => s.zone === "left"));
  assert.equal(left.filter(([dx]) => Math.abs(dx) < 0.01).length, 2, "straight stalls are rectangles");
  assert.equal(left.filter(([, dy]) => Math.abs(dy) < 0.01).length, 2, "straight stalls are rectangles");
});

test("the stripes hold their angle whatever the spot count, and the bank still fills its column", () => {
  for (const n of [1, 4, 7, 12]) {
    const spots = Array.from({ length: n }, (_, i) => ({ id: `r${i}`, label: String(i + 1), type: RIGHT }));
    const { stalls, outline } = lotLayout(spots);
    assert.equal(stalls.length, n);

    // The angle is a property of the bank's depth, not of how many bays share
    // it, so no spot count can flatten it -- the failure the old fixed skew had.
    for (const s of stalls) {
      for (const edge of edgesOf(s).filter(([x]) => Math.abs(x) >= 0.01)) {
        assert.ok(Math.abs(stripeAngle(edge) - BAY_ANGLE) < 0.01, `${n} spots: stripe is ${stripeAngle(edge).toFixed(2)}°, not ${BAY_ANGLE}°`);
      }
    }

    const ys = stalls.flatMap((s) => s.points.split(" ").map((p) => Number(p.split(",")[1])));
    assert.ok(Math.min(...ys) >= outline.y, `${n} spots: bank spills above the lot`);
    assert.ok(Math.max(...ys) <= outline.y + outline.h, `${n} spots: bank spills below the lot`);
  }
});

test("every stall carries a car block that sits inside its own bay", () => {
  const { stalls } = lotLayout(RIDGE_RD);
  for (const s of stalls) {
    const bay = s.points.split(" ").map((p) => p.split(",").map(Number));
    const car = s.car.split(" ").map((p) => p.split(",").map(Number));
    assert.equal(car.length, bay.length, `${s.label}: car should mirror the bay's shape`);

    const bx = bay.map(([x]) => x), by = bay.map(([, y]) => y);
    for (const [x, y] of car) {
      assert.ok(x >= Math.min(...bx) - 0.01 && x <= Math.max(...bx) + 0.01, `${s.label}: car escapes its bay`);
      assert.ok(y >= Math.min(...by) - 0.01 && y <= Math.max(...by) + 0.01, `${s.label}: car escapes its bay`);
    }
    // It has to actually be smaller, or "occupied" would just refill the bay.
    const span = (pts, i) => Math.max(...pts.map((p) => p[i])) - Math.min(...pts.map((p) => p[i]));
    assert.ok(span(car, 0) < span(bay, 0), `${s.label}: car is no narrower than its bay`);
    assert.ok(span(car, 1) < span(bay, 1), `${s.label}: car is no shorter than its bay`);
  }
});

test("an angled bay is wide enough not to read as a sliver", () => {
  const { stalls } = lotLayout(RIDGE_RD);
  const bay = stalls.find((s) => s.zone === "right").points.split(" ").map((p) => p.split(",").map(Number));
  const depth = Math.max(...bay.map(([x]) => x)) - Math.min(...bay.map(([x]) => x));
  // The bay's own share of the aisle: its full vertical extent, less the climb
  // the stripes spend crossing the bank. The two verticals are the aisle edge,
  // so their length IS the pitch -- measuring it is just cheaper than finding
  // them, and it cross-checks the climb at the same time.
  const climb = Math.max(...bay.map(([, y]) => y)) - Math.min(...bay.map(([, y]) => y));
  const pitch = climb - depth / Math.tan((BAY_ANGLE * Math.PI) / 180);

  // The bays were called out as too skinny at a pitch of ~32 against a depth of
  // 50. They are deliberately chunky now -- wider along the aisle than the bank
  // is deep -- so this guards the readability, not a particular number.
  assert.ok(pitch > depth, `a bay should be wider along the aisle than the bank is deep, got pitch ${pitch.toFixed(1)} vs depth ${depth}`);
  assert.ok(pitch > 60, `bays should stay chunky, got a pitch of ${pitch.toFixed(1)}`);
});

test("straight stalls keep their size when the lot stretches for the angled bank", () => {
  // The lot is long because the angled bank eats length, not because the head-in
  // stalls want to be ribbons. Five of them in a 564-tall lot would be ~108
  // each if they just divided the space.
  const { stalls, outline } = lotLayout(RIDGE_RD);
  const left = stalls.filter((s) => s.zone === "left");
  for (const s of left) {
    const ys = s.points.split(" ").map((p) => Number(p.split(",")[1]));
    const h = Math.max(...ys) - Math.min(...ys);
    assert.ok(h <= 56.01, `${s.label} stretched to ${h}`);
  }

  // ...and the run sits centred in the lot rather than pinned to one end.
  const allYs = left.flatMap((s) => s.points.split(" ").map((p) => Number(p.split(",")[1])));
  const gapAbove = Math.min(...allYs) - outline.y;
  const gapBelow = outline.y + outline.h - Math.max(...allYs);
  assert.ok(Math.abs(gapAbove - gapBelow) < 0.01, `column should be centred, got ${gapAbove} above and ${gapBelow} below`);
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
