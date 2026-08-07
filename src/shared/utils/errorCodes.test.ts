import { describe, expect, it } from "vitest";

import { formatDiagnosticCode } from "./errorCodes";

describe("formatDiagnosticCode", () => {
  it("normalizes stable technical diagnostic values", () => {
    expect(formatDiagnosticCode(" fs unexpected render error ")).toBe(
      "FS_UNEXPECTED_RENDER_ERROR",
    );
    expect(formatDiagnosticCode("")).toBe("FS_UNKNOWN_ERROR");
    expect(formatDiagnosticCode("route failed: 42!")).toBe("ROUTE_FAILED_42");
  });
});
