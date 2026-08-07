import { describe, expect, it, vi } from "vitest";

import { createResourceRegistry } from "./resourceRegistry";

describe("resource registry", () => {
  it("registers, unregisters, snapshots, and disposes resources", async () => {
    const registry = createResourceRegistry();
    const firstDispose = vi.fn();
    const secondDispose = vi.fn();

    registry.register({ id: "worker", dispose: firstDispose });
    const unregister = registry.register({
      id: "timer",
      dispose: secondDispose,
    });

    expect(registry.snapshot()).toEqual(["timer", "worker"]);

    unregister();
    expect(registry.snapshot()).toEqual(["worker"]);

    const result = await registry.disposeAll("manual-stop");

    expect(result).toEqual([{ id: "worker", status: "disposed" }]);
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(firstDispose).toHaveBeenCalledWith("manual-stop");
    expect(secondDispose).not.toHaveBeenCalled();
    expect(registry.activeCount()).toBe(0);
  });

  it("reports disposal failures without retaining failed resources", async () => {
    const registry = createResourceRegistry();

    registry.register({
      id: "failing-resource",
      dispose() {
        throw new Error("synthetic failure");
      },
    });

    await expect(registry.disposeAll("test-teardown")).resolves.toEqual([
      { id: "failing-resource", status: "failed" },
    ]);
    expect(registry.activeCount()).toBe(0);
  });
});
