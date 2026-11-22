import type { Meta, StoryObj } from "@storybook/react";

import "../src/styles/spatial.css";
import { SpatialLab } from "./spatialFixtures";

const meta = {
  title: "Workspaces/Spatial Interface",
  component: SpatialLab,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SpatialLab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** iPhone Duo with a simulated hinge: Open plays the unfold, Rotate switches to laptop posture, Swipe scope toggles device / slot. */
export const IPhoneDuoLab: Story = {
  render: () => (
    <div style={{ padding: 16, minHeight: "100vh", background: "#06080c", color: "#e6eaf2" }}>
      <SpatialLab />
    </div>
  ),
};
