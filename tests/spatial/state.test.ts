import { describe, expect, test } from "bun:test";

import { initialSpatialState, spatialReducer } from "../../src/spatial/state";

describe("spatial workspace controls", () => {
  test("divided desktops retain independent swipe scope", () => {
    const initial = initialSpatialState({ desktops: [{ slots: [{ experience: "home" }, { experience: "guide" }] }] });
    const divided = spatialReducer(spatialReducer(initial, { type: "setInner", inner: "split" }), { type: "setSwipeScope", scope: "slot" });

    expect(divided.desktops[0]).toMatchObject({ inner: "split", swipeScope: "slot" });
  });

  test("locked desktops reject activity reassignment but can be unlocked", () => {
    const initial = initialSpatialState({ desktops: [{ slots: [{ experience: "home" }, { experience: "guide" }] }] });
    const locked = spatialReducer(initial, { type: "setLocked", locked: true });
    const rejected = spatialReducer(locked, { type: "setExperience", slot: 0, id: "terminal" });
    const rejectedSwap = spatialReducer(rejected, { type: "swapHalves" });
    const forcedHome = spatialReducer(rejectedSwap, { type: "setExperience", slot: 0, id: "landing", force: true });
    const unlocked = spatialReducer(rejectedSwap, { type: "setLocked", locked: false });
    const changed = spatialReducer(unlocked, { type: "setExperience", slot: 0, id: "terminal" });

    expect(rejected.desktops[0].slots[0].experience).toBe("home");
    expect(rejectedSwap.desktops[0].slots.map(slot => slot.experience)).toEqual(["home", "guide"]);
    expect(forcedHome.desktops[0].slots[0].experience).toBe("landing");
    expect(changed.desktops[0].slots[0].experience).toBe("terminal");
  });

  test("persists overlay position in app-owned state", () => {
    const initial = initialSpatialState({ desktops: [{ slots: [{ experience: "home" }] }] });
    const next = spatialReducer(initial, { type: "setOverlay", id: "chat", overlay: { x: 24, y: 40, minimized: true } });

    expect(next.overlays.chat).toEqual({ x: 24, y: 40, minimized: true });
  });
});
