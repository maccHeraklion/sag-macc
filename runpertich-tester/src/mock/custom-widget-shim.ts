/**
 * Mock for @tago-io/custom-widget
 *
 * The production Dashboard.tsx does `import "@tago-io/custom-widget"` as a
 * side-effect. The real package sets up the TagoIO iframe bridge.
 * Here we do nothing — window.TagoIO is set up separately by tago-window.ts
 * before Dashboard mounts.
 */

// Side-effect only import — nothing to export
export default {};
