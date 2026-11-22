// Core — framework-free, pure where possible (bindable from Fable).
export * from "./tokens";
export { Spring, ticker } from "./physics";
export type { SpringOptions, FrameCallback } from "./physics";
// generic math stays namespaced so it can't collide with other myui exports
export * as spatialMath from "./physics";
export * from "./device";
export * from "./hinge";
export * from "./experience";
export * from "./state";
export * from "./persistence";
export * from "./profiler";

// React
export { SpatialProvider, useSpatial, useFoldFrame, usePosture, usePostureState, useExperience, FoldClock } from "./react/context";
export type { ControlledSpatialProviderProps, UncontrolledSpatialProviderProps, SpatialContextValue, SpatialProviderProps, SpatialEvent, FoldFrame, ProjectSpec } from "./react/context";
export { SpatialShell } from "./react/SpatialShell";
export type {
  SpatialShellProps,
  ShellControls,
  ShellAction,
  ShellActionContext,
  BuiltInShellCommand,
  ShellCommandPresentation,
  SpatialShellMessages,
  FavoriteExperienceChange,
} from "./react/SpatialShell";
export { ExperienceView, ExperienceHeader, PaneFrame, PaneBanner, PageMarkers, FreeCanvas } from "./react/ExperienceView";
export { useEdgeFlyout } from "./react/EdgeFlyout";
export type { EdgeFlyoutOptions, EdgeFlyoutController, FlyoutItem } from "./react/EdgeFlyout";
export { FoldTransition, GooFilter } from "./react/FoldTransition";
export type { FlowItem, FoldTransitionProps } from "./react/FoldTransition";
export { HalfFoldDeck, TouchBar, VirtualKeyboard } from "./react/HalfFoldDeck";
export { OverlayPanel } from "./react/OverlayPanel";
export { DeviceFrame } from "./react/DeviceFrame";
export { useMeasuredDevice, readViewport } from "./react/measure";
export { SnapshotRecorder } from "./react/SnapshotRecorder";
export { SpatialProfiler, useSpatialProfiler } from "./react/SpatialProfiler";
