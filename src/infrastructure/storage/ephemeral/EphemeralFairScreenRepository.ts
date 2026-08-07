/* eslint-disable @typescript-eslint/require-await -- synchronous semantics intentionally satisfy the async repository port */

import type {
  FairnessComparisonId,
  FairnessTrialId,
  InterviewSessionId,
  QuestionResponseId,
} from "../../../domain/common";
import {
  buildDeletionPlan,
  type RecordingOwner,
} from "../../../domain/deletionPlan";
import {
  validateFairnessComparison,
  validateResponse,
  validateSession,
} from "../../../domain/invariants";
import type {
  FairnessComparison,
  FairnessTrial,
  InterviewSession,
  QuestionResponse,
  UserSettings,
} from "../../../domain/models";
import type {
  Clock,
  DeleteScope,
  FairScreenRepository,
  PageRequest,
  PageResult,
  QuarantinedRecord,
  SessionSearchQuery,
  StorageFailure,
  StorageOpenState,
  StorageResult,
} from "../../../domain/ports";
import { filterAndPageSessions } from "../../../domain/search";
import { createDefaultUserSettings } from "../../../features/settings/defaults";
import { SystemClock } from "../../browser/providers";
import {
  parseFairnessComparison,
  parseFairnessTrial,
  parseInterviewSession,
  parseQuestionResponse,
  parseUserSettings,
} from "../schemas/domainSchemas";
import { assertPersistenceSafe, cloneRecord } from "../repositoryGuards";
import { DATABASE_SCHEMA_VERSION } from "../db/schema";

export interface EphemeralRepositoryOptions {
  readonly clock?: Clock;
  readonly databaseVersion?: number;
  readonly failOperation?: (operation: string) => StorageFailure | undefined;
}

export class EphemeralFairScreenRepository implements FairScreenRepository {
  readonly #clock: Clock;
  readonly #databaseVersion: number;
  readonly #failOperation:
    ((operation: string) => StorageFailure | undefined) | undefined;
  readonly #sessions = new Map<string, unknown>();
  readonly #responses = new Map<string, unknown>();
  readonly #trials = new Map<string, unknown>();
  readonly #comparisons = new Map<string, unknown>();
  readonly #settings = new Map<string, unknown>();
  readonly #quarantine = new Map<string, QuarantinedRecord>();
  #openState: StorageOpenState | undefined;

  constructor(options: EphemeralRepositoryOptions = {}) {
    this.#clock = options.clock ?? new SystemClock();
    this.#databaseVersion = options.databaseVersion ?? DATABASE_SCHEMA_VERSION;
    this.#failOperation = options.failOperation;
  }

  async open(): Promise<StorageResult<StorageOpenState>> {
    const injectedFailure = this.#failure("open");
    if (injectedFailure) {
      return { ok: false, error: injectedFailure };
    }

    this.#openState = {
      mode:
        this.#databaseVersion > DATABASE_SCHEMA_VERSION
          ? "read-only-recovery"
          : "ephemeral",
      databaseVersion: this.#databaseVersion,
      supportedVersion: DATABASE_SCHEMA_VERSION,
    };
    return { ok: true, value: this.#openState };
  }

  close(): void {
    this.#openState = undefined;
  }

