import { describe, expect, it } from "vitest";

import {
  interviewQuestionId,
  interviewSessionId,
  isoDateTime,
} from "../../domain/factories";
import type { InterviewQuestion } from "../../domain/models";
import { createDeterministicAnswerAnalyzer } from "../analysis/DeterministicAnswerAnalyzer";
import { createManualTranscriptResult } from "../transcription/transcription";
import { EphemeralFairScreenRepository } from "../../infrastructure/storage/ephemeral/EphemeralFairScreenRepository";
import { DEFAULT_INTERVIEW_SETTINGS } from "../settings/defaults";
import {
  createDefaultSetupDraft,
  withFreshSessionSeed,
} from "../setup/setupDraft";
import {
  createInterviewMachineState,
  interviewReducer,
  type InterviewEvent,
  type InterviewMachineState,
} from "./machine";
import {
  createSessionIdFromDraft,
  projectInterviewProgress,
  recoverInterviewProgress,
  saveInterviewProgress,
  serializeInterviewProgress,
} from "./progressPersistence";

const timestamp = isoDateTime("2026-01-01T00:00:00.000Z");
const exampleCompanyUrl = ["https:", "", "example.com"].join("/");
const exampleJobUrl = [exampleCompanyUrl, "jobs", "123"].join("/");
type EventInput = InterviewEvent extends infer Event
  ? Event extends InterviewEvent
    ? Omit<Event, "occurredAt" | "nowMs">
    : never
  : never;

