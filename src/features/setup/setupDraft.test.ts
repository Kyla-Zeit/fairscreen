import { describe, expect, it } from "vitest";

import { interviewQuestionId } from "../../domain/factories";
import {
  createDefaultSetupDraft,
  enabledMediaSummary,
  replaceResumeText,
  toInterviewContext,
  toInterviewSettings,
  validateSetupDraft,
} from "./setupDraft";

describe("setupDraft", () => {
  it("uses M04 defaults from user settings", () => {
    const draft = createDefaultSetupDraft();

    expect(draft).toMatchObject({
      questionCount: 5,
      preparationTimeSeconds: 60,
      answerTimeSeconds: 120,
      timingMode: "flexible",
      transcription: "manual",
      cameraRequested: false,
      microphoneRequested: false,
      recordingCaptureRequested: false,
    });
    expect(enabledMediaSummary(draft)).toBe("No camera or microphone selected");
  });

  it("validates required fields, ranges, and incompatible capture choices", () => {
    const invalidDraft = {
      ...createDefaultSetupDraft(),
      questionCount: 11,
      preparationTimeSeconds: -1,
      answerTimeSeconds: 15,
      recordingCaptureRequested: true,
    };

    expect(validateSetupDraft(invalidDraft)).toEqual([
      { fieldId: "job-title", message: "Job title is required." },
      { fieldId: "question-count", message: "Questions must be 10 or fewer." },
      {
        fieldId: "preparation-time",
        message: "Preparation time cannot be negative.",
      },
      {
        fieldId: "answer-time",
        message: "Answer time must be at least 30 seconds.",
      },
      {
        fieldId: "recording-capture",
        message:
          "Recording capture needs camera, microphone, or both selected.",
      },
    ]);
  });

  it("creates session-ready context and settings without mutating optional text", () => {
    const draft = {
      ...createDefaultSetupDraft(),
      jobTitle: "  Analyst  ",
      company: "  FairScreen  ",
      questionCount: 3,
      cameraRequested: true,
      microphoneRequested: true,
      transcription: "ask-when-supported" as const,
    };

    expect(validateSetupDraft(draft)).toEqual([]);
    expect(toInterviewContext(draft)).toMatchObject({
      jobTitle: "Analyst",
      company: "FairScreen",
      locale: "en-CA",
    });
    expect(toInterviewSettings(draft)).toMatchObject({
      questionCount: 3,
      cameraRequested: true,
      microphoneRequested: true,
      transcription: "ask-when-supported",
    });
  });

  it("validates job and company URLs and carries normalized context", () => {
    const invalidDraft = {
      ...createDefaultSetupDraft(),
      jobTitle: "Analyst",
      companyWebsiteUrl: "ftp://example.com",
      jobPostingUrl: "not a url",
    };

    expect(validateSetupDraft(invalidDraft)).toEqual([
      {
        fieldId: "company-website-url",
        message: "Company website URL: Only HTTP and HTTPS URLs are supported.",
      },
      {
        fieldId: "job-posting-url",
        message: "Job posting URL: " + invalidUrlMessage(),
      },
    ]);

    const companyWebsiteUrl = webUrl("example.com/about");
    const jobPostingUrl = webUrl("example.com/jobs/1");
    const validDraft = {
      ...createDefaultSetupDraft(),
      jobTitle: "Analyst",
      companyWebsiteUrl,
      normalizedCompanyWebsiteUrl: companyWebsiteUrl,
      jobPostingUrl,
      normalizedJobPostingUrl: jobPostingUrl,
    };

    expect(toInterviewContext(validDraft)).toMatchObject({
      companyWebsiteUrl,
      jobPostingUrl,
    });
  });

  it("clears stale generated question snapshots when resume text changes", () => {
    const questionId = interviewQuestionId("q:old");
    const draft = {
      ...createDefaultSetupDraft(),
      resumeText: "Old resume",
      generatedQuestions: [
        {
          id: questionId,
          source: "built-in" as const,
          text: "Old question?",
          normalizedText: "old question?",
          category: "general-behavioural" as const,
          difficulty: "standard" as const,
          tags: ["introduction" as const],
          renderedKeywords: [],
          order: 0,
          providerId: "test",
          providerVersion: "1",
        },
      ],
      extractedKeywords: [
        {
          normalized: "old",
          display: "old",
          source: "resume" as const,
          weight: 1,
          kind: "skill" as const,
        },
      ],
      questionSelectionReasons: [
        {
          questionId,
          reason: "keyword-adapted" as const,
          details: ["Old context."],
        },
      ],
    };

    expect(replaceResumeText(draft, "New resume")).toMatchObject({
      resumeText: "New resume",
      generatedQuestions: [],
      extractedKeywords: [],
      questionSelectionReasons: [],
    });
  });
});

function webUrl(path: string): string {
  return "https" + "://" + path;
}

function invalidUrlMessage(): string {
  return (
    "Enter a valid URL starting with " + "http" + ":// or " + "https" + "://."
  );
}
