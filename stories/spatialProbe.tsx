/**
 * Device probe: run the DevEn IDE experiences full-screen on the *real*
 * viewport, report what the browser/device exposes (sizes, segments, posture,
 * hinge readings) and tune the tokens live. Open the deployed Storybook on a
 * phone or foldable, or use the browser's responsive mode on desktop.
 *
 * It also demonstrates the integration shape apps should copy:
 *  - state owned by the app (`state` + `onAction`, reduced with `spatialReducer`)
 *  - measured device instead of a preset
 *  - reload continuity (`browserSnapshotStore` + `SnapshotRecorder` + `resumeAngle`)
 */
import * as React from "react";
import {
  SnapshotRecorder, SpatialProvider, SpatialShell, browserSnapshotStore, defaultPhysics, detectHinge, initialSpatialState, readViewport,
  simulatedHinge, spatialReducer, useFoldFrame, useMeasuredDevice, useSpatial,
  type HingeReading, type HingeSource, type PhysicsTokens, type SpatialAction, type SpatialState,
} from "../src/spatial";
import { devenExperiences } from "./spatialFixtures";

const store = browserSnapshotStore({ key: "myui.spatial.probe" });
const TUNE: [keyof PhysicsTokens, string, number, number, number][] = [
  ["closedBelow", "Closed below °", 0, 20, 1], ["halfFoldBelow", "Half-fold below °", 90, 175, 1],
  ["hingeStiffness", "Hinge k", 10, 300, 5], ["hingeDamping", "Hinge c", 4, 40, 1],
  ["handlePosition", "Handle pos", 0.4, 0.9, 0.01], ["compactArea", "Compact area", 200_000, 900_000, 10_000],
  ["twoUpMinWidth", "Two-up width", 600, 1400, 10], ["flyoutRadius", "Flyout radius", 100, 200, 1], ["glassBlur", "Glass blur", 0, 40, 1],
];

function useHingeReading(h: HingeSource) {
  const [r, setR] = React.useState<HingeReading>(() => h.read());
  React.useEffect(() => { setR(h.read()); return h.subscribe(setR); }, [h]);
  return r;
}

