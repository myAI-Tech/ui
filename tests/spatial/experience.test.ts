import { describe, expect, test } from "bun:test";

import { defineExperience, excludePane, pane, resolveDevice, type Arrangement } from "../../src/spatial/experience";
import { initialSpatialState } from "../../src/spatial/state";
import { defaultPhysics } from "../../src/spatial/tokens";
import type { Surface } from "../../src/spatial/device";

const surface = (slot: number): Surface => ({ x: slot * 390, y: 0, w: 390, h: 700, slot, side: slot ? "left" : "right", rail: false, floating: true, span: false });
const render = () => null;

describe("spatial arrangement contracts", () => {
  test("does not restore duplicate tabs when every pane is claimed", () => {
    const fixed = defineExperience({ id: "fixed", label: "Fixed", code: "FX", accent: "#fff", panes: [pane("code", "Code", render)] });
    const tabs = defineExperience({ id: "tabs", label: "Tabs", code: "TB", accent: "#fff", panes: [pane("code", "Code", render), pane("chat", "Chat", render)] });
    const other = defineExperience({ id: "other", label: "Other", code: "OT", accent: "#fff", panes: [pane("chat", "Chat", render)] });
    const state = initialSpatialState({ desktops: [{ slots: [{ experience: "fixed" }, { experience: "tabs" }] }] });
    const resolved = resolveDevice([
      { surface: surface(0), exp: fixed, project: "same", crease: null },
      { surface: surface(2), exp: other, project: "same", crease: null },
      { surface: surface(1), exp: tabs, project: "same", crease: null },
    ], 0, state, defaultPhysics);

    expect(resolved.get(1)).toEqual({ kind: "empty" });
  });

  test("removes a deck pane from its upper arrangement", () => {
    const arrangement: Arrangement = { kind: "banner", primary: "code", banners: ["guide"] };
    expect(excludePane(arrangement, "guide")).toEqual({ kind: "banner", primary: "code", banners: [] });
  });

  test("pins managed panes to a separating hinge", () => {
    const exp = defineExperience({ id: "split", label: "Split", code: "SP", accent: "#fff", panes: [pane("left", "Left", render), pane("right", "Right", render)] });
    const state = initialSpatialState({ desktops: [{ slots: [{ experience: "split" }] }], ratio: { split: 0.3 } });
    const spanned: Surface = { x: 0, y: 0, w: 1094, h: 720, slot: 0, side: "single", rail: true, floating: false, span: true,
      crease: { axis: "vertical", at: 547, width: 14, separating: true }, occlusion: { x: 540, y: 0, w: 14, h: 720 } };

    expect(resolveDevice([{ surface: spanned, exp, crease: 547 }], 0, state, defaultPhysics).get(0)).toMatchObject({ kind: "two", ratio: 0.5, snap: 0.5 });
  });
});
