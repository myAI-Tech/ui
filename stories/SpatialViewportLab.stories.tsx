import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChatWorkspace,
  DeviceFrame,
  SpatialProfiler,
  SpatialProvider,
  WindowWorkspace,
  computePosture,
  defaultPhysics,
  defineExperience,
  devices,
  initialSpatialState,
  pane,
  simulatedHinge,
  spatialProfiler,
  spatialReducer,
  useSpatial,
  useSpatialProfiler,
  viewportFor,
  type ChatMessage,
  type DeviceProfile,
  type InnerMode,
  type Orientation,
  type PhysicsTokens,
  type SpatialAction,
  type SpatialState,
  type SplitWorkspacePane,
} from "../src";
import { DemoSpatialShell, devenExperiences } from "./spatialFixtures";
import "../src/styles/spatial.css";
import "./spatial-viewport-lab.css";

type DeviceId = "slab" | "iphoneDuo" | "dualScreen" | "compactBook" | "wideBook" | "ipadPro" | "desktop";
type ScenarioId = "framework" | "workspace" | "chat" | "continuity" | "whiteboard";
type MotionPreset = "viscous" | "balanced" | "snappy";

type SpatialViewportLabProps = {
  initialDevice?: DeviceId;
  initialOrientation?: Orientation;
  initialAngle?: number;
  initialInner?: InnerMode;
  initialScenario?: ScenarioId;
  initialTheme?: "dark" | "myai" | "corporate" | "business";
  motionPreset?: MotionPreset;
  reduceMotion?: boolean;
  showFrame?: boolean;
  showInspector?: boolean;
};

const deviceOptions: Array<{ id: DeviceId; label: string }> = [
  { id: "slab", label: "Slab phone" },
  { id: "iphoneDuo", label: "Continuous passport" },
  { id: "dualScreen", label: "Physical dual-screen" },
  { id: "compactBook", label: "Compact book foldable" },
  { id: "wideBook", label: "Wide book foldable" },
  { id: "ipadPro", label: "Large tablet" },
  { id: "desktop", label: "Desktop" },
];

const motionResponse: Record<MotionPreset, { k: number; c: number }> = {
  viscous: { k: 9, c: 6 },
  balanced: { k: 90, c: 19 },
  snappy: { k: 180, c: 25 },
};

function WorkspaceCanary() {
  const [panes, setPanes] = React.useState<SplitWorkspacePane[]>(() => [
    {
      id: "brief",
      title: "Brief",
      canClose: false,
      outlet: <CanaryCard title="Viewport brief" value="Keep controls reachable and state intact across posture changes." />,
    },
    {
      id: "signals",
      title: "Signals",
      outlet: <CanaryCard title="Signals" value="ResizeObserver should retile this workspace from desktop through compact surfaces." />,
    },
    {
      id: "decision",
      title: "Decision",
      outlet: <CanaryCard title="Decision" value="Use the spatial shell for surfaces and WindowWorkspace for panes, never two free-form window managers." />,
    },
  ]);
  return (
    <div style={{ height: "100%", minHeight: 0 }}>
      <WindowWorkspace
        className="h-full"
        title="Workspace canary"
        subtitle="Real responsive component inside a spatial pane"
        panes={panes}
        defaultTilePreset="main-left"
        onAddPaneRequest={() => setPanes(current => [...current, {
          id: `pane-${Date.now()}`,
          title: `Pane ${current.length + 1}`,
          outlet: <CanaryCard title="New pane" value="This pane should survive fold, rotate, and reopen transitions." />,
        }])}
        onPaneClose={id => setPanes(current => current.filter(pane => pane.id !== id))}
      />
    </div>
  );
}

function CanaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ height: "100%", padding: 12, overflow: "auto" }}>
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent><p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 12, lineHeight: 1.55 }}>{value}</p></CardContent>
      </Card>
    </div>
  );
}

const chatParticipants = [
  { id: "design", name: "Design", role: "Experience", avatarColor: "#8b7cf8" },
  { id: "platform", name: "Platform", role: "Runtime", avatarColor: "#14b8a6" },
];

