import type {
  FairnessComparisonId,
  FairnessTrialId,
  InterviewSessionId,
  IsoDateTime,
  QuestionResponseId,
  RecordingId,
} from "./common";
import type {
  AnswerAnalysis,
  AnswerAnalysisInput,
  CapabilityStatus,
  FairnessComparison,
  FairnessTrial,
  InterviewCategory,
  InterviewSession,
  InterviewSessionStatus,
  QuestionGenerationRequest,
  QuestionGenerationResult,
  QuestionResponse,
  TranscriptResult,
  TranscriptionProcessingMode,
  UserSettings,
} from "./models";

export interface Clock {
  now(): IsoDateTime;
}

export interface IdProvider {
  next(namespace: string): string;
}

export interface RandomProvider {
  next(): number;
}

export interface CancellationSignal {
  readonly aborted: boolean;
  addAbortListener(listener: () => void): () => void;
}

export interface QuestionProvider {
  readonly providerId: string;
  readonly providerVersion: string;
  generate(
    request: QuestionGenerationRequest,
    signal?: CancellationSignal,
  ): Promise<QuestionGenerationResult>;
}

export interface TranscriptionCapability {
  readonly status: CapabilityStatus;
  readonly processingMode: TranscriptionProcessingMode;
  readonly disclosureRequired: boolean;
  readonly limitations: readonly string[];
}

export interface TranscriptionStartInput {
  readonly locale: string;
  readonly disclosureAccepted: boolean;
}

export interface TranscriptionSession {
  readonly sessionId: string;
  stop(): Promise<TranscriptResult>;
  abort(): void;
  subscribe(listener: (result: TranscriptResult) => void): () => void;
}

export interface TranscriptionProvider {
  readonly kind: "browser-speech" | "manual" | "none";
  getCapability(): Promise<TranscriptionCapability>;
  start(
    input: TranscriptionStartInput,
    signal?: CancellationSignal,
  ): Promise<TranscriptionSession>;
}

export interface AnswerAnalyzer {
  readonly analyzerId: string;
  readonly heuristicVersion: string;
  analyze(input: AnswerAnalysisInput): AnswerAnalysis;
}

export interface FairnessComparator {
  readonly algorithmVersion: string;
  compare(trials: readonly FairnessTrial[]): FairnessComparison;
}

export interface PageRequest {
  readonly cursor?: string;
  readonly pageSize: number;
}

export interface PageResult<Value> {
  readonly values: readonly Value[];
  readonly nextCursor?: string;
}

export interface SessionSearchQuery {
  readonly text?: string;
  readonly statuses?: readonly InterviewSessionStatus[];
  readonly categories?: readonly InterviewCategory[];
  readonly createdAfter?: IsoDateTime;
  readonly createdBefore?: IsoDateTime;
  readonly includesSavedRecording?: boolean;
  readonly isDemo?: boolean;
  readonly sort:
    "updated-desc" | "updated-asc" | "created-desc" | "job-title-asc";
}

export type StorageMode = "persistent" | "ephemeral" | "read-only-recovery";

export type StorageFailureCode =
  | "blocked"
  | "unavailable"
  | "quota-exceeded"
  | "transaction-aborted"
  | "record-corrupt"
  | "future-version"
  | "not-open"
  | "unknown";

export interface StorageFailure {
  readonly code: StorageFailureCode;
  readonly operation: string;
  readonly recoverable: boolean;
  readonly actions: readonly (
    | "retry"
    | "use-ephemeral-session"
    | "export"
    | "delete-selected-data"
    | "continue-without-recording"
  )[];
}

export type StorageResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: StorageFailure };

export interface StorageOpenState {
  readonly mode: StorageMode;
  readonly databaseVersion: number;
  readonly supportedVersion: number;
}

export interface QuarantinedRecord {
  readonly storeName: string;
  readonly key: string;
  readonly detectedAt: IsoDateTime;
  readonly schemaVersion?: number;
  readonly reasonCode: "schema-invalid" | "guard-rejected";
}

export type DeleteScope =
  | { readonly kind: "recording"; readonly id: RecordingId }
  | { readonly kind: "response"; readonly id: QuestionResponseId }
  | { readonly kind: "fairness-trial"; readonly id: FairnessTrialId }
  | { readonly kind: "fairness-comparison"; readonly id: FairnessComparisonId }
  | { readonly kind: "session"; readonly id: InterviewSessionId }
  | { readonly kind: "demo-data" }
  | { readonly kind: "all-data"; readonly includeSettings: boolean };

export interface DeletionSummary {
  readonly scope: DeleteScope["kind"];
  readonly sessions: number;
  readonly responses: number;
  readonly recordings: number;
  readonly fairnessTrials: number;
  readonly fairnessComparisons: number;
  readonly settings: number;
}

export interface FairScreenRepository {
  open(): Promise<StorageResult<StorageOpenState>>;
  close(): void;
  getSession(
    id: InterviewSessionId,
  ): Promise<StorageResult<InterviewSession | null>>;
  listSessions(
    query: SessionSearchQuery,
    page: PageRequest,
  ): Promise<StorageResult<PageResult<InterviewSession>>>;
  saveSession(session: InterviewSession): Promise<StorageResult<void>>;
  getResponse(
    id: QuestionResponseId,
  ): Promise<StorageResult<QuestionResponse | null>>;
  listResponses(
    sessionId: InterviewSessionId,
  ): Promise<StorageResult<readonly QuestionResponse[]>>;
  saveResponse(response: QuestionResponse): Promise<StorageResult<void>>;
  getFairnessTrial(
    id: FairnessTrialId,
  ): Promise<StorageResult<FairnessTrial | null>>;
  getFairnessComparison(
    id: FairnessComparisonId,
  ): Promise<StorageResult<FairnessComparison | null>>;
  saveFairnessComparison(
    comparison: FairnessComparison,
    trials: readonly FairnessTrial[],
  ): Promise<StorageResult<void>>;
  getSettings(): Promise<StorageResult<UserSettings>>;
  saveSettings(settings: UserSettings): Promise<StorageResult<void>>;
  resetSettings(): Promise<StorageResult<UserSettings>>;
  delete(scope: DeleteScope): Promise<StorageResult<DeletionSummary>>;
  listQuarantinedRecords(): Promise<
    StorageResult<readonly QuarantinedRecord[]>
  >;
}
