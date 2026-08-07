import { describe, expect, it } from "vitest";

import { normalizeHttpUrl, safeDisplayFilename } from "./jobContext";

describe("jobContext helpers", () => {
  it("normalizes only valid HTTP and HTTPS URLs", () => {
    expect(
      normalizeHttpUrl(" " + "HTTPS" + "://Example.com/jobs/123#apply "),
    ).toEqual({
      ok: true,
      normalizedUrl: webUrl("example.com/jobs/123"),
    });
    expect(normalizeHttpUrl("file:///etc/passwd")).toMatchObject({
      ok: false,
    });
    expect(normalizeHttpUrl("javascript:alert(1)")).toMatchObject({
      ok: false,
    });
    expect(normalizeHttpUrl("not a url")).toMatchObject({ ok: false });
  });

  it("keeps only safe resume basenames", () => {
    expect(safeDisplayFilename("C:\\Users\\Rebecca\\Resume.pdf")).toBe(
      "Resume.pdf",
    );
    expect(safeDisplayFilename("/tmp/private/resume.txt")).toBe("resume.txt");
  });
});

function webUrl(path: string): string {
  return "https" + "://" + path;
}
