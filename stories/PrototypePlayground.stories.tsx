import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Blocks,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Columns3,
  Monitor,
  Moon,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Tablet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TaskKanbanBoard,
  Textarea,
  WindowWorkspace,
  type SplitWorkspacePane,
  type TaskItem,
  type TaskStatus,
} from "../src";
import { MEMBERS, SPRINTS, TASKS } from "./taskingFixtures";
import "./prototype-playground.css";

type PrototypeTheme = "light" | "dark" | "myai" | "corporate" | "business";
type PrototypeDevice = "desktop" | "tablet" | "mobile";
type PrototypeScene = "foundations" | "workflow" | "workspace" | "taskboard";

type PrototypePlaygroundProps = {
  initialTheme?: PrototypeTheme;
  initialDevice?: PrototypeDevice;
  initialScene?: PrototypeScene;
};

const sceneOptions: Array<{
  id: PrototypeScene;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: "foundations", label: "Component library", description: "Primitives, states, and tokens", icon: Blocks },
  { id: "workflow", label: "Workflow board", description: "A composed product storyboard", icon: Workflow },
  { id: "workspace", label: "Window workspace", description: "Responsive pane composition", icon: Columns3 },
  { id: "taskboard", label: "Task board", description: "Interactive composite surface", icon: CircleDot },
];

const themeOptions: Array<{ id: PrototypeTheme; label: string }> = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "myai", label: "myAI Night" },
  { id: "corporate", label: "Corporate" },
  { id: "business", label: "Business" },
];

const deviceOptions: Array<{
  id: PrototypeDevice;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];

