/**
 * Fixtures for the spatial interface stories: DevEn's experiences declared with
 * the DSL, plus a lab that renders them on a simulated iPhone Duo. In an app,
 * experience definitions live next to the app's own panes.
 */
import * as React from "react";
import {
  DeviceFrame, FoldTransition, SpatialProvider, SpatialShell, defineExperience, devices, pane, simulatedHinge, useFoldFrame, useSpatial,
  type ExperienceRenderContext, type Orientation, type PairSpec, type PaneSpec,
} from "../src/spatial";

// ── panes (placeholders; real apps pass their own components) ─────────────
const box = (text: string) => () => <pre style={{ margin: 0, font: "11px/1.5 var(--sp-mono)", color: "var(--sp-muted)" }}>{text}</pre>;
const P = {
  code: (): PaneSpec => pane("code", "Monaco · WorkspaceMode.fs", box("let label mode =\n    match mode with\n    | Standard -> \"Standard\""), { short: "Code", color: "#38bdf8", role: "primary", owner: "local", flow: "crossfade" }),
  runtime: () => pane("runtime", "Runtime", box("MyAIDE.Api  :5080 up\nfable watch  stopped"), { short: "Runtime", color: "#34d399", owner: "local", summary: "Api :5080 up · fable stopped" }),
  chat: () => pane("chat", "Chat", box("you: tighten the flyout spring?\ndeven: k 240 → 300"), { short: "Chat", color: "#a78bfa", role: "chat", owner: "shared", summary: "deven: k 240 → 300" }),
  knowledge: () => pane("knowledge", "Knowledge", box("persona: Deven   semantic_match\nknowledge-plane.md   graph_proximity"), { short: "Context", color: "#2dd4bf", role: "context", owner: "shared", summary: "3 entities · persona: Deven" }),
  guide: () => pane("guide", "Walkthrough", box("2 / 4  Compose panes"), { short: "Guide", color: "#2dd4bf", role: "context", owner: "shared", summary: "2/4 Compose panes — required local panes always render" }),
  shell: () => pane("shell", "Terminal", box("$ dotnet test\n  Passed! 22 tests"), { short: "Shell", color: "#34d399", owner: "local", summary: "Passed! 22 tests" }),
  preview: () => pane("preview", "Preview", box("● localhost:5175  HMR 42ms"), { short: "Preview", color: "#fb7185", owner: "local", flow: "crossfade" }),
};

