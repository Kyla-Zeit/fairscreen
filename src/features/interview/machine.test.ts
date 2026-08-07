import { describe, expect, it } from "vitest";

import {
  byteCount,
  decibelsFullScale,
  hertz,
  interviewQuestionId,
  interviewSessionId,
  isoDateTime,
  milliseconds,
  recordingId,
} from "../../domain/factories";
import type {
  AudioMetrics,
  InterviewQuestion,
  InterviewSettings,
} from "../../domain/models";
import { AUDIO_METRIC_ALGORITHM_VERSION } from "../audio/audioMetrics";
import { DEFAULT_INTERVIEW_SETTINGS } from "../settings/defaults";
import {
  INTERVIEW_MACHINE_STATES,
  createInterviewMachineState,
  getQuestionAttempts,
  interviewReducer,
  type InterviewEvent,
  type InterviewMachineState,
} from "./machine";
import { createTimerSnapshot, timerAnnouncementsBetween } from "./timing";

const timestamp = isoDateTime("2026-01-01T00:00:00.000Z");
type EventInput = InterviewEvent extends infer Event
  ? Event extends InterviewEvent
    ? Omit<Event, "occurredAt" | "nowMs">
    : never
  : never;

describe("interview state machine", () => {
  it("exposes exactly the approved M06 states", () => {
    expect(INTERVIEW_MACHINE_STATES).toEqual([
      "ready",
      "preparing",
      "answering",
      "reviewing",
      "betweenQuestions",
      "complete",
    ]);
  });

  it("follows the approved transition table", () => {
    let state = baseState();

    state = reduce(state, { type: "START_PREP" }, 0);
    expect(state.state).toBe("preparing");

    state = reduce(state, { type: "START_ANSWER" }, 1_000);
    expect(state.state).toBe("answering");

    state = reduce(
      state,
      { type: "FINISH_ANSWER", notes: "Typed answer." },
      12_000,
    );
    expect(state.state).toBe("reviewing");

    state = reduce(
      state,
      { type: "SAVE_REVIEW", notes: "Reviewed answer." },
      13_000,
    );
    expect(state.state).toBe("betweenQuestions");

    state = reduce(state, { type: "NEXT_QUESTION" }, 14_000);
    expect(state.state).toBe("ready");
    expect(state.currentQuestionIndex).toBe(1);

    state = reduce(state, { type: "SKIP_QUESTION" }, 15_000);
    expect(state.state).toBe("betweenQuestions");

    state = reduce(state, { type: "NEXT_QUESTION" }, 16_000);
    expect(state.state).toBe("complete");

    state = reduce(state, { type: "REOPEN_REPORT" }, 17_000);
    expect(state.state).toBe("complete");
  });

  it("logs privacy-safe diagnostics for invalid and duplicate events", () => {
    let state = baseState();
    state = reduce(
      state,
      { type: "FINISH_ANSWER", notes: "not accepted", eventId: "same" },
      0,
    );
    state = reduce(
      state,
      { type: "FINISH_ANSWER", notes: "not accepted", eventId: "same" },
      1,
    );

    expect(state.state).toBe("ready");
    expect(state.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "INVALID_EVENT_FOR_STATE",
      "DUPLICATE_EVENT",
    ]);
    expect(state.diagnostics[0]).toMatchObject({
      eventType: "FINISH_ANSWER",
      state: "ready",
    });
    expect(JSON.stringify(state.diagnostics)).not.toContain("not accepted");
  });

  it("uses timestamp-derived timing for flexible, strict-practice, and untimed modes", () => {
    const flexible = answeringState("flexible");
    const expiredFlexible = reduce(
      flexible,
      { type: "TIMER_EXPIRED" },
      121_000,
    );
    expect(expiredFlexible.state).toBe("answering");
    expect(createTimerSnapshot(flexible, 125_000)).toMatchObject({
      expired: true,
      overtimeMs: 5_000,
      label: "+0:05",
    });

    const strict = answeringState("strictPractice");
    const expiredStrict = reduce(strict, { type: "TIMER_EXPIRED" }, 121_000);
    expect(expiredStrict.state).toBe("reviewing");
    expect(
      firstAttempt(
        getQuestionAttempts(expiredStrict, firstQuestion(expiredStrict).id),
      ),
    ).toMatchObject({
      status: "interrupted",
      interruptionReason: "strict-time-expired",
    });

    const untimed = answeringState("untimed");
    expect(createTimerSnapshot(untimed, 60_000)).toMatchObject({
      visible: false,
      label: "Untimed",
    });
    const extended = reduce(untimed, { type: "EXTEND_TIME" }, 60_000);
    expect(extended.diagnostics.at(-1)?.code).toBe("EXTENSION_NOT_AVAILABLE");
  });

  it("supports sparse timer announcements, disabling, extension, and throttled jumps", () => {
    let state = answeringState("strictPractice");
    const announcements = timerAnnouncementsBetween(
      state,
      80_000,
      121_000,
      timestamp,
    );
    expect(announcements.map((announcement) => announcement.code)).toEqual([
      "TIMER_30_SECONDS",
      "TIMER_10_SECONDS",
      "TIMER_EXPIRED",
    ]);

    state = reduce(state, { type: "EXTEND_TIME" }, 90_000);
    expect(state.activeDeadlineMs).toBe(150_000);
    state = reduce(state, { type: "EXTEND_TIME" }, 91_000);
    expect(state.diagnostics.at(-1)?.code).toBe("EXTENSION_NOT_AVAILABLE");

    const disabled = reduce(state, {
      type: "SET_TIMER_ANNOUNCEMENTS",
      enabled: false,
    });
    expect(
      timerAnnouncementsBetween(disabled, 140_000, 151_000, timestamp),
    ).toEqual([]);

    const flexible = answeringState("flexible");
    expect(
      timerAnnouncementsBetween(flexible, 119_500, 123_000, timestamp).map(
        (announcement) => announcement.code,
      ),
    ).toEqual(["TIMER_EXPIRED", "TIMER_OVERTIME"]);
  });

  it("keeps repeat attempts timestamped and only selects report attempts by user action", () => {
    let state = answeringState("flexible");
    state = reduce(state, { type: "FINISH_ANSWER", notes: "First" }, 10_000);
    state = reduce(state, { type: "REPEAT_QUESTION", notes: "First" }, 11_000);
    state = reduce(state, { type: "START_ANSWER" }, 12_000);
    state = reduce(state, { type: "FINISH_ANSWER", notes: "Second" }, 20_000);
    state = reduce(state, { type: "SAVE_REVIEW", notes: "Second" }, 21_000);

    const questionId = firstQuestion(state).id;
    const attempts = getQuestionAttempts(state, questionId);
    expect(attempts).toHaveLength(2);
    const first = firstAttempt(attempts);
    const second = secondAttempt(attempts);
    expect(first.id).not.toBe(second.id);
    expect(attempts.map((attempt) => attempt.startedAtMs)).toEqual([0, 12_000]);
    expect(state.selectedAttemptByQuestion).toEqual({});

    state = reduce(state, {
      type: "SELECT_REPORT_ATTEMPT",
      questionId,
      attemptId: first.id,
    });
    expect(state.selectedAttemptByQuestion[questionId]).toBe(first.id);
  });

  it("attaches M07 audio metrics and saved recording references only during review", () => {
    let state = answeringState("flexible");
    state = reduce(state, { type: "FINISH_ANSWER", notes: "First" }, 10_000);
    const questionId = firstQuestion(state).id;
    const attempt = firstAttempt(getQuestionAttempts(state, questionId));
    const audioMetrics = audioMetricsFixture();

    state = reduce(state, {
      type: "ATTACH_AUDIO_METRICS",
      attemptId: attempt.id,
      audioMetrics,
    });
    expect(
      firstAttempt(getQuestionAttempts(state, questionId)).audioMetrics,
    ).toBe(audioMetrics);

    state = reduce(state, {
      type: "SAVE_RECORDING_REFERENCE",
      attemptId: attempt.id,
      recording: {
        id: recordingId("recording:attempt"),
        mimeType: "audio/webm",
        sizeBytes: byteCount(4),
        durationMs: milliseconds(1_000),
        savedByUserAt: timestamp,
      },
    });
    expect(
      firstAttempt(getQuestionAttempts(state, questionId)).recording,
    ).toMatchObject({
      mimeType: "audio/webm",
    });

    state = reduce(state, { type: "SAVE_REVIEW", notes: "First" }, 11_000);
    state = reduce(state, {
      type: "ATTACH_AUDIO_METRICS",
      attemptId: attempt.id,
      audioMetrics,
    });
    expect(state.diagnostics.at(-1)?.code).toBe("AUDIO_RESULT_NOT_ALLOWED");
  });

  it("emits cleanup events for finish, stop, media loss, and end", () => {
    let state = answeringState("flexible");
    state = reduce(state, { type: "MEDIA_LOST" }, 2_000);
    state = reduce(state, { type: "STOP_MEDIA" }, 3_000);
    state = reduce(state, { type: "FINISH_ANSWER", notes: "" }, 4_000);
    state = reduce(state, { type: "END_INTERVIEW" }, 5_000);

    expect(state.cleanupEvents.map((event) => event.reason)).toEqual([
      "media-lost",
      "stop-media",
      "finish-answer",
      "end-interview",
    ]);
  });
});