function ChatCanary() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { id: "one", role: "participant", participantId: "design", content: "Does the composer remain reachable when the viewport changes?", timestamp: new Date("2026-11-22T10:00:00Z") },
    { id: "two", role: "participant", participantId: "platform", content: "Close and reopen the simulated device to verify message and scroll continuity.", timestamp: new Date("2026-11-22T10:01:00Z") },
  ]);
  return (
    <div style={{ height: "100%", minHeight: 0 }}>
      <ChatWorkspace
        title="Chat canary"
        subtitle="Viewport and keyboard pressure test"
        participants={chatParticipants}
        messages={messages}
        onSendMessage={content => setMessages(current => [...current, { id: `${Date.now()}`, role: "user", content, timestamp: new Date() }])}
      />
    </div>
  );
}

function StatefulCanary({ label }: { label: string }) {
  const mounted = React.useRef(new Date().toISOString().slice(11, 23));
  const [count, setCount] = React.useState(0);
  return (
    <div style={{ display: "grid", gap: 10, padding: 12 }}>
      <Badge variant="outline">Mounted {mounted.current}</Badge>
      <strong>{label}</strong>
      <input defaultValue="Edit me, then fold or rotate" aria-label={`${label} continuity value`} style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, background: "var(--input-background)", color: "var(--foreground)", padding: 8 }} />
      <Button size="sm" onClick={() => setCount(value => value + 1)}>Local state: {count}</Button>
    </div>
  );
}

const integrationExperiences = [
  defineExperience({
    id: "WorkspaceCanary", label: "Workspace", code: "WS", accent: "#8b7cf8", layout: "Responsive workspace",
    panes: [pane("workspace-canary", "Window Workspace", () => <WorkspaceCanary />, { role: "primary", owner: "shared", flow: "crossfade" })],
  }),
  defineExperience({
    id: "ChatCanary", label: "Chat", code: "CH", accent: "#14b8a6", layout: "Thread workspace",
    panes: [pane("chat-canary", "Chat Workspace", () => <ChatCanary />, { role: "primary", owner: "shared", flow: "crossfade" })],
  }),
  defineExperience({
    id: "ContinuityCanary", label: "Continuity", code: "CT", accent: "#fbbf24", layout: "State continuity",
    panes: [
      pane("continuity-main", "Primary state", () => <StatefulCanary label="Primary pane" />, { role: "primary", owner: "shared", flow: "crossfade" }),
      pane("continuity-deck", "Deck state", () => <StatefulCanary label="Movable deck pane" />, { role: "context", owner: "shared", flow: "crossfade", summary: "Stateful pane moves to the laptop deck" }),
    ],
    compact: "banner",
    span: ["continuity-main", "continuity-deck"],
    postures: { laptop: { deck: { kind: "pane", pane: "continuity-deck" } } },
  }),
];

function MotionResponse({ preset }: { preset: MotionPreset }) {
  const { fold } = useSpatial();
  React.useEffect(() => {
    const response = motionResponse[preset];
    fold.setResponse(response.k, response.c);
  }, [fold, preset]);
  return null;
}

function MetricsPanel() {
  const metrics = useSpatialProfiler();
  const { posture, viewport, surfaces, visibleFocus } = useSpatial();
  return (
    <div className="sp-lab-inspector">
      <div><span>Posture</span><strong>{posture.kind}{posture.fold ? ` / ${posture.fold}` : ""}</strong></div>
      <div><span>Viewport</span><strong>{Math.round(viewport.w)} × {Math.round(viewport.h)}</strong></div>
      <div><span>Surfaces</span><strong>{surfaces.length} / focus {visibleFocus}</strong></div>
      <div><span>FPS sample</span><strong>{metrics.averageFps.toFixed(0)}</strong></div>
      <div><span>P95 frame</span><strong>{metrics.p95FrameMs.toFixed(1)} ms</strong></div>
      <div><span>React commit</span><strong>{metrics.averageCommitMs.toFixed(1)} ms</strong></div>
      <div><span>Dropped</span><strong>{metrics.droppedFrames}</strong></div>
      <div><span>Layout shift</span><strong>{metrics.layoutShiftScore.toFixed(3)}</strong></div>
      <Button size="sm" variant="outline" onClick={() => spatialProfiler.reset()}>Reset metrics</Button>
    </div>
  );
}

