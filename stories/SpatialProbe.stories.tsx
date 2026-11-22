import type { Meta, StoryObj } from "@storybook/react";

import "../src/styles/spatial.css";
import { DeviceProbe } from "./spatialProbe";

const meta = {
  title: "Workspaces/Spatial Device Probe",
  component: DeviceProbe,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DeviceProbe>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Full-screen DevEn IDE on the measured viewport with a report + tuning panel.
 * Open the story's iframe URL directly on a phone/foldable (or use responsive
 * mode) — the measured device follows the real window, segments and posture.
 */
export const Probe: Story = {};
