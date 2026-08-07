import { describe, expect, it } from "vitest";

import { isoDate } from "./factories";
import { createExportFilename, sanitizeFilenamePart } from "./filenames";

describe("export filenames", () => {
  it("removes path syntax, controls, reserved names, and repeated separators", () => {
    expect(sanitizeFilenamePart("../../Private: Notes?")).toBe("private-notes");
    expect(sanitizeFilenamePart("CON")).toBe("export");
    expect(sanitizeFilenamePart("\u0000")).toBe("export");
  });

  it("builds a stable local export filename", () => {
    expect(
      createExportFilename(
        "session",
        isoDate("2026-07-30"),
        "json",
        "Developer / Practice",
      ),
    ).toBe("fairscreen-session-developer-practice-2026-07-30.json");
  });
});
