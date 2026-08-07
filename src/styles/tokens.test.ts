import { describe, expect, it } from "vitest";

import globalCss from "./global.css?raw";
import printCss from "./print.css?raw";
import tokensCss from "./tokens.css?raw";

describe("design tokens", () => {
  it("defines UX color, spacing, radius, shadow, breakpoint, and focus tokens", () => {
    expect(tokensCss).toContain("--fs-color-navy-950: #07111f");
    expect(tokensCss).toContain("--fs-color-teal-700: #0f766e");
    expect(tokensCss).toContain("--fs-space-4: 1rem");
    expect(tokensCss).toContain("--fs-radius-control: 0.5rem");
    expect(tokensCss).toContain("--fs-shadow-card");
    expect(tokensCss).toContain("--breakpoint-xs: 20rem");
    expect(tokensCss).toContain("--fs-focus-ring: 3px solid");
  });

  it("keeps focus visible, high contrast available, forced colors compatible, and motion reduced", () => {
    expect(globalCss).toContain(":focus-visible");
    expect(globalCss).toContain("outline: var(--fs-focus-ring)");
    expect(tokensCss).toContain('[data-theme="high-contrast"]');
    expect(tokensCss).toContain("@media (forced-colors: active)");
    expect(tokensCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(tokensCss).toContain("transition-duration: 0.001ms");
  });

  it("includes a black-and-white print baseline", () => {
    expect(printCss).toContain("@media print");
    expect(printCss).toContain("background: #ffffff");
    expect(printCss).toContain("color: #000000");
  });

  it("defines a 320 CSS px reflow floor", () => {
    expect(globalCss).toContain("min-width: 320px");
    expect(globalCss).toContain("@media (max-width: 360px)");
  });
});
