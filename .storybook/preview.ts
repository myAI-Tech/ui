import type { Preview } from "@storybook/react";
import "../src/styles/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "var(--background)" },
        { name: "slate", value: "#f4f6f8" },
      ],
    },
    viewport: {
      options: {
        "myai-slab": { name: "myAI slab 390 × 844", styles: { width: "390px", height: "844px" }, type: "mobile" },
        "myai-large-slab": { name: "Large slab 430 × 932", styles: { width: "430px", height: "932px" }, type: "mobile" },
        "myai-dual-open": { name: "Dual-screen open 1094 × 720", styles: { width: "1094px", height: "720px" }, type: "mobile" },
        "myai-tablet-portrait": { name: "Tablet portrait 768 × 1024", styles: { width: "768px", height: "1024px" }, type: "tablet" },
        "myai-tablet-landscape": { name: "Tablet landscape 1024 × 768", styles: { width: "1024px", height: "768px" }, type: "tablet" },
        "myai-desktop": { name: "Desktop 1440 × 900", styles: { width: "1440px", height: "900px" }, type: "desktop" },
      },
    },
  },
};

export default preview;