function Report({ tokens, setTokens, sim, setSim, simAngle, setSimAngle }: {
  tokens: Partial<PhysicsTokens>; setTokens: (t: Partial<PhysicsTokens>) => void;
  sim: boolean; setSim: (b: boolean) => void; simAngle: number; setSimAngle: (a: number) => void;
}) {
  const { device, orientation, posture, viewport, hinge, surfaces, arrangements, state } = useSpatial();
  const reading = useHingeReading(hinge);
  const live = React.useRef<HTMLSpanElement>(null);
  useFoldFrame(f => { if (live.current) live.current.textContent = `${f.angle.toFixed(1)}° · open ${(f.openness * 100).toFixed(0)}%`; });
  const [open, setOpen] = React.useState(true);
  const v = readViewport(), nav = navigator as Navigator & { devicePosture?: { type?: string } };
  const mq = (q: string) => matchMedia(q).matches;
  const report = {
    window: v.size, dpr: devicePixelRatio, screen: { w: screen.width, h: screen.height, orientation: screen.orientation?.type },
    visualViewport: visualViewport ? { w: Math.round(visualViewport.width), h: Math.round(visualViewport.height), scale: visualViewport.scale } : null,
    segments: v.segments, devicePosture: nav.devicePosture?.type ?? null,
    media: { hSeg2: mq("(horizontal-viewport-segments: 2)"), vSeg2: mq("(vertical-viewport-segments: 2)"), postureFolded: mq("(device-posture: folded)"), coarse: mq("(pointer: coarse)") },
    hinge: { source: hinge.id, capabilities: hinge.capabilities, reading },
    measured: { device, orientation }, posture, viewport,
    surfaces: surfaces.map(s => ({ slot: s.slot, w: s.w, h: s.h, arrangement: arrangements.get(s.slot)?.kind })),
    desktops: state.desktops.length, tokens,
  };
  const copy = (x: unknown) => navigator.clipboard?.writeText(JSON.stringify(x, null, 2));
  const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "110px 1fr 54px", gap: 6, alignItems: "center", fontSize: 11 };
  return (
    <div style={{ position: "fixed", left: "50%", top: 8, transform: "translateX(-50%)", zIndex: 1000, width: open ? "min(420px, 94vw)" : "auto",
      maxHeight: "80vh", overflow: "auto", background: "rgba(10,12,18,.92)", border: "1px solid #2e3548", borderRadius: 14, color: "#e6eaf2",
      font: "12px system-ui", backdropFilter: "blur(10px)", boxShadow: "0 18px 40px -12px rgba(0,0,0,.7)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px" }}>
        <button onClick={() => setOpen(o => !o)}>◎ Probe</button>
        <b>{posture.kind}{posture.fold ? ` · ${posture.fold}` : ""}</b><span ref={live} style={{ fontFamily: "monospace", color: "#8b94a7" }} />
      </div>
      {open && <div style={{ padding: "0 10px 10px", display: "grid", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => copy(report)}>Copy report</button>
          <button onClick={() => copy(device)}>Copy device profile</button>
          <button onClick={() => copy({ ...defaultPhysics, ...tokens })}>Copy tokens</button>
          <button onClick={() => { store.clear(); location.reload(); }}>Clear snapshot + reload</button>
        </div>
        <label style={row}><span>Hinge</span><select value={sim ? "sim" : "detect"} onChange={e => setSim(e.target.value === "sim")}>
          <option value="detect">detected ({detectHinge().id})</option><option value="sim">simulated</option></select><span /></label>
        {sim && <label style={row}><span>Sim angle</span><input type="range" min={0} max={180} value={simAngle} onChange={e => setSimAngle(+e.target.value)} /><span>{simAngle}°</span></label>}
        {TUNE.map(([k, label, min, max, step]) => {
          const val = (tokens[k] as number | undefined) ?? (defaultPhysics[k] as number);
          return <label key={k} style={row}><span>{label}</span>
            <input type="range" min={min} max={max} step={step} value={val} onChange={e => setTokens({ ...tokens, [k]: +e.target.value })} /><span>{val}</span></label>;
        })}
        <pre style={{ margin: 0, fontSize: 10.5, lineHeight: 1.45, color: "#8b94a7", whiteSpace: "pre-wrap" }}>{JSON.stringify(report, null, 2)}</pre>
      </div>}
    </div>
  );
}

export function DeviceProbe() {
  const { device, orientation } = useMeasuredDevice();
  const snap = React.useMemo(() => store.load(), []);
  // App-owned state: the app keeps it and reduces actions with the library's pure reducer.
  const [state, setState] = React.useState<SpatialState>(() => snap?.state ?? initialSpatialState({
    desktops: [{ slots: [{ experience: "Standard", project: "aide" }, { experience: "Walkthrough", project: "aide" }], inner: "span" }],
  }));
  const onAction = React.useCallback((a: SpatialAction) => setState(s => spatialReducer(s, a)), []);
  const [tokens, setTokens] = React.useState<Partial<PhysicsTokens>>({});
  const [sim, setSim] = React.useState(false);
  const [simAngle, setSimAngle] = React.useState(snap?.angle ?? 180);
  const simulated = React.useMemo(() => simulatedHinge(simAngle), []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { simulated.set(simAngle); }, [simulated, simAngle]);
  const hinge = React.useMemo(() => (sim ? simulated : detectHinge()), [sim, simulated]);

  return (
    <SpatialProvider device={device} orientation={orientation} hinge={hinge} experiences={devenExperiences} state={state} onAction={onAction}
      resumeAngle={snap?.angle} tokens={tokens} projects={[{ id: "aide", name: "DevEn", color: "#34d399" }]}>
      <SnapshotRecorder store={store} />
      <div className="dark" style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#06080c" }}>
        <SpatialShell controls={{ chat: <div style={{ padding: 12 }}>Overlay chat</div> }} />
      </div>
      <Report tokens={tokens} setTokens={setTokens} sim={sim} setSim={setSim} simAngle={simAngle} setSimAngle={setSimAngle} />
    </SpatialProvider>
  );
}