describe("interview progress persistence", () => {
  it("creates unique session ids for repeated starts with the same job title", () => {
    const baseDraft = {
      ...createDefaultSetupDraft(),
      jobTitle: "Product analyst",
      generatedQuestions: [question()],
    };
    const firstStart = withFreshSessionSeed(baseDraft, "first explicit start");
    const secondStart = withFreshSessionSeed(
      baseDraft,
      "second explicit start",
    );

    expect(createSessionIdFromDraft(firstStart)).not.toBe(
      createSessionIdFromDraft(secondStart),
    );
    expect(String(createSessionIdFromDraft(firstStart))).toContain(
      "product-analyst",
    );
  });

  it("recovers active preparation and answering checkpoints to safe non-capturing ready state", () => {
    let state = baseState();
    state = reduce(state, { type: "START_PREP" }, 1_000);
    state = reduce(state, { type: "START_ANSWER" }, 2_000);

    const recovered = recoverInterviewProgress(
      serializeInterviewProgress(state, timestamp),
    );

    expect(recovered.state).toBe("ready");
    expect(recovered.activeAttemptId).toBeUndefined();
    expect(recovered.activeDeadlineMs).toBeUndefined();
    expect(recovered.activeStartedAtMs).toBeUndefined();
    expect(recovered.cleanupEvents).toEqual([]);
  });

  it("persists saved attempts through the existing repository port", async () => {
    let state = baseState();
    state = reduce(state, { type: "START_PREP" }, 0);
    state = reduce(state, { type: "START_ANSWER" }, 0);
    state = reduce(
      state,
      { type: "FINISH_ANSWER", notes: "Manual note" },
      5_000,
    );
    state = reduce(state, { type: "SAVE_REVIEW", notes: "Manual note" }, 6_000);
    const attempt = firstAttempt(
      Object.values(state.attemptsByQuestion).flat(),
    );
    const questionId = firstQuestion(state).id;
    state = reduce(state, {
      type: "SELECT_REPORT_ATTEMPT",
      questionId,
      attemptId: attempt.id,
    });

    const projection = projectInterviewProgress({
      state,
      context: {
        jobTitle: "Product analyst",
        category: "general-behavioural",
        difficulty: "standard",
        locale: "en-CA",
      },
      extractedKeywords: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const repository = new EphemeralFairScreenRepository();
    expect(await repository.open()).toMatchObject({ ok: true });
    expect(await saveInterviewProgress(repository, projection)).toMatchObject({
      ok: true,
    });

    const savedSession = await repository.getSession(state.sessionId);
    const savedResponses = await repository.listResponses(state.sessionId);

    expect(savedSession.ok ? savedSession.value?.safeMachineState : null).toBe(
      "betweenQuestions",
    );
    expect(savedSession.ok ? savedSession.value?.responseIds : []).toEqual([
      attempt.id,
    ]);
    expect(
      savedSession.ok
        ? savedSession.value?.selectedAttemptByQuestion[questionId]
        : undefined,
    ).toBe(attempt.id);
    expect(savedResponses.ok ? savedResponses.value : []).toHaveLength(1);
    const response = savedResponses.ok ? savedResponses.value[0] : undefined;
    expect(response?.recording).toBeUndefined();
    expect(response?.audioMetrics).toBeUndefined();
    expect(response?.videoMetrics).toBeUndefined();
    expect(response?.analysis).toBeUndefined();
  });

  it("persists a real setup context with resume and job metadata", async () => {
    let state = baseState();
    state = reduce(state, { type: "START_PREP" }, 0);
    state = reduce(state, { type: "START_ANSWER" }, 0);
    state = reduce(state, { type: "FINISH_ANSWER", notes: "" }, 5_000);
    state = reduce(state, { type: "SAVE_REVIEW", notes: "" }, 6_000);

    const projection = projectInterviewProgress({
      state,
      context: {
        jobTitle: "Full Stack Developer",
        company: "Example Company",
        companyWebsiteUrl: exampleCompanyUrl,
        jobPostingUrl: exampleJobUrl,
        jobPostingImport: {
          originalUrl: exampleJobUrl,
          normalizedUrl: exampleJobUrl,
          importedAt: timestamp,
          title: "Full Stack Developer",
        },
        jobDescription: "Build reliable web applications.",
        resumeText: "Investigator with web development experience.",
        resumeMetadata: {
          originalFilename: "resume.pdf",
          format: "pdf",
          fileSizeBytes: 2048,
          importedAt: timestamp,
          extractionStatus: "ready",
        },
        companyResearch: {
          providerId: "local-test",
          retrievedAt: timestamp,
          verifiedCompanyName: "Example Company",
          overview: "Example overview.",
          findings: [],
          practiceQuestions: [],
          sources: [],
          limitations: [],
        },
        category: "general-behavioural",
        difficulty: "standard",
        locale: "en-CA",
      },
      extractedKeywords: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const repository = new EphemeralFairScreenRepository();
    expect(await repository.open()).toMatchObject({ ok: true });
    expect(await saveInterviewProgress(repository, projection)).toMatchObject({
      ok: true,
    });
    const saved = await repository.getSession(state.sessionId);
    expect(saved.ok ? saved.value?.context.resumeMetadata : undefined).toEqual(
      projection.session.context.resumeMetadata,
    );
  });

  it("marks a practice ended before all questions as ended early, not complete", () => {
    const first = question();
    const second: InterviewQuestion = {
      ...question(),
      id: interviewQuestionId("question:persist-second"),
      text: "Describe another useful project decision.",
      normalizedText: "describe another useful project decision",
      order: 1,
    };
    let state = createInterviewMachineState({
      sessionId: interviewSessionId("session:ended-early"),
      questions: [first, second],
      settings: DEFAULT_INTERVIEW_SETTINGS,
    });
    state = reduce(state, { type: "START_PREP" }, 0);
    state = reduce(state, { type: "START_ANSWER" }, 0);
    state = reduce(state, { type: "FINISH_ANSWER", notes: "" }, 5_000);
    state = reduce(state, { type: "SAVE_REVIEW", notes: "" }, 6_000);
    state = reduce(state, { type: "END_INTERVIEW" }, 7_000);

    const projection = projectInterviewProgress({
      state,
      context: {
        jobTitle: "Product analyst",
        category: "general-behavioural",
        difficulty: "standard",
        locale: "en-CA",
      },
      extractedKeywords: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    expect(projection.session.status).toBe("ended-early");
    expect(projection.session.safeMachineState).toBe("complete");
  });

  it("drops stale coaching analysis instead of rejecting a reviewed answer save", async () => {
    let state = baseState();
    state = reduce(state, { type: "START_PREP" }, 0);
    state = reduce(state, { type: "START_ANSWER" }, 0);
    state = reduce(state, { type: "FINISH_ANSWER", notes: "" }, 5_000);

    const originalTranscript = createManualTranscriptResult({
      revisionKey: "original",
      createdAt: timestamp,
      text: "I investigated the problem, documented the cause, and explained the result clearly to the client.",
      locale: "en-CA",
    });
    const revisedTranscript = createManualTranscriptResult({
      revisionKey: "revised",
      createdAt: timestamp,
      text: "I investigated the problem, verified the root cause, documented the evidence, and explained the result clearly to the client.",
      locale: "en-CA",
    });
    const originalRevision = originalTranscript.activeRevision;
    if (!originalRevision) throw new Error("Expected original revision");
    const staleAnalysis = createDeterministicAnswerAnalyzer().analyze({
      question: firstQuestion(state),
      transcriptRevision: originalRevision,
      locale: "en-CA",
    });

    state = reduce(
      state,
      {
        type: "SAVE_REVIEW",
        notes: "",
        transcript: revisedTranscript,
        analysis: staleAnalysis,
      },
      6_000,
    );

    const projection = projectInterviewProgress({
      state,
      context: {
        jobTitle: "Product analyst",
        category: "general-behavioural",
        difficulty: "standard",
        locale: "en-CA",
      },
      extractedKeywords: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    expect(projection.responses[0]?.analysis).toBeUndefined();
    const repository = new EphemeralFairScreenRepository();
    expect(await repository.open()).toMatchObject({ ok: true });
    expect(await saveInterviewProgress(repository, projection)).toMatchObject({
      ok: true,
    });
  });
});

function baseState(): InterviewMachineState {
  return createInterviewMachineState({
    sessionId: interviewSessionId("session:m06-persist"),
    questions: [question()],
    settings: DEFAULT_INTERVIEW_SETTINGS,
  });
}

function question(): InterviewQuestion {
  return {
    id: interviewQuestionId("question:persist"),
    source: "custom",
    text: "Describe a useful project decision.",
    normalizedText: "describe a useful project decision",
    category: "general-behavioural",
    difficulty: "standard",
    tags: ["problem-solving"],
    renderedKeywords: [],
    order: 0,
    providerId: "test",
    providerVersion: "1",
  };
}

function reduce(state: InterviewMachineState, event: EventInput, nowMs = 0) {
  return interviewReducer(state, {
    ...event,
    nowMs,
    occurredAt: timestamp,
  });
}

function firstQuestion(state: InterviewMachineState): InterviewQuestion {
  const [question] = state.questions;
  if (!question) {
    throw new Error("Expected an interview question.");
  }
  return question;
}

function firstAttempt<Value>(attempts: readonly Value[]): Value {
  const [attempt] = attempts;
  if (!attempt) {
    throw new Error("Expected an attempt.");
  }
  return attempt;
}
