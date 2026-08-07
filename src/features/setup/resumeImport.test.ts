import { describe, expect, it } from "vitest";

import {
  RESUME_IMPORT_MAX_FILE_BYTES,
  RESUME_IMPORT_MAX_TEXT_CHARACTERS,
  classifyResumeFile,
  finalizeExtractedResumeText,
  sanitizeExtractedResumeText,
} from "./resumeImport";

describe("resumeImport", () => {
  it("classifies supported files by extension without requiring trustworthy MIME", () => {
    expect(
      classifyResumeFile({
        name: "resume.pdf",
        size: 1024,
        type: "application/octet-stream",
      }),
    ).toEqual({ ok: true, format: "pdf" });
    expect(
      classifyResumeFile({
        name: "resume.docx",
        size: 1024,
        type: "",
      }),
    ).toEqual({ ok: true, format: "docx" });
    expect(
      classifyResumeFile({
        name: "resume.txt",
        size: 1024,
        type: "",
      }),
    ).toEqual({ ok: true, format: "txt" });
  });

  it("rejects unsupported, legacy, and oversized files with guidance", () => {
    expect(
      classifyResumeFile({
        name: "resume.doc",
        size: 1024,
        type: "application/msword",
      }),
    ).toMatchObject({ ok: false, failure: { code: "legacy-doc" } });
    expect(
      classifyResumeFile({
        name: "resume.rtf",
        size: 1024,
        type: "application/rtf",
      }),
    ).toMatchObject({ ok: false, failure: { code: "unsupported-format" } });
    expect(
      classifyResumeFile({
        name: "resume.pdf",
        size: RESUME_IMPORT_MAX_FILE_BYTES + 1,
        type: "application/pdf",
      }),
    ).toMatchObject({ ok: false, failure: { code: "oversized-file" } });
  });

  it("removes unsafe control characters while preserving Unicode, tabs, and lines", () => {
    expect(
      sanitizeExtractedResumeText("  Résumé\t• SQL\r\nNode\u0000\u0008\n  "),
    ).toBe("Résumé\t• SQL\nNode");
  });

  it("keeps empty, image-only PDF, and excessive text as explicit failures", () => {
    const emptyResult = finalizeExtractedResumeText("   ", "txt");
    const imageOnlyResult = finalizeExtractedResumeText("   ", "pdf");
    const excessiveResult = finalizeExtractedResumeText(
      "a".repeat(RESUME_IMPORT_MAX_TEXT_CHARACTERS + 1),
      "docx",
    );

    expect(emptyResult).toMatchObject({
      ok: false,
      failure: { code: "empty-document" },
    });
    expect(imageOnlyResult).toMatchObject({
      ok: false,
      failure: { code: "image-only-pdf" },
    });
    expect(excessiveResult).toMatchObject({
      ok: false,
      failure: { code: "excessive-text" },
    });
    expect(
      JSON.stringify([emptyResult, imageOnlyResult, excessiveResult]),
    ).not.toMatch(/paste/i);
  });
});
