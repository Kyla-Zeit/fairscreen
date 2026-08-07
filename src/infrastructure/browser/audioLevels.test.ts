import { describe, expect, it, vi } from "vitest";

import {
  createStaticMicrophoneLevelMonitor,
  levelTextFromPercent,
} from "./audioLevels";

describe("audio levels", () => {
  it.each([
    [0, "No level yet"],
    [10, "Low signal"],
    [45, "Signal detected"],
    [95, "Possible clipping"],
  ])("maps %s percent to accessible text", (percent, text) => {
    expect(levelTextFromPercent(percent)).toBe(text);
  });

  it("keeps a text equivalent even when Web Audio is unavailable", async () => {
    const listener = vi.fn();
    const monitor = createStaticMicrophoneLevelMonitor();

    monitor.subscribe(listener);
    await monitor.stop();

    expect(listener).toHaveBeenCalledWith({
      percent: 0,
      text: "No level yet",
    });
  });
});