function FoundationsScene({ theme }: { theme: PrototypeTheme }) {
  const [notifications, setNotifications] = React.useState(true);
  const [termsAccepted, setTermsAccepted] = React.useState(true);

  return (
    <div className="prototype-page prototype-foundations">
      <header className="prototype-page-heading">
        <div>
          <div className="prototype-eyebrow"><Palette size={14} /> Foundation kit</div>
          <h1>Build with the real system.</h1>
          <p>Interactive primitives, semantic colors, and common UI states in one frame.</p>
        </div>
        <Button><Sparkles /> Create prototype</Button>
      </header>

      <section className="prototype-section">
        <div className="prototype-section-heading">
          <div><span>01</span><h2>Semantic palette</h2></div>
          <Badge variant="secondary">Theme aware</Badge>
        </div>
        <div className="prototype-swatches">
          {[
            ["Primary", "var(--primary)", "var(--primary-foreground)"],
            ["Secondary", "var(--secondary)", "var(--secondary-foreground)"],
            ["Accent", "var(--accent)", "var(--accent-foreground)"],
            ["Muted", "var(--muted)", "var(--muted-foreground)"],
            ["Destructive", "var(--destructive)", "var(--destructive-foreground)"],
          ].map(([label, background, color]) => (
            <div className="prototype-swatch" style={{ background, color }} key={label}>
              <span>{label}</span>
              <small>{background.replace("var(--", "").replace(")", "")}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="prototype-foundation-grid">
        <section className="prototype-section">
          <div className="prototype-section-heading"><div><span>02</span><h2>Actions</h2></div></div>
          <div className="prototype-component-row">
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
          </div>
          <div className="prototype-component-row">
            <Badge>Ready</Badge>
            <Badge variant="secondary">Draft</Badge>
            <Badge variant="outline">Review</Badge>
            <Badge variant="destructive">Blocked</Badge>
          </div>
        </section>

        <section className="prototype-section">
          <div className="prototype-section-heading"><div><span>03</span><h2>Inputs</h2></div></div>
          <div className="prototype-form-grid">
            <div className="prototype-field">
              <Label htmlFor="prototype-name">Project name</Label>
              <Input id="prototype-name" defaultValue="Atlas workspace" />
            </div>
            <div className="prototype-field">
              <Label htmlFor="prototype-environment">Environment</Label>
              <Select defaultValue="staging">
                <SelectTrigger id="prototype-environment"><SelectValue /></SelectTrigger>
                <SelectContent data-theme={theme}>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="prototype-field prototype-field-wide">
              <Label htmlFor="prototype-notes">Notes</Label>
              <Textarea id="prototype-notes" defaultValue="Use this frame to test hierarchy, density, and interaction states." />
            </div>
            <label className="prototype-toggle-row">
              <Switch checked={notifications} onCheckedChange={setNotifications} />
              <span><strong>Activity notifications</strong><small>Receive updates as this prototype changes.</small></span>
            </label>
            <label className="prototype-toggle-row">
              <Checkbox checked={termsAccepted} onCheckedChange={(value) => setTermsAccepted(value === true)} />
              <span><strong>Include experimental patterns</strong><small>Show components still being evaluated.</small></span>
            </label>
          </div>
        </section>
      </div>

      <section className="prototype-section">
        <div className="prototype-section-heading"><div><span>04</span><h2>Content cards</h2></div></div>
        <div className="prototype-card-grid">
          {["Research synthesis", "Interaction review", "Release readiness"].map((title, index) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{index === 0 ? "12 sources connected" : index === 1 ? "8 flows inspected" : "Alpha candidate"}</CardDescription>
                <CardAction><Button variant="ghost" size="icon" aria-label={`More actions for ${title}`}><MoreHorizontal /></Button></CardAction>
              </CardHeader>
              <CardContent>
                <div className="prototype-progress-label"><span>Progress</span><strong>{[72, 48, 91][index]}%</strong></div>
                <Progress value={[72, 48, 91][index]} />
              </CardContent>
              <CardFooter>
                <div className="prototype-avatar-stack">
                  {["SC", "MK", "PP"].slice(0, index + 1).map((initials) => (
                    <Avatar key={initials}><AvatarFallback>{initials}</AvatarFallback></Avatar>
                  ))}
                </div>
                <Button variant="ghost" size="sm">Open <ChevronRight /></Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function WorkflowScene() {
  const [tab, setTab] = React.useState("overview");

  return (
    <div className="prototype-page prototype-workflow">
      <header className="prototype-product-header">
        <div className="prototype-brand-mark"><Sparkles size={18} /></div>
        <div className="prototype-product-title"><strong>Launch control</strong><span>Customer onboarding redesign</span></div>
        <div className="prototype-product-search"><Search size={16} /><span>Search artifacts, people, decisions...</span></div>
        <div className="prototype-avatar-stack">
          {MEMBERS.slice(0, 3).map((member) => <Avatar key={member.id}><AvatarFallback>{member.initials}</AvatarFallback></Avatar>)}
        </div>
        <Button size="sm"><Plus /> Add artifact</Button>
      </header>

      <main className="prototype-workflow-body">
        <div className="prototype-page-heading prototype-workflow-heading">
          <div>
            <div className="prototype-eyebrow"><CheckCircle2 size={14} /> Sprint 16</div>
            <h1>Design the path from intent to value.</h1>
            <p>A neutral storyboard assembled from package primitives for rapid product exploration.</p>
          </div>
          <div className="prototype-heading-actions">
            <Button variant="outline">Share</Button>
            <Button>Run review</Button>
          </div>
        </div>

        <div className="prototype-metric-grid">
          {[
            ["Flow completion", "78%", "+12% this week"],
            ["Open decisions", "06", "2 need attention"],
            ["Research signals", "24", "Across 5 sources"],
            ["Release confidence", "High", "91% readiness"],
          ].map(([label, value, note]) => (
            <Card key={label}>
              <CardContent className="prototype-metric-card">
                <span>{label}</span><strong>{value}</strong><small>{note}</small>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="prototype-workflow-tabs">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="journey">Journey</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="prototype-workflow-grid">
            <Card className="prototype-journey-card">
              <CardHeader>
                <CardTitle>Experience path</CardTitle>
                <CardDescription>Storyboard the moments that move a customer forward.</CardDescription>
              </CardHeader>
              <CardContent className="prototype-journey-list">
                {[
                  ["01", "Frame the goal", "Capture context and define success."],
                  ["02", "Generate the workspace", "Adapt surfaces to the task at hand."],
                  ["03", "Review with the team", "Turn evidence into a shared decision."],
                  ["04", "Ship and learn", "Measure impact and preserve the rationale."],
                ].map(([number, title, description], index) => (
                  <button className="prototype-journey-step" key={number}>
                    <span>{number}</span>
                    <div><strong>{title}</strong><small>{description}</small></div>
                    <Badge variant={index === 1 ? "default" : "secondary"}>{index === 1 ? "Active" : index < 1 ? "Done" : "Next"}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="prototype-signal-card">
              <CardHeader><CardTitle>Signal quality</CardTitle><CardDescription>Confidence by research source</CardDescription></CardHeader>
              <CardContent>
                <div className="prototype-signal-visual">
                  <div><strong>87</strong><span>overall</span></div>
                </div>
                <div className="prototype-signal-list">
                  {[["Interviews", 92], ["Product telemetry", 84], ["Support themes", 76]].map(([label, value]) => (
                    <div key={label as string}><div><span>{label}</span><strong>{value}%</strong></div><Progress value={value as number} /></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="journey"><EmptyStoryboard label="Journey mapping canvas" /></TabsContent>
          <TabsContent value="evidence"><EmptyStoryboard label="Evidence clustering canvas" /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function EmptyStoryboard({ label }: { label: string }) {
  return <div className="prototype-empty-board"><Sparkles size={28} /><strong>{label}</strong><span>Add cards, panes, and interactions here.</span><Button variant="outline"><Plus /> Add first block</Button></div>;
}

function WorkspacePane({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="prototype-pane-content">
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function createWorkspacePanes(): SplitWorkspacePane[] {
  return [
    {
      id: "brief",
      title: "Brief",
      canClose: false,
      outlet: (
        <WorkspacePane eyebrow="Design brief" title="Unified onboarding">
          <p>Help new teams move from an empty workspace to a meaningful first outcome in under ten minutes.</p>
          <div className="prototype-pane-stat"><span>Target activation</span><strong>72%</strong></div>
          <Progress value={72} />
        </WorkspacePane>
      ),
    },
    {
      id: "signals",
      title: "Signals",
      outlet: (
        <WorkspacePane eyebrow="Research" title="What we know">
          <div className="prototype-pane-list">
            {["Templates reduce blank-state anxiety", "Teams want visible progress", "Inviting peers is the strongest activation signal"].map((item) => <div key={item}><CircleDot size={14} /><span>{item}</span></div>)}
          </div>
        </WorkspacePane>
      ),
    },
    {
      id: "decision",
      title: "Decision",
      outlet: (
        <WorkspacePane eyebrow="Decision" title="Lead with a guided canvas">
          <p>Start from intent, then generate a workspace with editable structure instead of forcing a fixed wizard.</p>
          <div className="prototype-component-row"><Badge>Accepted</Badge><Badge variant="outline">Confidence 88%</Badge></div>
        </WorkspacePane>
      ),
    },
  ];
}

function WorkspaceScene() {
  const [panes, setPanes] = React.useState<SplitWorkspacePane[]>(createWorkspacePanes);
  const [saved, setSaved] = React.useState(false);
  const paneNumber = React.useRef(1);

  return (
    <div className="prototype-workspace-scene">
      <WindowWorkspace
        className="h-full"
        title="Onboarding concept room"
        subtitle={saved ? "Layout saved for this prototype" : "Arrange evidence, drafts, and decisions"}
        panes={panes}
        defaultTilePreset="main-left"
        onPaneClose={(paneId) => setPanes((current) => current.filter((pane) => pane.id !== paneId))}
        onAddPaneRequest={() => {
          const number = paneNumber.current++;
          setPanes((current) => [...current, {
            id: `exploration-${number}`,
            title: `Exploration ${number}`,
            outlet: <EmptyStoryboard label={`Exploration ${number}`} />,
          }]);
        }}
        onSaveLayout={() => setSaved(true)}
      />
    </div>
  );
}

function TaskBoardScene() {
  const [tasks, setTasks] = React.useState<TaskItem[]>(TASKS);
  const [dragging, setDragging] = React.useState<string | null>(null);

  const handleDrop = (target: TaskStatus | string) => {
    setTasks((current) => {
      if (!dragging) return current;
      if (target === "delete") return current.filter((task) => task.id !== dragging);
      if (SPRINTS.some((sprint) => sprint.id === target)) {
        return current.map((task) => task.id === dragging ? { ...task, sprintId: target } : task);
      }
      return current.map((task) => task.id === dragging ? { ...task, status: target as TaskStatus } : task);
    });
    setDragging(null);
  };

  return (
    <div className="prototype-task-scene">
      <div className="prototype-task-heading"><div><span>Interactive composite</span><strong>Sprint 14 — Platform Core</strong></div><Badge variant="outline">Drag cards to move</Badge></div>
      <TaskKanbanBoard
        tasks={tasks.filter((task) => task.sprintId === "s1")}
        members={MEMBERS}
        draggingTaskId={dragging}
        dropSprints={SPRINTS.filter((sprint) => sprint.id !== "s1")}
        onDragStart={setDragging}
        onDragEnd={() => setDragging(null)}
        onDrop={handleDrop}
      />
    </div>
  );
}

function PrototypePlayground({
  initialTheme = "myai",
  initialDevice = "desktop",
  initialScene = "foundations",
}: PrototypePlaygroundProps) {
  const [theme, setTheme] = React.useState<PrototypeTheme>(initialTheme);
  const [device, setDevice] = React.useState<PrototypeDevice>(initialDevice);
  const [scene, setScene] = React.useState<PrototypeScene>(initialScene);

  React.useEffect(() => setTheme(initialTheme), [initialTheme]);
  React.useEffect(() => setDevice(initialDevice), [initialDevice]);
  React.useEffect(() => setScene(initialScene), [initialScene]);

  const selectedScene = sceneOptions.find((option) => option.id === scene)!;

  return (
    <div className="prototype-studio">
      <header className="prototype-studio-bar">
        <div className="prototype-studio-brand"><div><Sparkles size={16} /></div><span><strong>myUI</strong> prototype studio</span></div>
        <div className="prototype-studio-status"><span /> Live components</div>
        <div className="prototype-studio-actions">
          <label>
            <span>Theme</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value as PrototypeTheme)}>
              {themeOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
            </select>
          </label>
          <div className="prototype-device-switcher" role="group" aria-label="Preview device">
            {deviceOptions.map((option) => {
              const Icon = option.icon;
              return <button type="button" key={option.id} className={device === option.id ? "is-active" : ""} aria-pressed={device === option.id} aria-label={`${option.label} preview`} onClick={() => setDevice(option.id)} title={option.label}><Icon size={15} /></button>;
            })}
          </div>
        </div>
      </header>

      <div className="prototype-studio-body">
        <aside className="prototype-library-panel">
          <div className="prototype-panel-heading"><span>Storyboard scenes</span><small>Choose a starting point</small></div>
          <nav>
            {sceneOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button type="button" key={option.id} className={scene === option.id ? "is-active" : ""} aria-current={scene === option.id ? "page" : undefined} onClick={() => setScene(option.id)}>
                  <div><Icon size={17} /></div><span><strong>{option.label}</strong><small>{option.description}</small></span>
                </button>
              );
            })}
          </nav>
          <div className="prototype-panel-note"><Moon size={16} /><div><strong>Try every theme</strong><span>Token-driven surfaces update without changing component code; the task board retains its current dark style.</span></div></div>
        </aside>

        <main className="prototype-stage">
          <div className="prototype-stage-meta"><span>{selectedScene.label}</span><small>{deviceOptions.find((option) => option.id === device)?.label} preview</small></div>
          <div className={`prototype-frame prototype-frame-${device}`} data-theme={theme}>
            {scene === "foundations" && <FoundationsScene theme={theme} />}
            {scene === "workflow" && <WorkflowScene />}
            {scene === "workspace" && <WorkspaceScene />}
            {scene === "taskboard" && <TaskBoardScene />}
          </div>
        </main>
      </div>
    </div>
  );
}

const meta = {
  title: "Prototyping/Storyboard Playground",
  component: PrototypePlayground,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "A theme- and viewport-aware storyboard studio using the package's real primitives and composite workspace components.",
      },
    },
  },
  argTypes: {
    initialTheme: { control: "select", options: themeOptions.map((option) => option.id) },
    initialDevice: { control: "radio", options: deviceOptions.map((option) => option.id) },
    initialScene: { control: "select", options: sceneOptions.map((option) => option.id) },
  },
  args: {
    initialTheme: "myai",
    initialDevice: "desktop",
    initialScene: "foundations",
  },
} satisfies Meta<typeof PrototypePlayground>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Studio: Story = {};

export const WorkflowStarter: Story = {
  args: { initialTheme: "corporate", initialScene: "workflow" },
};

export const MobileWorkspace: Story = {
  args: { initialTheme: "business", initialDevice: "mobile", initialScene: "workspace" },
};
