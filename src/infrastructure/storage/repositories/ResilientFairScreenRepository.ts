import type {
  FairnessComparisonId,
  FairnessTrialId,
  InterviewSessionId,
  QuestionResponseId,
} from "../../../domain/common";
import type {
  FairnessComparison,
  FairnessTrial,
  InterviewSession,
  QuestionResponse,
  UserSettings,
} from "../../../domain/models";
import type {
  DeletionSummary,
  DeleteScope,
  FairScreenRepository,
  PageRequest,
  PageResult,
  QuarantinedRecord,
  SessionSearchQuery,
  StorageOpenState,
  StorageResult,
} from "../../../domain/ports";
import { DATABASE_SCHEMA_VERSION } from "../db/schema";
import { storageSuccess } from "../db/idb";
import { IndexedDbFairScreenRepository } from "./IndexedDbFairScreenRepository";
import { LocalStorageFairScreenRepository } from "./LocalStorageFairScreenRepository";

interface ResilientRepositoryOptions {
  readonly primary?: FairScreenRepository;
  readonly fallback?: FairScreenRepository;
}

/**
 * Mirrors core writes to IndexedDB and localStorage. A write is considered
 * persistent when either durable browser store succeeds. This avoids losing a
 * reviewed answer because one browser storage implementation is blocked,
 * partially migrated, or aborts a transaction.
 */
export class ResilientFairScreenRepository implements FairScreenRepository {
  readonly #primary: FairScreenRepository;
  readonly #fallback: FairScreenRepository;
  #primaryAvailable = false;
  #fallbackAvailable = false;

  constructor(options: ResilientRepositoryOptions = {}) {
    this.#primary = options.primary ?? new IndexedDbFairScreenRepository();
    this.#fallback = options.fallback ?? new LocalStorageFairScreenRepository();
  }

  async open(): Promise<StorageResult<StorageOpenState>> {
    const [primary, fallback] = await Promise.all([
      this.#primary.open(),
      this.#fallback.open(),
    ]);
    this.#primaryAvailable = primary.ok;
    this.#fallbackAvailable = fallback.ok;

    if (!primary.ok && !fallback.ok) {
      return primary;
    }

    return storageSuccess({
      mode: "persistent",
      databaseVersion: primary.ok
        ? primary.value.databaseVersion
        : DATABASE_SCHEMA_VERSION,
      supportedVersion: DATABASE_SCHEMA_VERSION,
    });
  }

  close(): void {
    this.#primary.close();
    this.#fallback.close();
    this.#primaryAvailable = false;
    this.#fallbackAvailable = false;
  }

  async getSession(
    id: InterviewSessionId,
  ): Promise<StorageResult<InterviewSession | null>> {
    const [primary, fallback] = await Promise.all([
      this.#primaryAvailable
        ? this.#primary.getSession(id)
        : unavailable("get-session"),
      this.#fallbackAvailable
        ? this.#fallback.getSession(id)
        : unavailable("get-session-fallback"),
    ]);
    return chooseLatestRecord(primary, fallback);
  }

  async listSessions(
    query: SessionSearchQuery,
    page: PageRequest,
  ): Promise<StorageResult<PageResult<InterviewSession>>> {
    const widePage: PageRequest = { pageSize: Math.max(page.pageSize, 10_000) };
    const [primary, fallback] = await Promise.all([
      this.#primaryAvailable
        ? this.#primary.listSessions(query, widePage)
        : unavailable("list-sessions"),
      this.#fallbackAvailable
        ? this.#fallback.listSessions(query, widePage)
        : unavailable("list-sessions-fallback"),
    ]);

    if (!primary.ok && !fallback.ok) return primary;
    const merged = mergeByUpdatedAt(
      primary.ok ? primary.value.values : [],
      fallback.ok ? fallback.value.values : [],
    );
    const sorted = sortSessions(merged, query.sort);
    const values = sorted.slice(0, page.pageSize);
    return storageSuccess({
      values,
      ...(sorted.length > page.pageSize
        ? { nextCursor: String(page.pageSize) }
        : {}),
    });
  }

