import { describe, expect, it } from "vitest";

import {
  boundedText,
  byteCount,
  decibelsFullScale,
  degrees,
  hertz,
  interviewQuestionId,
  interviewSessionId,
  isoDate,
  isoDateTime,
  milliseconds,
  normalizedRatio,
  percentage,
  questionResponseId,
  sha256Digest,
  validatedLocale,
  wordsPerMinute,
} from "./factories";
import {
  DomainInvariantError,
  snapshotInterviewSettings,
  validateResponse,
  validateSession,
} from "./invariants";
import type {
  InterviewQuestion,
  InterviewSession,
  QuestionResponse,
} from "./models";
import { normalizeSearchText, sessionMatchesSearch } from "./search";
import {
  createDefaultUserSettings,
  DEFAULT_INTERVIEW_SETTINGS,
  snapshotSettingsForSession,
} from "../features/settings/defaults";

const timestamp = isoDateTime("2026-01-01T00:00:00.000Z");
const question: InterviewQuestion = {
  id: interviewQuestionId("question:one"),
  source: "custom",
  text: "Tell me about a project handoff.",
  normalizedText: "tell me about a project handoff",
  category: "general-behavioural",
  difficulty: "standard",
  tags: ["communication"],
  renderedKeywords: [],
  order: 0,
  providerId: "test",
  providerVersion: "1",
};

function sessionFixture(): InterviewSession {
  return {
    schemaVersion: 1,
    id: interviewSessionId("session:one"),
    status: "ready",
    context: {
      jobTitle: "Software Developer",
      company: "Example Co",
      jobDescription: "Build confidential search systems",
      resumeText: "Special transcript-only-term",
      category: "software-technical",
      difficulty: "standard",
      locale: "en-CA",
    },
    settingsSnapshot: snapshotInterviewSettings(DEFAULT_INTERVIEW_SETTINGS),
    questions: [question],
    responseIds: [],
    currentQuestionIndex: 0,
    safeMachineState: "ready",
    selectedAttemptByQuestion: {},
    extractedKeywords: [],
    algorithms: {
      questionProvider: "1",
      keywordExtractor: "1",
      audioMetrics: "1",
      videoMetrics: "1",
      answerHeuristics: "1",
      fairnessSimilarity: "1",
    },
    userNotes: "Follow up on system design",
    isDemo: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function responseFixture(): QuestionResponse {
  return {
    schemaVersion: 1,
    id: questionResponseId("response:one"),
    sessionId: interviewSessionId("session:one"),
    question,
    attemptNumber: 1,
    status: "reviewed",
    timingMode: "flexible",
    transcript: {
      status: "timing-only",
      providerId: "none",
      processingMode: "unknown",
      revisions: [],
      errors: [],
      limitations: [],
    },
    userNotes: "Discuss the API choice",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("validated domain factories", () => {
  it("constructs every bounded primitive after checking its range", () => {
    expect(milliseconds(0)).toBe(0);
    expect(hertz(8)).toBe(8);
    expect(decibelsFullScale(-24)).toBe(-24);
    expect(wordsPerMinute(140)).toBe(140);
    expect(percentage(100)).toBe(100);
    expect(normalizedRatio(0.5)).toBe(0.5);
    expect(degrees(-15)).toBe(-15);
    expect(byteCount(1024)).toBe(1024);
    expect(isoDate("2026-07-30")).toBe("2026-07-30");
    expect(validatedLocale("en-ca")).toBe("en-CA");
    expect(
      sha256Digest(
        "6d656a6426b5298d530ca851b3b526aab6f74245e92d3ea7a45727a967574762",
      ),
    ).toHaveLength(64);
  });

  it("rejects invalid dates, identifiers, lengths, and numeric values", () => {
    expect(() => milliseconds(-1)).toThrow(RangeError);
    expect(() => percentage(101)).toThrow(RangeError);
    expect(() => normalizedRatio(Number.NaN)).toThrow(RangeError);
    expect(() => isoDateTime("2026-01-01")).toThrow(TypeError);
    expect(() => isoDate("2026-02-30")).toThrow(TypeError);
    expect(() => interviewSessionId("../unsafe")).toThrow(TypeError);
    expect(() => boundedText("abcd", "test", 3)).toThrow(RangeError);
  });
});

describe("domain invariants and snapshots", () => {
  it("keeps a session settings snapshot independent of later settings", () => {
    const initial = createDefaultUserSettings();
    const snapshot = snapshotSettingsForSession(initial);
    const changed = {
      ...initial,
      defaultInterviewSettings: {
        ...initial.defaultInterviewSettings,
        questionCount: 2,
      },
    };

    expect(changed.defaultInterviewSettings.questionCount).toBe(2);
    expect(snapshot.questionCount).toBe(5);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("rejects duplicate question identities and mismatched analysis", () => {
    const duplicateSession = {
      ...sessionFixture(),
      questions: [question, { ...question, order: 1 }],
    };
    expect(() => validateSession(duplicateSession)).toThrow(
      DomainInvariantError,
    );

    const response = responseFixture();
    const invalidResponse = {
      ...response,
      analysis: {
        analyzerId: "test",
        heuristicVersion: "1",
        analyzedAt: timestamp,
        transcriptRevisionId: "revision:other",
        transcriptDigest:
          "6d656a6426b5298d530ca851b3b526aab6f74245e92d3ea7a45727a967574762",
        locale: "en-CA",
        categories: [],
        detectedStrengths: [],
        suggestedImprovements: [],
        summary: "",
        limitations: [],
      },
    } as unknown as QuestionResponse;
    expect(() => validateResponse(invalidResponse)).toThrow(
      DomainInvariantError,
    );
  });
});

describe("minimized search fields", () => {
  it("normalizes Unicode and searches only approved metadata and notes", () => {
    const session = sessionFixture();
    const response = responseFixture();
    expect(normalizeSearchText("  API—Design  ")).toBe("api design");
    expect(sessionMatchesSearch(session, [response], "software")).toBe(true);
    expect(sessionMatchesSearch(session, [response], "example co")).toBe(true);
    expect(sessionMatchesSearch(session, [response], "project handoff")).toBe(
      true,
    );
    expect(sessionMatchesSearch(session, [response], "api choice")).toBe(true);
    expect(
      sessionMatchesSearch(session, [response], "confidential search"),
    ).toBe(false);
    expect(
      sessionMatchesSearch(session, [response], "transcript-only-term"),
    ).toBe(false);
  });
});
