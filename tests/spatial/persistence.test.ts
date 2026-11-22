import { describe, expect, test } from "bun:test";

import { decodeSpatialSnapshot, normalizeSpatialState } from "../../src/spatial/persistence";

describe("spatial snapshot decoding", () => {
  test("rejects snapshots with no usable desktops", () => {
    expect(normalizeSpatialState({ desktops: [] })).toBeNull();
    expect(decodeSpatialSnapshot({ v: 1, at: Date.now(), angle: 100, state: { desktops: [] } }, 60_000)).toBeNull();
  });

  test("normalizes indices, ratios, and missing arrangement memory", () => {
    const state = normalizeSpatialState({
      desktops: [{ id: "desk", slots: [{ experience: "home" }], focus: 9, tileRatio: 4, tiles: 9 }],
      active: 5,
    });

    expect(state?.active).toBe(0);
    expect(state?.desktops[0]).toMatchObject({ id: "desk", focus: 0, tileRatio: 0.75, tiles: 4 });
    expect(state?.overlays).toEqual({});
  });

  test("holds finite restored angles inside physical bounds", () => {
    const now = Date.now();
    const snapshot = decodeSpatialSnapshot({ v: 1, at: now, angle: 240, posture: "book", orientation: "portrait" }, 60_000, now);
    expect(snapshot?.angle).toBe(180);
    expect(decodeSpatialSnapshot({ v: 1, at: now, angle: Number.NaN }, 60_000, now)).toBeNull();
  });
});