function answeringState(
  timingMode: InterviewSettings["timingMode"],
): InterviewMachineState {
  let state = baseState(timingMode);
  state = reduce(state, { type: "START_PREP" }, 0);
  return reduce(state, { type: "START_ANSWER" }, 0);
}

function baseState(
  timingMode: InterviewSettings["timingMode"] = "flexible",
): InterviewMachineState {
  return createInterviewMachineState({
    sessionId: interviewSessionId("session:m06"),
    questions: [question("one", 0), question("two", 1)],
    settings: {
      ...DEFAULT_INTERVIEW_SETTINGS,
      timingMode,
      preparationTimeMs: milliseconds(60_000),
      answerTimeMs: milliseconds(120_000),
      extensionTimeMs: milliseconds(30_000),
    },
  });
}

function audioMetricsFixture(): AudioMetrics {
  const limitations = ["Synthetic reducer fixture."];
  return {
    algorithmVersion: AUDIO_METRIC_ALGORITHM_VERSION,
    status: "partial",
    sampleRateHz: hertz(20),
    sampleCount: 100,
    invalidSampleCount: 0,
    calibration: {
      sampleCount: 20,
      noiseFloorDbfs: decibelsFullScale(-60),
      speechThresholdDbfs: decibelsFullScale(-50),
      attackMs: milliseconds(150),
      releaseMs: milliseconds(250),
      calibrationQuality: "adequate",
    },
    answerDurationMs: {
      status: "available",
      value: milliseconds(1_000),
      calculationQuality: "adequate",
      limitations,
    },
    delayBeforeSpeechMs: {
      status: "unavailable",
      reason: "insufficient-samples",
      limitations,
    },
    speakingDurationMs: {
      status: "unavailable",
      reason: "insufficient-samples",
      limitations,
    },
    silenceDurationMs: {
      status: "unavailable",
      reason: "insufficient-samples",
      limitations,
    },
    longestInternalSilenceMs: {
      status: "unavailable",
      reason: "insufficient-samples",
      limitations,
    },
    averageMicrophoneLevelDbfs: {
      status: "available",
      value: decibelsFullScale(-28),
      calculationQuality: "adequate",
      limitations,
    },
    peakMicrophoneLevelDbfs: {
      status: "available",
      value: decibelsFullScale(-8),
      calculationQuality: "adequate",
      limitations,
    },
    approximateWordsPerMinute: {
      status: "unavailable",
      reason: "missing-transcript",
      limitations,
    },
    speechSegments: [],
    warnings: ["transcript-missing"],
  };
}

function question(suffix: string, order: number): InterviewQuestion {
  return {
    id: interviewQuestionId(`question:${suffix}`),
    source: "custom",
    text: `Describe a decision ${suffix}.`,
    normalizedText: `describe a decision ${suffix}`,
    category: "general-behavioural",
    difficulty: "standard",
    tags: ["problem-solving"],
    renderedKeywords: [],
    order,
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
    throw new Error("Expected a first attempt.");
  }
  return attempt;
}

function secondAttempt<Value>(attempts: readonly Value[]): Value {
  const attempt = attempts[1];
  if (!attempt) {
    throw new Error("Expected a second attempt.");
  }
  return attempt;
}
