import { describe, expect, it } from "vitest";

import { isoDateTime } from "../../domain/factories";
import {
  createManualTranscriptResult,
  formatTranscriptParagraphs,
} from "./transcription";

describe("transcript paragraph formatting", () => {
  it("preserves paragraphs entered by the user", () => {
    const result = createManualTranscriptResult({
      revisionKey: "answer:paragraphs",
      createdAt: isoDateTime("2026-08-03T00:00:00.000Z"),
      text: "First paragraph with a clear point.\n\nSecond paragraph with the supporting detail.",
      locale: "en-CA",
    });

    expect(result.activeRevision?.text).toBe(
      "First paragraph with a clear point.\n\nSecond paragraph with the supporting detail.",
    );
  });

  it("adds readable paragraphs to a long transcript", () => {
    const formatted = formatTranscriptParagraphs(
      "I would define the failure behaviour first. I would use a timeout and bounded retries. Then I would switch to a cached response. I would queue recoverable work for later processing. Finally I would test the failure path and monitor user impact.",
    );

    expect(formatted).toContain("\n\n");
  });
});