function SpatialViewportLab({
  initialDevice = "iphoneDuo",
  initialOrientation = "portrait",
  initialAngle = 100,
  initialInner = "split",
  initialScenario = "framework",
  initialTheme = "myai",
  motionPreset: initialMotion = "balanced",
  reduceMotion: initialReduceMotion = false,
  showFrame: initialShowFrame = true,
  showInspector: initialShowInspector = true,
}: SpatialViewportLabProps) {
  const [deviceId, setDeviceId] = React.useState(initialDevice);
  const [orientation, setOrientation] = React.useState(initialOrientation);
  const [angle, setAngle] = React.useState(initialAngle);
  const [inner, setInner] = React.useState(initialInner);
  const [scenario, setScenario] = React.useState(initialScenario);
  const [theme, setTheme] = React.useState(initialTheme);
  const [motion, setMotion] = React.useState(initialMotion);
  const [reduceMotion, setReduceMotion] = React.useState(initialReduceMotion);
  const [showFrame, setShowFrame] = React.useState(initialShowFrame);
  const [showInspector, setShowInspector] = React.useState(initialShowInspector);
  const device = devices[deviceId] as DeviceProfile;
  const hinge = React.useMemo(() => simulatedHinge(angle), []); // one source preserves subscriptions while controls change
  React.useEffect(() => hinge.set(angle), [hinge, angle]);

  React.useEffect(() => setDeviceId(initialDevice), [initialDevice]);
  React.useEffect(() => setOrientation(initialOrientation), [initialOrientation]);
  React.useEffect(() => setAngle(initialAngle), [initialAngle]);
  React.useEffect(() => setInner(initialInner), [initialInner]);
  React.useEffect(() => setScenario(initialScenario), [initialScenario]);
  React.useEffect(() => setTheme(initialTheme), [initialTheme]);
  React.useEffect(() => setMotion(initialMotion), [initialMotion]);
  React.useEffect(() => setReduceMotion(initialReduceMotion), [initialReduceMotion]);
  React.useEffect(() => setShowFrame(initialShowFrame), [initialShowFrame]);
  React.useEffect(() => setShowInspector(initialShowInspector), [initialShowInspector]);

  // Keep both registries available while controlled state transitions to the selected scenario.
  const experiences = React.useMemo(() => [...devenExperiences, ...integrationExperiences], []);
  const primary = scenario === "workspace" ? "WorkspaceCanary" : scenario === "chat" ? "ChatCanary" : scenario === "continuity" ? "ContinuityCanary" : scenario === "whiteboard" ? "Whiteboard" : "home";
  const secondary = scenario === "framework" ? "Walkthrough" : primary;
  const [state, setState] = React.useState<SpatialState>(() => initialSpatialState({ desktops: [{ slots: [{ experience: primary }, { experience: secondary }], inner }] }));
  const dispatch = React.useCallback((action: SpatialAction) => setState(current => spatialReducer(current, action)), []);
  React.useEffect(() => dispatch({ type: "setInner", inner }), [dispatch, inner]);
  React.useEffect(() => {
    dispatch({ type: "setLocked", locked: false });
    dispatch({ type: "setExperience", slot: 0, id: primary });
    dispatch({ type: "setExperience", slot: 1, id: secondary });
  }, [dispatch, primary, secondary]);

  const tokens = React.useMemo<Partial<PhysicsTokens>>(() => ({ reduceMotion }), [reduceMotion]);
  const posture = computePosture(device, orientation, angle, { ...defaultPhysics, ...tokens });
  const viewport = viewportFor(device, posture);
  const frameWidth = viewport.w + (showFrame ? device.frame.bezel * 2 : 0);
  const frameHeight = viewport.h + (showFrame ? device.frame.bezel * 2 : 0);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setScale(Math.min(1, Math.max(0.1, (stage.clientWidth - 32) / frameWidth), Math.max(0.1, (stage.clientHeight - 32) / frameHeight)));
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, [frameWidth, frameHeight]);

  return (
    <div className="sp-lab" data-theme={theme}>
      <div className="sp-lab-toolbar">
        <label>Device<select value={deviceId} onChange={event => setDeviceId(event.target.value as DeviceId)}>{deviceOptions.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
        <label>Orientation<select value={orientation} onChange={event => setOrientation(event.target.value as Orientation)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
        <label>Scenario<select value={scenario} onChange={event => setScenario(event.target.value as ScenarioId)}><option value="framework">Framework lab</option><option value="workspace">Window Workspace</option><option value="chat">Chat Workspace</option><option value="continuity">State continuity</option><option value="whiteboard">Whiteboard</option></select></label>
        <label>Inner<select value={inner} onChange={event => setInner(event.target.value as InnerMode)}><option value="split">Split</option><option value="span">Span</option></select></label>
        <label>Motion<select value={motion} onChange={event => setMotion(event.target.value as MotionPreset)}><option value="viscous">Viscous</option><option value="balanced">Balanced</option><option value="snappy">Snappy</option></select></label>
        <label>Theme<select value={theme} onChange={event => setTheme(event.target.value as typeof theme)}><option value="dark">Dark</option><option value="myai">myAI</option><option value="corporate">Corporate</option><option value="business">Business</option></select></label>
        <div className="sp-lab-presets"><Button size="sm" variant="outline" onClick={() => setAngle(0)}>Closed</Button><Button size="sm" variant="outline" onClick={() => setAngle(100)}>Half</Button><Button size="sm" variant="outline" onClick={() => setAngle(180)}>Flat</Button></div>
        <label className="sp-lab-check"><input type="checkbox" checked={reduceMotion} onChange={event => setReduceMotion(event.target.checked)} /> Reduced</label>
        <label className="sp-lab-check"><input type="checkbox" checked={showFrame} onChange={event => setShowFrame(event.target.checked)} /> Frame</label>
        <label className="sp-lab-check"><input type="checkbox" checked={showInspector} onChange={event => setShowInspector(event.target.checked)} /> Metrics</label>
      </div>
      {device.kind === "foldable" && <div className="sp-lab-angle"><span>Fold angle</span><input type="range" min={0} max={180} value={angle} onChange={event => setAngle(Number(event.target.value))} /><strong>{angle}°</strong><Badge variant="outline">simulation</Badge></div>}
      <div ref={stageRef} className="sp-lab-stage">
        <div className="sp-lab-scaled" style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}>
          <SpatialProvider device={device} orientation={orientation} hinge={hinge} experiences={experiences} state={state} onAction={dispatch} scale={scale} tokens={tokens}>
            <MotionResponse preset={motion} />
            <SpatialProfiler>
              {showFrame ? <DeviceFrame><DemoSpatialShell /></DeviceFrame> : <DemoSpatialShell />}
            </SpatialProfiler>
            {showInspector && <MetricsPanel />}
          </SpatialProvider>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "Spatial/Viewport and Motion Lab",
  component: SpatialViewportLab,
  parameters: { layout: "fullscreen" },
  argTypes: {
    initialDevice: { control: "select", options: deviceOptions.map(option => option.id) },
    initialOrientation: { control: "radio", options: ["portrait", "landscape"] },
    initialAngle: { control: { type: "range", min: 0, max: 180, step: 1 } },
    initialInner: { control: "radio", options: ["split", "span"] },
    initialScenario: { control: "select", options: ["framework", "workspace", "chat", "continuity", "whiteboard"] },
    initialTheme: { control: "select", options: ["dark", "myai", "corporate", "business"] },
    motionPreset: { control: "radio", options: ["viscous", "balanced", "snappy"] },
  },
  args: {
    initialDevice: "iphoneDuo",
    initialOrientation: "portrait",
    initialAngle: 100,
    initialInner: "split",
    initialScenario: "framework",
    initialTheme: "myai",
    motionPreset: "balanced",
    reduceMotion: false,
    showFrame: true,
    showInspector: true,
  },
} satisfies Meta<typeof SpatialViewportLab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveLab: Story = {};
export const PhysicalDualScreen: Story = { args: { initialDevice: "dualScreen", initialAngle: 180, initialInner: "split" } };
export const ContinuousBookFoldable: Story = { args: { initialDevice: "wideBook", initialAngle: 100, initialInner: "span" } };
export const TabletWorkspace: Story = { args: { initialDevice: "ipadPro", initialOrientation: "landscape", initialScenario: "workspace", showFrame: false }, parameters: { viewport: { defaultViewport: "myai-tablet-landscape" } } };
export const DesktopWorkspace: Story = { args: { initialDevice: "desktop", initialOrientation: "landscape", initialScenario: "workspace", showFrame: false }, parameters: { viewport: { defaultViewport: "myai-desktop" } } };
export const ReducedMotion: Story = { args: { initialDevice: "compactBook", initialAngle: 100, reduceMotion: true } };
export const StateContinuity: Story = { args: { initialDevice: "dualScreen", initialOrientation: "landscape", initialAngle: 100, initialScenario: "continuity", initialInner: "span" } };
export const WhiteboardExperience: Story = { args: { initialDevice: "dualScreen", initialAngle: 180, initialScenario: "whiteboard", initialInner: "span" } };