  async getSession(
    id: InterviewSessionId,
  ): Promise<StorageResult<InterviewSession | null>> {
    return this.#read(
      "get-session",
      "sessions",
      id,
      this.#sessions.get(id),
      parseInterviewSession,
    );
  }

  async listSessions(
    query: SessionSearchQuery,
    page: PageRequest,
  ): Promise<StorageResult<PageResult<InterviewSession>>> {
    const readiness = this.#ready("list-sessions");
    if (readiness) {
      return readiness;
    }

    const sessions = this.#parseAll(
      "sessions",
      this.#sessions,
      parseInterviewSession,
    );
    const responses = this.#parseAll(
      "responses",
      this.#responses,
      parseQuestionResponse,
    );
    return {
      ok: true,
      value: cloneRecord(
        filterAndPageSessions(sessions, responses, query, page),
      ),
    };
  }

  async saveSession(session: InterviewSession): Promise<StorageResult<void>> {
    const readiness = this.#writable("save-session");
    if (readiness) {
      return readiness;
    }
    try {
      assertPersistenceSafe(session);
      const parsed = validateSession(parseInterviewSession(session));
      const injectedFailure = this.#failure("save-session:commit");
      if (injectedFailure) {
        return { ok: false, error: injectedFailure };
      }
      this.#sessions.set(parsed.id, cloneRecord(parsed));
      return { ok: true, value: undefined };
    } catch {
      return this.#corruptFailure("save-session");
    }
  }

  async getResponse(
    id: QuestionResponseId,
  ): Promise<StorageResult<QuestionResponse | null>> {
    return this.#read(
      "get-response",
      "responses",
      id,
      this.#responses.get(id),
      parseQuestionResponse,
    );
  }

  async listResponses(
    sessionId: InterviewSessionId,
  ): Promise<StorageResult<readonly QuestionResponse[]>> {
    const readiness = this.#ready("list-responses");
    if (readiness) {
      return readiness;
    }
    const values = this.#parseAll(
      "responses",
      this.#responses,
      parseQuestionResponse,
    )
      .filter((response) => response.sessionId === sessionId)
      .sort((left, right) => left.attemptNumber - right.attemptNumber);
    return { ok: true, value: cloneRecord(values) };
  }

  async saveResponse(response: QuestionResponse): Promise<StorageResult<void>> {
    const readiness = this.#writable("save-response");
    if (readiness) {
      return readiness;
    }
    try {
      assertPersistenceSafe(response);
      const parsed = validateResponse(parseQuestionResponse(response));
      const injectedFailure = this.#failure("save-response:commit");
      if (injectedFailure) {
        return { ok: false, error: injectedFailure };
      }
      this.#responses.set(parsed.id, cloneRecord(parsed));
      return { ok: true, value: undefined };
    } catch {
      return this.#corruptFailure("save-response");
    }
  }

  async getFairnessTrial(
    id: FairnessTrialId,
  ): Promise<StorageResult<FairnessTrial | null>> {
    return this.#read(
      "get-fairness-trial",
      "fairnessTrials",
      id,
      this.#trials.get(id),
      parseFairnessTrial,
    );
  }

  async getFairnessComparison(
    id: FairnessComparisonId,
  ): Promise<StorageResult<FairnessComparison | null>> {
    return this.#read(
      "get-fairness-comparison",
      "fairnessComparisons",
      id,
      this.#comparisons.get(id),
      parseFairnessComparison,
    );
  }

  async saveFairnessComparison(
    comparison: FairnessComparison,
    trials: readonly FairnessTrial[],
  ): Promise<StorageResult<void>> {
    const readiness = this.#writable("save-fairness-comparison");
    if (readiness) {
      return readiness;
    }
    try {
      assertPersistenceSafe(comparison);
      const parsedComparison = validateFairnessComparison(
        parseFairnessComparison(comparison),
      );
      const parsedTrials = trials.map((trial) => {
        assertPersistenceSafe(trial);
        const parsed = parseFairnessTrial(trial);
        if (parsed.comparisonId !== parsedComparison.id) {
          throw new Error("trial-comparison-mismatch");
        }
        return parsed;
      });
      const injectedFailure = this.#failure("save-fairness-comparison:commit");
      if (injectedFailure) {
        return { ok: false, error: injectedFailure };
      }
      this.#comparisons.set(parsedComparison.id, cloneRecord(parsedComparison));
      for (const trial of parsedTrials) {
        this.#trials.set(trial.id, cloneRecord(trial));
      }
      return { ok: true, value: undefined };
    } catch {
      return this.#corruptFailure("save-fairness-comparison");
    }
  }

  async getSettings(): Promise<StorageResult<UserSettings>> {
    const readiness = this.#ready("get-settings");
    if (readiness) {
      return readiness;
    }
    const existing = this.#settings.get("user-settings");
    if (!existing) {
      return { ok: true, value: createDefaultUserSettings(this.#clock) };
    }
    const result = this.#read(
      "get-settings",
      "settings",
      "user-settings",
      existing,
      parseUserSettings,
    );
    return result.ok && result.value
      ? { ok: true, value: result.value }
      : result.ok
        ? { ok: true, value: createDefaultUserSettings(this.#clock) }
        : result;
  }

  async saveSettings(settings: UserSettings): Promise<StorageResult<void>> {
    const readiness = this.#writable("save-settings");
    if (readiness) {
      return readiness;
    }
    try {
      assertPersistenceSafe(settings);
      const parsed = parseUserSettings(settings);
      const injectedFailure = this.#failure("save-settings:commit");
      if (injectedFailure) {
        return { ok: false, error: injectedFailure };
      }
      this.#settings.set("user-settings", cloneRecord(parsed));
      return { ok: true, value: undefined };
    } catch {
      return this.#corruptFailure("save-settings");
    }
  }

  async resetSettings(): Promise<StorageResult<UserSettings>> {
    const defaults = createDefaultUserSettings(this.#clock);
    const saved = await this.saveSettings(defaults);
    return saved.ok ? { ok: true, value: defaults } : saved;
  }

  async delete(
    scope: DeleteScope,
  ): Promise<StorageResult<ReturnType<typeof buildDeletionPlan>["summary"]>> {
    const readiness = this.#writable(`delete-${scope.kind}`);
    if (readiness) {
      return readiness;
    }

    const state = {
      sessions: this.#parseAll(
        "sessions",
        this.#sessions,
        parseInterviewSession,
      ),
      responses: this.#parseAll(
        "responses",
        this.#responses,
        parseQuestionResponse,
      ),
      recordings: this.#recordingOwners(),
      fairnessTrials: this.#parseAll(
        "fairnessTrials",
        this.#trials,
        parseFairnessTrial,
      ),
      fairnessComparisons: this.#parseAll(
        "fairnessComparisons",
        this.#comparisons,
        parseFairnessComparison,
      ),
      settingsPresent: this.#settings.has("user-settings"),
    };
    const plan = buildDeletionPlan(scope, state, this.#clock.now());
    const injectedFailure = this.#failure(`delete-${scope.kind}:commit`);
    if (injectedFailure) {
      return { ok: false, error: injectedFailure };
    }

    if (scope.kind === "all-data") {
      this.#sessions.clear();
      this.#responses.clear();
      this.#trials.clear();
      this.#comparisons.clear();
      this.#quarantine.clear();
      if (scope.includeSettings) {
        this.#settings.clear();
      }
      return { ok: true, value: plan.summary };
    }

    for (const id of plan.deleteSessionIds) this.#sessions.delete(id);
    for (const id of plan.deleteResponseIds) this.#responses.delete(id);
    for (const id of plan.deleteTrialIds) this.#trials.delete(id);
    for (const id of plan.deleteComparisonIds) this.#comparisons.delete(id);
    for (const session of plan.updatedSessions)
      this.#sessions.set(session.id, cloneRecord(session));
    for (const response of plan.updatedResponses)
      this.#responses.set(response.id, cloneRecord(response));
    for (const comparison of plan.updatedComparisons)
      this.#comparisons.set(comparison.id, cloneRecord(comparison));

    return { ok: true, value: plan.summary };
  }

  async listQuarantinedRecords(): Promise<
    StorageResult<readonly QuarantinedRecord[]>
  > {
    const readiness = this.#ready("list-quarantine");
    return (
      readiness ?? {
        ok: true,
        value: cloneRecord([...this.#quarantine.values()]),
      }
    );
  }

  /** Test/recovery fixture hook; regular application code never calls this. */
  injectUntrustedRecord(
    store: "sessions" | "responses" | "fairnessTrials" | "fairnessComparisons",
    key: string,
    value: unknown,
  ): void {
    const stores = {
      sessions: this.#sessions,
      responses: this.#responses,
      fairnessTrials: this.#trials,
      fairnessComparisons: this.#comparisons,
    };
    stores[store].set(key, value);
  }

  #recordingOwners(): readonly RecordingOwner[] {
    return this.#parseAll(
      "responses",
      this.#responses,
      parseQuestionResponse,
    ).flatMap((response) =>
      response.recording
        ? [{ id: response.recording.id, responseId: response.id }]
        : [],
    );
  }

  #parseAll<Value>(
    storeName: string,
    store: ReadonlyMap<string, unknown>,
    parser: (input: unknown) => Value,
  ): Value[] {
    const values: Value[] = [];
    for (const [key, value] of store) {
      try {
        assertPersistenceSafe(value);
        values.push(parser(value));
      } catch {
        this.#quarantineRecord(storeName, key, value);
      }
    }
    return values;
  }

  #read<Value>(
    operation: string,
    storeName: string,
    key: string,
    value: unknown,
    parser: (input: unknown) => Value,
  ): StorageResult<Value | null> {
    const readiness = this.#ready(operation);
    if (readiness) {
      return readiness;
    }
    if (value === undefined) {
      return { ok: true, value: null };
    }
    try {
      assertPersistenceSafe(value);
      return { ok: true, value: cloneRecord(parser(value)) };
    } catch {
      this.#quarantineRecord(storeName, key, value);
      return this.#corruptFailure(operation);
    }
  }

  #quarantineRecord(storeName: string, key: string, value: unknown): void {
    const schemaVersion = extractSchemaVersion(value);
    const record: QuarantinedRecord = {
      storeName,
      key,
      detectedAt: this.#clock.now(),
      ...(schemaVersion === undefined ? {} : { schemaVersion }),
      reasonCode: "schema-invalid",
    };
    this.#quarantine.set(`${storeName}:${key}`, record);
  }

  #ready(operation: string): StorageResult<never> | undefined {
    if (!this.#openState) {
      return {
        ok: false,
        error: {
          code: "not-open",
          operation,
          recoverable: true,
          actions: ["retry", "use-ephemeral-session"],
        },
      };
    }
    return undefined;
  }

  #writable(operation: string): StorageResult<never> | undefined {
    const readiness = this.#ready(operation);
    if (readiness) {
      return readiness;
    }
    if (this.#openState?.mode === "read-only-recovery") {
      return {
        ok: false,
        error: {
          code: "future-version",
          operation,
          recoverable: true,
          actions: ["export"],
        },
      };
    }
    const injectedFailure = this.#failure(operation);
    return injectedFailure ? { ok: false, error: injectedFailure } : undefined;
  }

  #failure(operation: string): StorageFailure | undefined {
    return this.#failOperation?.(operation);
  }

  #corruptFailure(operation: string): StorageResult<never> {
    return {
      ok: false,
      error: {
        code: "record-corrupt",
        operation,
        recoverable: true,
        actions: ["export", "use-ephemeral-session"],
      },
    };
  }
}

function extractSchemaVersion(value: unknown): number | undefined {
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    typeof value.schemaVersion === "number"
  ) {
    return value.schemaVersion;
  }
  return undefined;
}
