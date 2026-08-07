import type {
  ByteCount,
  Milliseconds,
  QuestionResponseId,
  RecordingId,
} from "../../domain/common";
import { recordingId } from "../../domain/factories";
import type { CapturedRecording } from "../../infrastructure/browser/mediaRecorder";

export const SOFT_RECORDING_BYTES = 250 * 1024 * 1024;
export const SOFT_RECORDING_DURATION_MS = 20 * 60 * 1000;

export interface ObjectUrlPort {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface TransientRecordingReview {
  readonly attemptId: QuestionResponseId;
  readonly blob: Blob;
  readonly mimeType: string;
  readonly sizeBytes: ByteCount;
  readonly durationMs: Milliseconds;
  readonly objectUrl: string;
  readonly warnings: readonly string[];
  dispose(): void;
}

export function createTransientRecordingReview(
  attemptId: QuestionResponseId,
  recording: CapturedRecording,
  objectUrls: ObjectUrlPort = browserObjectUrls(),
): TransientRecordingReview {
  const objectUrl = objectUrls.createObjectURL(recording.blob);
  let disposed = false;

  return {
    attemptId,
    blob: recording.blob,
    mimeType: recording.mimeType,
    sizeBytes: recording.sizeBytes,
    durationMs: recording.durationMs,
    objectUrl,
    warnings: recordingSoftWarnings(recording),
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      objectUrls.revokeObjectURL(objectUrl);
    },
  };
}

export function recordingSoftWarnings(recording: {
  readonly sizeBytes: ByteCount;
  readonly durationMs: Milliseconds;
}): readonly string[] {
  const warnings: string[] = [];
  if (recording.sizeBytes >= SOFT_RECORDING_BYTES) {
    warnings.push(
      "This recording is near the local storage soft limit. Consider discarding it or continuing without saving the recording.",
    );
  }
  if (recording.durationMs >= SOFT_RECORDING_DURATION_MS) {
    warnings.push(
      "This recording is longer than the review soft limit. Saving may fail on devices with limited storage.",
    );
  }
  return warnings;
}

export function recordingIdForAttempt(
  responseId: QuestionResponseId,
): RecordingId {
  return recordingId(`recording:${hashString(String(responseId))}`);
}

function browserObjectUrls(): ObjectUrlPort {
  return {
    createObjectURL(blob) {
      return URL.createObjectURL(blob);
    },
    revokeObjectURL(url) {
      URL.revokeObjectURL(url);
    },
  };
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
