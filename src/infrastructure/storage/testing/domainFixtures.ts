import type { InterviewSessionId, IsoDateTime } from "../../../domain/common";
import {
  byteCount,
  interviewQuestionId,
  interviewSessionId,
  isoDateTime,
  milliseconds,
  questionResponseId,
  recordingId,
} from "../../../domain/factories";
import type {
  InterviewQuestion,
  InterviewSession,
  QuestionResponse,
} from "../../../domain/models";
import type { Clock } from "../../../domain/ports";
import { DEFAULT_INTERVIEW_SETTINGS } from "../../../features/settings/defaults";

export const FIXED_TIMESTAMP = isoDateTime("2026-01-01T00:00:00.000Z");

export class FixedClock implements Clock {
  readonly #timestamp: IsoDateTime;

  constructor(timestamp = FIXED_TIMESTAMP) {
    this.#timestamp = timestamp;
  }

  now(): IsoDateTime {
    return this.#timestamp;
  }
}

export function createSessionFixture(
  suffix = "one",
  isDemo = false,
): InterviewSession {
  const question = createQuestionFixture(suffix);
  return {
    schemaVersion: 1,
    id: interviewSessionId(`${isDemo ? "demo:" : ""}session:${suffix}`),
    status: "ready",
    context: {
      jobTitle: `Developer ${suffix}`,
      company: "Example Company",
      category: "software-technical",
      difficulty: "standard",
      locale: "en-CA",
    },
    settingsSnapshot: DEFAULT_INTERVIEW_SETTINGS,
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
    isDemo,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  };
}

export function createQuestionFixture(suffix = "one"): InterviewQuestion {
  return {
    id: interviewQuestionId(`question:${suffix}`),
    source: "custom",
    text: `Describe a project decision ${suffix}.`,
    normalizedText: `describe a project decision ${suffix}`,
    category: "software-technical",
    difficulty: "standard",
    tags: ["problem-solving"],
    renderedKeywords: [],
    order: 0,
    providerId: "test",
    providerVersion: "1",
  };
}

export function createResponseFixture(
  sessionId: InterviewSessionId,
  suffix = "one",
  withRecording = false,
): QuestionResponse {
  return {
    schemaVersion: 1,
    id: questionResponseId(`response:${suffix}`),
    sessionId,
    question: createQuestionFixture(suffix),
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
    ...(withRecording
      ? {
          recording: {
            id: recordingId(`recording:${suffix}`),
            mimeType: "video/webm",
            sizeBytes: byteCount(8),
            durationMs: milliseconds(1_000),
            savedByUserAt: FIXED_TIMESTAMP,
          },
        }
      : {}),
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  };
}
