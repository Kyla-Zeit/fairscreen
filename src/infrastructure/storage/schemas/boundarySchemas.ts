import { z } from "zod";
import {
  degrees,
  interviewSessionId,
  isoDateTime,
  milliseconds,
} from "../../../domain/factories";
import type {
  FairScreenExportEnvelope,
  FairnessReportExport,
  InterviewReportExport,
  VideoFrameObservation,
} from "../../../domain/models";
import {
  answerAnalysisSchema,
  audioMetricsSchema,
  fairnessComparisonSchema,
  fairnessTrialSchema,
  interviewContextSchema,
  interviewQuestionSchema,
  interviewSettingsSchema,
  transcriptRevisionSchema,
  videoMetricsSchema,
  canonicalFromBoundary,
} from "./domainSchemas";

const exportFieldSchema = z.enum([
  "session-context",
  "reviewed-transcripts",
  "content-coaching",
  "timing-audio-metrics",
  "video-conditions",
  "notes",
  "fairness-comparison",
]);

const exportedResponseSchema = z
  .object({
    question: interviewQuestionSchema,
    attemptNumber: z.number().int().min(1),
    transcript: transcriptRevisionSchema.optional(),
    analysis: answerAnalysisSchema.optional(),
    audioMetrics: audioMetricsSchema.optional(),
    videoMetrics: videoMetricsSchema.optional(),
    notes: z.string().max(10_000).optional(),
  })
  .strict();

const interviewReportSchema = z
  .object({
    sessionId: z.string().transform(interviewSessionId),
    context: interviewContextSchema.optional(),
    settings: interviewSettingsSchema,
    responses: z.array(exportedResponseSchema),
    notes: z.string().max(10_000).optional(),
  })
  .strict();

const fairnessReportSchema = z
  .object({
    comparison: fairnessComparisonSchema,
    trials: z.array(fairnessTrialSchema),
  })
  .strict();

const exportEnvelopeBase = {
  format: z.literal("fairscreen-export"),
  exportSchemaVersion: z.literal(1),
  exportedAt: z.string().transform(isoDateTime),
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  includedFields: z.array(exportFieldSchema),
  warning: z.string().min(1),
};

export const fairScreenExportEnvelopeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...exportEnvelopeBase,
      kind: z.literal("session"),
      data: interviewReportSchema,
    })
    .strict(),
  z
    .object({
      ...exportEnvelopeBase,
      kind: z.literal("fairness-comparison"),
      data: fairnessReportSchema,
    })
    .strict(),
]);

export const videoFrameObservationSchema = z
  .object({
    frameId: z.number().int().nonnegative(),
    timestampOffsetMs: z.number().int().transform(milliseconds),
    faceCount: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    primaryFaceDetected: z.boolean(),
    centred: z.boolean().optional(),
    nearCameraOrientation: z.boolean().optional(),
    yawDeltaDegrees: z.number().transform(degrees).optional(),
    pitchDeltaDegrees: z.number().transform(degrees).optional(),
    framing: z.enum([
      "workable",
      "too-close",
      "too-far",
      "edge-or-partial",
      "no-face-detected",
      "unknown",
    ]),
    brightness: z.enum([
      "dim",
      "balanced",
      "bright",
      "possible-backlighting",
      "uneven",
      "unknown",
    ]),
  })
  .strict();

export function parseVideoFrameObservation(
  input: unknown,
): VideoFrameObservation {
  return canonicalFromBoundary<VideoFrameObservation>(
    videoFrameObservationSchema.parse(input),
  );
}

export function parseExportEnvelope(
  input: unknown,
): FairScreenExportEnvelope<InterviewReportExport | FairnessReportExport> {
  return canonicalFromBoundary<
    FairScreenExportEnvelope<InterviewReportExport | FairnessReportExport>
  >(fairScreenExportEnvelopeSchema.parse(input));
}