  saveSession(session: InterviewSession): Promise<StorageResult<void>> {
    return this.#writeBoth(
      "save-session",
      () => this.#primary.saveSession(session),
      () => this.#fallback.saveSession(session),
    );
  }

  async getResponse(
    id: QuestionResponseId,
  ): Promise<StorageResult<QuestionResponse | null>> {
    const [primary, fallback] = await Promise.all([
      this.#primaryAvailable
        ? this.#primary.getResponse(id)
        : unavailable("get-response"),
      this.#fallbackAvailable
        ? this.#fallback.getResponse(id)
        : unavailable("get-response-fallback"),
    ]);
    return chooseLatestRecord(primary, fallback);
  }

  async listResponses(
    sessionId: InterviewSessionId,
  ): Promise<StorageResult<readonly QuestionResponse[]>> {
    const [primary, fallback] = await Promise.all([
      this.#primaryAvailable
        ? this.#primary.listResponses(sessionId)
        : unavailable("list-responses"),
      this.#fallbackAvailable
        ? this.#fallback.listResponses(sessionId)
        : unavailable("list-responses-fallback"),
    ]);
    if (!primary.ok && !fallback.ok) return primary;
    return storageSuccess(
      mergeByUpdatedAt(
        primary.ok ? primary.value : [],
        fallback.ok ? fallback.value : [],
      ).sort((left, right) => left.attemptNumber - right.attemptNumber),
    );
  }

  saveResponse(response: QuestionResponse): Promise<StorageResult<void>> {
    return this.#writeBoth(
      "save-response",
      () => this.#primary.saveResponse(response),
      () => this.#fallback.saveResponse(response),
    );
  }

  async getFairnessTrial(
    id: FairnessTrialId,
  ): Promise<StorageResult<FairnessTrial | null>> {
    const primary = this.#primaryAvailable
      ? await this.#primary.getFairnessTrial(id)
      : unavailable<FairnessTrial | null>("get-fairness-trial");
    if (primary.ok && primary.value) return primary;
    return this.#fallbackAvailable
      ? this.#fallback.getFairnessTrial(id)
      : primary;
  }

  async getFairnessComparison(
    id: FairnessComparisonId,
  ): Promise<StorageResult<FairnessComparison | null>> {
    const primary = this.#primaryAvailable
      ? await this.#primary.getFairnessComparison(id)
      : unavailable<FairnessComparison | null>("get-fairness-comparison");
    if (primary.ok && primary.value) return primary;
    return this.#fallbackAvailable
      ? this.#fallback.getFairnessComparison(id)
      : primary;
  }

  saveFairnessComparison(
    comparison: FairnessComparison,
    trials: readonly FairnessTrial[],
  ): Promise<StorageResult<void>> {
    return this.#writeBoth(
      "save-fairness-comparison",
      () => this.#primary.saveFairnessComparison(comparison, trials),
      () => this.#fallback.saveFairnessComparison(comparison, trials),
    );
  }

  async getSettings(): Promise<StorageResult<UserSettings>> {
    const [primary, fallback] = await Promise.all([
      this.#primaryAvailable
        ? this.#primary.getSettings()
        : unavailable("get-settings"),
      this.#fallbackAvailable
        ? this.#fallback.getSettings()
        : unavailable("get-settings-fallback"),
    ]);
    if (primary.ok && fallback.ok) {
      return storageSuccess(
        primary.value.updatedAt > fallback.value.updatedAt
          ? primary.value
          : fallback.value,
      );
    }
    return primary.ok ? primary : fallback;
  }

  saveSettings(settings: UserSettings): Promise<StorageResult<void>> {
    return this.#writeBoth(
      "save-settings",
      () => this.#primary.saveSettings(settings),
      () => this.#fallback.saveSettings(settings),
    );
  }

  async resetSettings(): Promise<StorageResult<UserSettings>> {
    const [primary, fallback] = await Promise.all([
      this.#primaryAvailable
        ? this.#primary.resetSettings()
        : unavailable<UserSettings>("reset-settings"),
      this.#fallbackAvailable
        ? this.#fallback.resetSettings()
        : unavailable<UserSettings>("reset-settings-fallback"),
    ]);
    return fallback.ok ? fallback : primary;
  }

  async delete(scope: DeleteScope): Promise<StorageResult<DeletionSummary>> {
    const [primary, fallback] = await Promise.all([
      this.#primaryAvailable
        ? this.#primary.delete(scope)
        : unavailable<DeletionSummary>(`delete-${scope.kind}`),
      this.#fallbackAvailable
        ? this.#fallback.delete(scope)
        : unavailable<DeletionSummary>(`delete-${scope.kind}-fallback`),
    ]);
    return fallback.ok ? fallback : primary;
  }

  async listQuarantinedRecords(): Promise<
    StorageResult<readonly QuarantinedRecord[]>
  > {
    if (this.#primaryAvailable) return this.#primary.listQuarantinedRecords();
    if (this.#fallbackAvailable) return this.#fallback.listQuarantinedRecords();
    return unavailable("list-quarantined-records");
  }

  async #writeBoth(
    operation: string,
    primaryWrite: () => Promise<StorageResult<void>>,
    fallbackWrite: () => Promise<StorageResult<void>>,
  ): Promise<StorageResult<void>> {
    const [primary, fallback] = await Promise.all([
      this.#primaryAvailable
        ? primaryWrite()
        : unavailable(`${operation}-primary`),
      this.#fallbackAvailable
        ? fallbackWrite()
        : unavailable(`${operation}-fallback`),
    ]);

    if (primary.ok || fallback.ok) return storageSuccess(undefined);
    return fallback.error.code === "quota-exceeded" ? fallback : primary;
  }
}

