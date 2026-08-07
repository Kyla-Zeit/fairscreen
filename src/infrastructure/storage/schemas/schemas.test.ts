import { describe, expect, it } from "vitest";

import packageJson from "../../../../package.json";
import {
  interviewQuestionId,
  interviewSessionId,
  isoDateTime,
  questionResponseId,
} from "../../../domain/factories";
import type {
  InterviewQuestion,
  InterviewSession,
  QuestionResponse,
} from "../../../domain/models";
import { DEMO_COMPARISON, DEMO_TRIALS } from "../../../features/demo/seed";
import { DEFAULT_INTERVIEW_SETTINGS } from "../../../features/settings/defaults";
import {
  assertPersistenceSafe,
  RepositoryGuardError,
} from "../repositoryGuards";
import {
  parseExportEnvelope,
  parseVideoFrameObservation,
} from "./boundarySchemas";
import {
  parseFairnessComparison,
  parseFairnessTrial,
  parseInterviewSession,
  parseQuestionResponse,
} from "./domainSchemas";

const timestamp = isoDateTime("2026-01-01T00:00:00.000Z");
const exampleCompanyUrl = ["https:", "", "example.com"].join("/");
const exampleJobUrl = [exampleCompanyUrl, "jobs", "123"].join("/");
const question: InterviewQuestion = {
  id: interviewQuestionId("question:schema"),
  source: "custom",
  text: "Describe a careful decision.",
  normalizedText: "describe a careful decision",
  category: "investigative",
  difficulty: "standard",
  tags: ["investigation", "evidence"],
  renderedKeywords: [],
  order: 0,
  providerId: "test",
  providerVersion: "1",
};

function validSession(): InterviewSession {
  return {
    schemaVersion: 1,
    id: interviewSessionId("session:schema"),
    status: "ready",
    context: {
      jobTitle: "Investigator",
      category: "investigative",
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
    isDemo: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function validResponse(): QuestionResponse {
  return {
    schemaVersion: 1,
    id: questionResponseId("response:schema"),
    sessionId: interviewSessionId("session:schema"),
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
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("persistence boundary schemas", () => {
  it("round-trips every M03 persisted aggregate fixture", () => {
    expect(parseInterviewSession(validSession())).toEqual(validSession());
    expect(parseQuestionResponse(validResponse())).toEqual(validResponse());
    expect(parseFairnessComparison(DEMO_COMPARISON)).toEqual(DEMO_COMPARISON);
    for (const trial of DEMO_TRIALS) {
      expect(parseFairnessTrial(trial)).toEqual(trial);
    }
  });

  it("accepts the complete setup context that FairScreen creates", () => {
    const session = validSession();
    const completeContextSession: InterviewSession = {
      ...session,
      context: {
        ...session.context,
        company: "Example Company",
        companyWebsiteUrl: exampleCompanyUrl,
        jobPostingUrl: exampleJobUrl,
        jobPostingImport: {
          originalUrl: exampleJobUrl,
          normalizedUrl: exampleJobUrl,
          importedAt: timestamp,
          title: "Investigator",
        },
        jobDescription: "Review evidence and prepare clear reports.",
        resumeText: "Experienced investigator and full-stack developer.",
        resumeMetadata: {
          originalFilename: "resume.pdf",
          format: "pdf",
          fileSizeBytes: 1234,
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
      },
    };

    expect(parseInterviewSession(completeContextSession)).toEqual(
      completeContextSession,
    );
  });

  it("rejects future versions, unknown keys, and unreviewed text", () => {
    expect(() =>
      parseInterviewSession({ ...validSession(), schemaVersion: 2 }),
    ).toThrow();
    expect(() =>
      parseInterviewSession({ ...validSession(), unexpected: true }),
    ).toThrow();
    expect(() =>
      parseQuestionResponse({
        ...validResponse(),
        transcript: {
          status: "manual",
          providerId: "manual",
          processingMode: "device",
          revisions: [
            {
              id: "revision:unsafe",
              createdAt: timestamp,
              text: "Unreviewed",
              source: "manual",
              reviewedByUser: false,
              locale: "en-CA",
              wordCount: 1,
              normalizedDigest:
                "6d656a6426b5298d530ca851b3b526aab6f74245e92d3ea7a45727a967574762",
            },
          ],
          errors: [],
          limitations: [],
        },
      }),
    ).toThrow();
  });
});

describe("serialization guards", () => {
  it("rejects raw media-derived structures and transient recognition fields", () => {
    expect(() => {
      assertPersistenceSafe({ safe: { faceLandmarks: [1, 2] } });
    }).toThrow(RepositoryGuardError);
    expect(() => {
      assertPersistenceSafe({ transcript: { interimText: "draft" } });
    }).toThrow(RepositoryGuardError);
    expect(() => {
      assertPersistenceSafe({ samples: new Float32Array([0.1]) });
    }).toThrow(RepositoryGuardError);
    expect(() => {
      assertPersistenceSafe({ recording: new Blob(["test"]) });
    }).toThrow(RepositoryGuardError);
  });

  it("allows approved aggregate frame counts and demo metrics", () => {
    expect(() => {
      assertPersistenceSafe({
        processedFrameCount: 20,
        droppedFrameCount: 2,
        invalidFrameCount: 0,
      });
    }).not.toThrow();
    expect(() => {
      assertPersistenceSafe(DEMO_COMPARISON);
    }).not.toThrow();
  });
});

describe("worker and export boundaries", () => {
  it("accepts a sanitized frame observation and rejects an extra raw field", () => {
    const observation = {
      frameId: 1,
      timestampOffsetMs: 100,
      faceCount: 1,
      primaryFaceDetected: true,
      centred: true,
      framing: "workable",
      brightness: "balanced",
    };
    expect(parseVideoFrameObservation(observation)).toEqual(observation);
    expect(() =>
      parseVideoFrameObservation({
        ...observation,
        landmarks: [{ x: 0.2, y: 0.4 }],
      }),
    ).toThrow();
  });

  it("validates a versioned fairness export and rejects future envelopes", () => {
    const envelope = {
      format: "fairscreen-export",
      exportSchemaVersion: 1,
      exportedAt: timestamp,
      appVersion: packageJson.version,
      kind: "fairness-comparison",
      includedFields: ["fairness-comparison"],
      warning: "Synthetic local demonstration.",
      data: {
        comparison: DEMO_COMPARISON,
        trials: DEMO_TRIALS,
      },
    };
    expect(parseExportEnvelope(envelope)).toEqual(envelope);
    expect(() =>
      parseExportEnvelope({ ...envelope, exportSchemaVersion: 2 }),
    ).toThrow();
  });
});