// ── Home: the unfold choreography from the sketch ──────────────────────────
function Card({ title, sub, color }: { title: string; sub: string; color: string }) {
  return <div style={{ position: "absolute", inset: 0, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
    <span style={{ font: "10px var(--sp-mono)", color }}>{title.toUpperCase()}</span>
    <div><div style={{ fontSize: 20, fontWeight: 650 }}>{title}</div><div style={{ fontSize: 11, color: "var(--sp-muted)" }}>{sub}</div></div>
  </div>;
}
function Recent() {
  return <div><div style={{ fontWeight: 600, marginBottom: 8 }}>Recent</div>
    {["spatial-shell-poc", "knowledge-resolve-audit", "auth-core-adapter"].map(t =>
      <div key={t} style={{ height: 56, marginBottom: 10, borderRadius: 12, border: "1px solid var(--sp-line)", background: "var(--sp-surface)", padding: "0 12px", display: "flex", alignItems: "center", fontSize: 12, fontWeight: 600 }}>{t}</div>)}
  </div>;
}
function Home({ surface, span }: ExperienceRenderContext) {
  const pin = React.useRef<HTMLDivElement>(null);
  useFoldFrame(f => { if (pin.current) pin.current.style.opacity = String(Math.max(0, (f.openness - 0.85) / 0.15)); });
  const top = surface.floating ? 46 : 0, pad = 16;
  if (!span) {   // single screen: static closed layout
    const cw = surface.w - pad - (surface.rail ? 46 : 16), ww = (cw - 12) / 2;
    return <div style={{ position: "absolute", inset: 0, padding: `${16 + top}px ${surface.rail ? 46 : 16}px 0 ${pad}px` }}>
      <div style={{ fontSize: 17, fontWeight: 650, height: 32 }}>Dev.Env</div>
      <div style={{ display: "flex", gap: 12, margin: "14px 0 20px" }}>
        {[["New", "Workspace · chat · document", "#34d399"], ["Load", "Workspace, snapshot or thread", "#38bdf8"]].map(([t, s, c]) =>
          <div key={t} style={{ position: "relative", width: ww, height: 104, borderRadius: 18, background: "var(--sp-surface-2)" }}><Card title={t} sub={s} color={c} /></div>)}
      </div>
      <Recent />
    </div>;
  }
  const half = surface.w / 2, H = surface.h, ox = half + pad, cw = half - pad - 46, ww = (cw - 12) / 2, bw = half - pad * 2, bh = 96, loadY = H - 28 - bh;
  return (
    <FoldTransition width={surface.w} height={H} crease={half} items={[
      { id: "load", flow: "melt", from: { x: ox + ww + 12, y: 62, w: ww, h: 104 }, to: { x: pad, y: loadY, w: bw, h: bh }, children: <Card title="Load" sub="Workspace, snapshot or thread" color="#38bdf8" /> },
      { id: "new", flow: "melt", from: { x: ox, y: 62, w: ww, h: 104 }, to: { x: pad, y: loadY - 12 - bh, w: bw, h: bh }, children: <Card title="New" sub="Workspace · chat · document" color="#34d399" /> },
      { id: "recent", flow: "slide", className: "is-plain", from: { x: ox, y: 186, w: cw, h: 260 }, to: { x: ox, y: 62, w: cw, h: 260 }, children: <Recent /> },
    ]}>
      <div style={{ position: "absolute", left: ox, top: 16, fontSize: 17, fontWeight: 650 }}>Dev.Env</div>
      <div ref={pin} style={{ position: "absolute", left: pad, top: 16, width: bw, opacity: 0 }}><div style={{ fontWeight: 600 }}>Documents · Chats · Pairs</div></div>
    </FoldTransition>
  );
}

// ── experiences (mirror WorkspaceMode.fs ModeContracts) ────────────────────
export const devenExperiences = [
  defineExperience({ id: "home", label: "Home", code: "HM", accent: "#34d399", panes: [], render: ctx => <Home {...ctx} /> }),
  defineExperience({ id: "Standard", label: "Standard", code: "ST", accent: "#38bdf8", layout: "Window", panes: [P.code(), P.runtime()],
    actions: [{ id: "build", label: "Run build", glyph: "▶" }, { id: "ask", label: "Ask Deven", glyph: "✦" }] }),
  defineExperience({ id: "CodeAssist", label: "Code Assist", code: "CA", accent: "#60a5fa", layout: "Split", panes: [P.code(), P.knowledge()], compact: "banner" }),
  defineExperience({ id: "PairProgram", label: "Pair Program", code: "PP", accent: "#a78bfa", layout: "Split", panes: [P.code(), P.chat()], span: ["chat", "code"],
    actions: [{ id: "approve", label: "Approve patch", glyph: "✓" }, { id: "rollback", label: "Roll back", glyph: "↺" }] }),
  defineExperience({ id: "Walkthrough", label: "Walkthrough", code: "WT", accent: "#2dd4bf", layout: "Split", panes: [P.code(), P.guide()], compact: "banner",
    postures: {
      // half-fold: the guide's step controls move to the deck; the editor keeps the top half
      laptop: { actions: [{ id: "prev", label: "Prev step", glyph: "‹" }, { id: "next", label: "Next step", glyph: "›" }], deck: { kind: "pane", pane: "guide" } },
    } }),
  defineExperience({ id: "Terminal", label: "Terminal", code: "TM", accent: "#34d399", layout: "Split", panes: [P.shell(), P.runtime()],
    postures: { laptop: { deck: { kind: "keyboard" }, actions: [{ id: "stop", label: "Stop job", glyph: "■" }] } } }),
  defineExperience({ id: "Play", label: "Play", code: "PL", accent: "#fb7185", layout: "Split", panes: [P.preview(), P.shell()],
    postures: { laptop: { deck: { kind: "controls", render: () => <div style={{ padding: 12 }}>▶ reload · ⇱ expose route · ⦿ debugger</div> } } } }),
  defineExperience({ id: "Custom", label: "Custom", code: "CU", accent: "#94a3b8", layout: "Free-form", panes: [P.code(), P.chat(), P.shell(), P.knowledge()],
    free: { windows: [{ pane: "code", x: 2, y: 3, w: 58, h: 60 }, { pane: "chat", x: 62, y: 3, w: 36, h: 44 }, { pane: "shell", x: 2, y: 66, w: 58, h: 32 }, { pane: "knowledge", x: 62, y: 50, w: 36, h: 48 }] } }),
];

const pairs: PairSpec[] = [
  { name: "Guide ⇄ Code", left: { experience: "Walkthrough", project: "aide" }, right: { experience: "CodeAssist", project: "aide" } },
  { name: "Pair ⇄ Shell", left: { experience: "PairProgram", project: "aide" }, right: { experience: "Terminal", project: "aide" } },
];
const projects = [{ id: "aide", name: "DevEn", color: "#34d399" }, { id: "core", name: "myAI Core", color: "#38bdf8" }];

/** Drives the simulated hinge with a slow, viscous unfold. */
function FoldControls({ hinge }: { hinge: ReturnType<typeof simulatedHinge> }) {
  const { fold, posture } = useSpatial();
  const [angle, setAngle] = React.useState(0);
  const go = (a: number, slow: boolean) => { slow ? fold.setResponse(9, 6) : fold.setResponse(90, 19); hinge.set(a); setAngle(a); };
  return <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
    <input type="range" min={0} max={180} value={angle} onChange={e => go(+e.target.value, false)} />
    <button onClick={() => go(angle > 90 ? 0 : 180, true)}>{angle > 90 ? "Close" : "Open"}</button>
    <code>{posture.kind}{posture.fold ? ` · ${posture.fold}` : ""}</code>
  </div>;
}

export function SpatialLab() {
  const hinge = React.useMemo(() => simulatedHinge(0), []);
  const [orientation, setOrientation] = React.useState<Orientation>("portrait");
  const [scope, setScope] = React.useState<"device" | "slot">("device");
  return (
    <SpatialProvider key={scope} device={devices.iphoneDuo} orientation={orientation} hinge={hinge} experiences={devenExperiences} projects={projects}
      swipeScope={scope}
      // one desktop to start; ＋ adds more (whole-device workspaces), swipe moves between them
      initialState={{ desktops: [{ slots: [{ experience: "home", project: "aide" }, { experience: "Walkthrough", project: "aide" }] }], pairs }}
      newDesktop={() => ({ slots: [{ experience: "home", project: "aide" }, { experience: "CodeAssist", project: "aide" }], inner: "span", focus: 0, tiles: 2, tileRatio: 0.5 })}
      onEvent={e => console.debug("[spatial]", e)}>
      <FoldControls hinge={hinge} />
      <button onClick={() => setOrientation(o => (o === "portrait" ? "landscape" : "portrait"))}>Rotate</button>
      <button onClick={() => setScope(s => (s === "device" ? "slot" : "device"))}>Swipe scope: {scope}</button>
      <DeviceFrame><SpatialShell controls={{ chat: <div style={{ padding: 12 }}>Overlay chat</div>, onSearch: () => {}, onAccount: () => {} }} /></DeviceFrame>
    </SpatialProvider>
  );
}