function unavailable<Value = never>(operation: string): StorageResult<Value> {
  return {
    ok: false,
    error: {
      code: "unavailable",
      operation,
      recoverable: true,
      actions: ["retry", "use-ephemeral-session", "export"],
    },
  };
}

function chooseLatestRecord<Value extends { readonly updatedAt: string }>(
  primary: StorageResult<Value | null>,
  fallback: StorageResult<Value | null>,
): StorageResult<Value | null> {
  if (primary.ok && fallback.ok) {
    if (!primary.value) return fallback;
    if (!fallback.value) return primary;
    return storageSuccess(
      primary.value.updatedAt >= fallback.value.updatedAt
        ? primary.value
        : fallback.value,
    );
  }
  return primary.ok ? primary : fallback;
}

function mergeByUpdatedAt<
  Value extends { readonly id: string; readonly updatedAt: string },
>(primary: readonly Value[], fallback: readonly Value[]): Value[] {
  const merged = new Map<string, Value>();
  for (const record of [...primary, ...fallback]) {
    const existing = merged.get(record.id);
    if (!existing || record.updatedAt >= existing.updatedAt) {
      merged.set(record.id, record);
    }
  }
  return [...merged.values()];
}

function sortSessions(
  sessions: readonly InterviewSession[],
  sort: SessionSearchQuery["sort"],
): InterviewSession[] {
  return [...sessions].sort((left, right) => {
    switch (sort) {
      case "updated-asc":
        return left.updatedAt.localeCompare(right.updatedAt);
      case "created-desc":
        return right.createdAt.localeCompare(left.createdAt);
      case "job-title-asc":
        return left.context.jobTitle.localeCompare(right.context.jobTitle);
      case "updated-desc":
      default:
        return right.updatedAt.localeCompare(left.updatedAt);
    }
  });
}
