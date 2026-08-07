export type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type IsoDateTime = Brand<string, "IsoDateTime">;
export type IsoDate = Brand<string, "IsoDate">;
export type Sha256Digest = Brand<string, "Sha256Digest">;

export type InterviewSessionId = Brand<string, "InterviewSessionId">;
export type InterviewQuestionId = Brand<string, "InterviewQuestionId">;
export type QuestionTemplateId = Brand<string, "QuestionTemplateId">;
export type QuestionResponseId = Brand<string, "QuestionResponseId">;
export type TranscriptRevisionId = Brand<string, "TranscriptRevisionId">;
export type RecordingId = Brand<string, "RecordingId">;
export type FairnessTrialId = Brand<string, "FairnessTrialId">;
export type FairnessComparisonId = Brand<string, "FairnessComparisonId">;
export type FairnessGroupId = Brand<string, "FairnessGroupId">;
export type UserSettingsId = Brand<string, "UserSettingsId">;

export type Milliseconds = Brand<number, "Milliseconds">;
export type Hertz = Brand<number, "Hertz">;
export type DecibelsFullScale = Brand<number, "DecibelsFullScale">;
export type WordsPerMinute = Brand<number, "WordsPerMinute">;
export type Percentage = Brand<number, "Percentage">;
export type NormalizedRatio = Brand<number, "NormalizedRatio">;
export type Degrees = Brand<number, "Degrees">;
export type ByteCount = Brand<number, "ByteCount">;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface AlgorithmVersions {
  readonly questionProvider: string;
  readonly keywordExtractor: string;
  readonly audioMetrics: string;
  readonly videoMetrics: string;
  readonly answerHeuristics: string;
  readonly fairnessSimilarity: string;
}

export interface VersionedRecord {
  readonly schemaVersion: number;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type AvailabilityReason =
  | "not-requested"
  | "permission-denied"
  | "permission-blocked"
  | "unsupported"
  | "initialization-failed"
  | "device-lost"
  | "insufficient-samples"
  | "invalid-signal"
  | "missing-transcript"
  | "user-declined"
  | "storage-failed"
  | "interrupted"
  | "unknown";

export type MetricValue<Value> =
  | {
      readonly status: "available";
      readonly value: Value;
      readonly calculationQuality: "adequate" | "limited";
      readonly limitations: readonly string[];
    }
  | {
      readonly status: "partial";
      readonly value: Value;
      readonly calculationQuality: "limited";
      readonly limitations: readonly string[];
      readonly reason: AvailabilityReason;
    }
  | {
      readonly status: "unavailable";
      readonly reason: AvailabilityReason;
      readonly limitations: readonly string[];
    };

export interface EvidenceSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly evidenceType:
    | "keyword"
    | "example-cue"
    | "action-cue"
    | "outcome-cue"
    | "measurement"
    | "repetition"
    | "filler"
    | "structure-cue";
}
