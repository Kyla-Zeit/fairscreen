import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";
import { createResourceRegistry } from "../media/resourceRegistry";

function ThrowingRoute(): ReactElement {
  throw new Error("synthetic render failure");
}

describe("ErrorBoundary", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
    return undefined;
  });

  afterEach(() => {
    consoleError.mockClear();
  });

  it("renders a privacy-safe fallback and disposes registered resources", async () => {
    const registry = createResourceRegistry();
    const dispose = vi.fn();

    registry.register({
      id: "synthetic-preview",
      dispose,
    });

    render(
      <ErrorBoundary
        fallback={({ diagnosticCode }) => <p>{diagnosticCode}</p>}
        onError={() => {
          void registry.disposeAll("route-error");
        }}
      >
        <ThrowingRoute />
      </ErrorBoundary>,
    );

    expect(screen.getByText("FS_UNEXPECTED_RENDER_ERROR")).toBeInTheDocument();
    await waitFor(() => {
      expect(dispose).toHaveBeenCalledTimes(1);
    });
    expect(dispose).toHaveBeenCalledWith("route-error");
    expect(registry.activeCount()).toBe(0);
  });
});
