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
  DeletionSummary,
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
import {
  filterAndPageSessions,
  normalizeSearchText,
} from "../../../domain/search";
import { createDefaultUserSettings } from "../../../features/settings/defaults";
import { SystemClock } from "../../browser/providers";
import {
  requestResult,
  storageFailure,
  storageSuccess,
  transactionDone,
} from "../db/idb";
import {
  ALL_STORE_NAMES,
  DATABASE_NAME,
  DATABASE_SCHEMA_VERSION,
  STORE_NAMES,
  type StoreName,
} from "../db/schema";
import { applyDatabaseMigrations } from "../migrations";
import { assertPersistenceSafe, cloneRecord } from "../repositoryGuards";
import {
  metadataRecordSchema,
  parseFairnessComparison,
  parseFairnessTrial,
  parseInterviewSession,
  parseQuestionResponse,
  parseUserSettings,
  storedSessionSchema,
} from "../schemas/domainSchemas";

interface StoredRecordingOwner extends RecordingOwner {
  readonly createdAt: string;
}

export interface IndexedDbRepositoryOptions {
  readonly factory?: IDBFactory | null;
  readonly databaseName?: string;
  readonly clock?: Clock;
  readonly failOperation?: (operation: string) => StorageFailure | undefined;
}

export class IndexedDbFairScreenRepository implements FairScreenRepository {
  readonly #factory: IDBFactory | undefined;
  readonly #databaseName: string;
  readonly #clock: Clock;
  readonly #failOperation:
    ((operation: string) => StorageFailure | undefined) | undefined;
  #database: IDBDatabase | undefined;
  #openState: StorageOpenState | undefined;

  constructor(options: IndexedDbRepositoryOptions = {}) {
    this.#factory =
      options.factory === null
        ? undefined
        : (options.factory ??
          (typeof indexedDB === "undefined" ? undefined : indexedDB));
    this.#databaseName = options.databaseName ?? DATABASE_NAME;
    this.#clock = options.clock ?? new SystemClock();
    this.#failOperation = options.failOperation;
  }

  async open(): Promise<StorageResult<StorageOpenState>> {
    if (this.#openState) {
      return storageSuccess(this.#openState);
    }
    const injected = this.#failure("open");
    if (injected) {
      return { ok: false, error: injected };
    }
    if (!this.#factory) {
      return {
        ok: false,
        error: {
          code: "unavailable",
          operation: "open",
          recoverable: true,
          actions: ["use-ephemeral-session", "export"],
        },
      };
    }

    try {
      const openDatabase = (version?: number) =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const request =
            version === undefined
              ? this.#factory?.open(this.#databaseName)
              : this.#factory?.open(this.#databaseName, version);
          if (!request) {
            reject(
              new DOMException("IndexedDB unavailable", "NotSupportedError"),
            );
            return;
          }
          request.onupgradeneeded = (event) => {
            const transaction = request.transaction;
            if (!transaction) {
              request.result.close();
              reject(new DOMException("Upgrade unavailable", "AbortError"));
              return;
            }
            applyDatabaseMigrations(
              request.result,
              transaction,
              event.oldVersion,
              event.newVersion ?? DATABASE_SCHEMA_VERSION,
            );
          };
          request.onblocked = () => {
            reject(
              new DOMException("Database open blocked", "InvalidStateError"),
            );
          };
          request.onerror = () => {
            reject(
              request.error ??
                new DOMException("Database open failed", "UnknownError"),
            );
          };
          request.onsuccess = () => {
            resolve(request.result);
          };
        });

      let database: IDBDatabase;
      try {
        database = await openDatabase(DATABASE_SCHEMA_VERSION);
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== "VersionError") {
          throw error;
        }
        database = await openDatabase();
      }

      this.#database = database;
      database.onversionchange = () => {
        database.close();
        this.#database = undefined;
        this.#openState = undefined;
      };
      this.#openState = {
        mode:
          database.version > DATABASE_SCHEMA_VERSION
            ? "read-only-recovery"
            : "persistent",
        databaseVersion: database.version,
        supportedVersion: DATABASE_SCHEMA_VERSION,
      };

      if (this.#openState.mode === "persistent") {
        await this.#writeSchemaMetadata();
      }
      return storageSuccess(this.#openState);
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        return {
          ok: false,
          error: {
            code: "blocked",
            operation: "open",
            recoverable: true,
            actions: ["retry", "use-ephemeral-session"],
          },
        };
      }
      return storageFailure("open", error);
    }
  }

  close(): void {
    this.#database?.close();
    this.#database = undefined;
    this.#openState = undefined;
  }

  async getSession(
    id: InterviewSessionId,
  ): Promise<StorageResult<InterviewSession | null>> {
    const result = await this.#getUnknown(
      STORE_NAMES.sessions,
      id,
      "get-session",
    );
    if (!result.ok || result.value === undefined) {
      return result.ok ? storageSuccess(null) : result;
    }
    try {
      assertPersistenceSafe(result.value);
      return storageSuccess(
        cloneRecord(
          parseInterviewSession(storedSessionSchema.parse(result.value).record),
        ),
      );
    } catch {
      await this.#quarantine(STORE_NAMES.sessions, id, result.value);
      return this.#corruptFailure("get-session");
    }
  }

  async listSessions(
    query: SessionSearchQuery,
    page: PageRequest,
  ): Promise<StorageResult<PageResult<InterviewSession>>> {
    const sessionValues = await this.#getAllUnknown(
      STORE_NAMES.sessions,
      "list-sessions",
    );
    if (!sessionValues.ok) {
      return sessionValues;
    }
    const responseValues = await this.#getAllUnknown(
      STORE_NAMES.responses,
      "list-sessions-responses",
    );
    if (!responseValues.ok) {
      return responseValues;
    }

    const sessions: InterviewSession[] = [];
    for (const value of sessionValues.value) {
      try {
        assertPersistenceSafe(value);
        sessions.push(
          parseInterviewSession(storedSessionSchema.parse(value).record),
        );
      } catch {
        await this.#quarantine(
          STORE_NAMES.sessions,
          extractStringKey(value),
          value,
        );
      }
    }
    const responses: QuestionResponse[] = [];
    for (const value of responseValues.value) {
      try {
        assertPersistenceSafe(value);
        responses.push(parseQuestionResponse(value));
      } catch {
        await this.#quarantine(
          STORE_NAMES.responses,
          extractStringKey(value),
          value,
        );
      }
    }
    return storageSuccess(
      cloneRecord(filterAndPageSessions(sessions, responses, query, page)),
    );
  }

  async saveSession(session: InterviewSession): Promise<StorageResult<void>> {
    const readiness = this.#writable("save-session");
    if (readiness) return readiness;
    try {
      assertPersistenceSafe(session);
      const parsed = validateSession(parseInterviewSession(session));
      const stored = storedSessionSchema.parse({
        id: parsed.id,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
        status: parsed.status,
        category: parsed.context.category,
        jobTitleNormalized: normalizeSearchText(parsed.context.jobTitle),
        record: parsed,
      });
      return await this.#writeValues("save-session", STORE_NAMES.sessions, [
        stored,
      ]);
    } catch {
      return this.#corruptFailure("save-session");
    }
  }

  async getResponse(
    id: QuestionResponseId,
  ): Promise<StorageResult<QuestionResponse | null>> {
    return this.#readParsed(
      STORE_NAMES.responses,
      id,
      "get-response",
      parseQuestionResponse,
    );
  }

  async listResponses(
    sessionId: InterviewSessionId,
  ): Promise<StorageResult<readonly QuestionResponse[]>> {
    const values = await this.#getAllUnknown(
      STORE_NAMES.responses,
      "list-responses",
    );
    if (!values.ok) return values;
    const responses: QuestionResponse[] = [];
    for (const value of values.value) {
      try {
        assertPersistenceSafe(value);
        const response = parseQuestionResponse(value);
        if (response.sessionId === sessionId) responses.push(response);
      } catch {
        await this.#quarantine(
          STORE_NAMES.responses,
          extractStringKey(value),
          value,
        );
      }
    }
    return storageSuccess(
      cloneRecord(
        responses.sort(
          (left, right) => left.attemptNumber - right.attemptNumber,
        ),
      ),
    );
  }

  async saveResponse(response: QuestionResponse): Promise<StorageResult<void>> {
    const readiness = this.#writable("save-response");
    if (readiness) return readiness;
    try {
      assertPersistenceSafe(response);
      const parsed = validateResponse(parseQuestionResponse(response));
      return await this.#writeValues("save-response", STORE_NAMES.responses, [
        parsed,
      ]);
    } catch {
      return this.#corruptFailure("save-response");
    }
  }

  async getFairnessTrial(
    id: FairnessTrialId,
  ): Promise<StorageResult<FairnessTrial | null>> {
    return this.#readParsed(
      STORE_NAMES.fairnessTrials,
      id,
      "get-fairness-trial",
      parseFairnessTrial,
    );
  }

  async getFairnessComparison(
    id: FairnessComparisonId,
  ): Promise<StorageResult<FairnessComparison | null>> {
    return this.#readParsed(
      STORE_NAMES.fairnessComparisons,
      id,
      "get-fairness-comparison",
      parseFairnessComparison,
    );
  }

  async saveFairnessComparison(
    comparison: FairnessComparison,
    trials: readonly FairnessTrial[],
  ): Promise<StorageResult<void>> {
    const readiness = this.#writable("save-fairness-comparison");
    if (readiness) return readiness;
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
      return await this.#writeComparison(parsedComparison, parsedTrials);
    } catch {
      return this.#corruptFailure("save-fairness-comparison");
    }
  }

  async getSettings(): Promise<StorageResult<UserSettings>> {
    const result = await this.#readParsed(
      STORE_NAMES.settings,
      "user-settings",
      "get-settings",
      parseUserSettings,
    );
    if (!result.ok) return result;
    return storageSuccess(
      result.value ?? createDefaultUserSettings(this.#clock),
    );
  }

  async saveSettings(settings: UserSettings): Promise<StorageResult<void>> {
    const readiness = this.#writable("save-settings");
    if (readiness) return readiness;
    try {
      assertPersistenceSafe(settings);
      return await this.#writeValues("save-settings", STORE_NAMES.settings, [
        parseUserSettings(settings),
      ]);
    } catch {
      return this.#corruptFailure("save-settings");
    }
  }

  async resetSettings(): Promise<StorageResult<UserSettings>> {
    const defaults = createDefaultUserSettings(this.#clock);
    const saved = await this.saveSettings(defaults);
    return saved.ok ? storageSuccess(defaults) : saved;
  }

  async delete(scope: DeleteScope): Promise<StorageResult<DeletionSummary>> {
    const readiness = this.#writable(`delete-${scope.kind}`);
    if (readiness) return readiness;

    const snapshot = await this.#loadDeletionState();
    if (!snapshot.ok) return snapshot;
    const plan = buildDeletionPlan(scope, snapshot.value, this.#clock.now());
    const database = this.#database;
    if (!database) return this.#notOpen(`delete-${scope.kind}`);

    const transactionStores =
      scope.kind === "all-data"
        ? ALL_STORE_NAMES
        : [
            STORE_NAMES.sessions,
            STORE_NAMES.responses,
            STORE_NAMES.recordings,
            STORE_NAMES.fairnessTrials,
            STORE_NAMES.fairnessComparisons,
          ];

    try {
      const transaction = database.transaction(transactionStores, "readwrite");
      if (scope.kind === "all-data") {
        for (const storeName of [
          STORE_NAMES.sessions,
          STORE_NAMES.responses,
          STORE_NAMES.recordings,
          STORE_NAMES.fairnessTrials,
          STORE_NAMES.fairnessComparisons,
          STORE_NAMES.meta,
        ]) {
          transaction.objectStore(storeName).clear();
        }
        if (scope.includeSettings) {
          transaction.objectStore(STORE_NAMES.settings).clear();
        }
      } else {
        const sessionStore = transaction.objectStore(STORE_NAMES.sessions);
        const responseStore = transaction.objectStore(STORE_NAMES.responses);
        const recordingStore = transaction.objectStore(STORE_NAMES.recordings);
        const trialStore = transaction.objectStore(STORE_NAMES.fairnessTrials);
        const comparisonStore = transaction.objectStore(
          STORE_NAMES.fairnessComparisons,
        );

        for (const id of plan.deleteSessionIds) sessionStore.delete(id);
        for (const id of plan.deleteResponseIds) responseStore.delete(id);
        for (const id of plan.deleteRecordingIds) recordingStore.delete(id);
        for (const id of plan.deleteTrialIds) trialStore.delete(id);
        for (const id of plan.deleteComparisonIds) comparisonStore.delete(id);
        for (const session of plan.updatedSessions) {
          sessionStore.put(this.#storedSession(session));
        }
        for (const response of plan.updatedResponses)
          responseStore.put(response);
        for (const comparison of plan.updatedComparisons)
          comparisonStore.put(comparison);
      }

      const injected = this.#failure(`delete-${scope.kind}:commit`);
      if (injected) {
        transaction.abort();
        try {
          await transactionDone(transaction);
        } catch {
          // The injected result below is the privacy-safe failure.
        }
        return { ok: false, error: injected };
      }
      await transactionDone(transaction);
      if (scope.kind === "all-data") await this.#writeSchemaMetadata();
      return storageSuccess(plan.summary);
    } catch (error) {
      return storageFailure(`delete-${scope.kind}`, error);
    }
  }

  async listQuarantinedRecords(): Promise<
    StorageResult<readonly QuarantinedRecord[]>
  > {
    const values = await this.#getAllUnknown(
      STORE_NAMES.meta,
      "list-quarantine",
    );
    if (!values.ok) return values;
    const records: QuarantinedRecord[] = [];
    for (const value of values.value) {
      const parsed = metadataRecordSchema.safeParse(value);
      if (
        parsed.success &&
        parsed.data.kind === "quarantine" &&
        isQuarantineValue(parsed.data.value)
      ) {
        records.push({
          storeName: parsed.data.value.storeName,
          key: parsed.data.value.key,
          detectedAt: parsed.data.updatedAt,
          ...(typeof parsed.data.value.schemaVersion === "number"
            ? { schemaVersion: parsed.data.value.schemaVersion }
            : {}),
          reasonCode: parsed.data.value.reasonCode,
        });
      }
    }
    return storageSuccess(cloneRecord(records));
  }

  async #writeComparison(
    comparison: FairnessComparison,
    trials: readonly FairnessTrial[],
  ): Promise<StorageResult<void>> {
    const database = this.#database;
    if (!database) return this.#notOpen("save-fairness-comparison");
    try {
      const transaction = database.transaction(
        [STORE_NAMES.fairnessComparisons, STORE_NAMES.fairnessTrials],
        "readwrite",
      );
      transaction
        .objectStore(STORE_NAMES.fairnessComparisons)
        .put(cloneRecord(comparison));
      const trialStore = transaction.objectStore(STORE_NAMES.fairnessTrials);
      for (const trial of trials) trialStore.put(cloneRecord(trial));

      const injected = this.#failure("save-fairness-comparison:commit");
      if (injected) {
        transaction.abort();
        try {
          await transactionDone(transaction);
        } catch {
          // The injected result below is the privacy-safe failure.
        }
        return { ok: false, error: injected };
      }
      await transactionDone(transaction);
      return storageSuccess(undefined);
    } catch (error) {
      return storageFailure("save-fairness-comparison", error);
    }
  }

  async #writeValues(
    operation: string,
    storeName: StoreName,
    values: readonly unknown[],
  ): Promise<StorageResult<void>> {
    const database = this.#database;
    if (!database) return this.#notOpen(operation);
    try {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      for (const value of values) store.put(cloneRecord(value));
      const injected = this.#failure(`${operation}:commit`);
      if (injected) {
        transaction.abort();
        try {
          await transactionDone(transaction);
        } catch {
          // The injected result below is the privacy-safe failure.
        }
        return { ok: false, error: injected };
      }
      await transactionDone(transaction);
      return storageSuccess(undefined);
    } catch (error) {
      return storageFailure(operation, error);
    }
  }

  async #readParsed<Value>(
    storeName: StoreName,
    key: string,
    operation: string,
    parser: (input: unknown) => Value,
  ): Promise<StorageResult<Value | null>> {
    const result = await this.#getUnknown(storeName, key, operation);
    if (!result.ok || result.value === undefined) {
      return result.ok ? storageSuccess(null) : result;
    }
    try {
      assertPersistenceSafe(result.value);
      return storageSuccess(cloneRecord(parser(result.value)));
    } catch {
      await this.#quarantine(storeName, key, result.value);
      return this.#corruptFailure(operation);
    }
  }

  async #getUnknown(
    storeName: StoreName,
    key: IDBValidKey,
    operation: string,
  ): Promise<StorageResult<unknown>> {
    const readiness = this.#ready(operation);
    if (readiness) return readiness;
    try {
      const transaction = this.#database?.transaction(storeName, "readonly");
      if (!transaction) return this.#notOpen(operation);
      const request: IDBRequest<unknown> = transaction
        .objectStore(storeName)
        .get(key);
      const value = await requestResult(request);
      await transactionDone(transaction);
      return storageSuccess(value);
    } catch (error) {
      return storageFailure(operation, error);
    }
  }

  async #getAllUnknown(
    storeName: StoreName,
    operation: string,
  ): Promise<StorageResult<readonly unknown[]>> {
    const readiness = this.#ready(operation);
    if (readiness) return readiness;
    try {
      const transaction = this.#database?.transaction(storeName, "readonly");
      if (!transaction) return this.#notOpen(operation);
      const values = await requestResult(
        transaction.objectStore(storeName).getAll(),
      );
      await transactionDone(transaction);
      return storageSuccess(values);
    } catch (error) {
      return storageFailure(operation, error);
    }
  }

  async #loadDeletionState(): Promise<
    StorageResult<{
      sessions: readonly InterviewSession[];
      responses: readonly QuestionResponse[];
      recordings: readonly RecordingOwner[];
      fairnessTrials: readonly FairnessTrial[];
      fairnessComparisons: readonly FairnessComparison[];
      settingsPresent: boolean;
    }>
  > {
    const database = this.#database;
    if (!database) return this.#notOpen("load-deletion-state");
    try {
      const transaction = database.transaction(
        [
          STORE_NAMES.sessions,
          STORE_NAMES.responses,
          STORE_NAMES.recordings,
          STORE_NAMES.fairnessTrials,
          STORE_NAMES.fairnessComparisons,
          STORE_NAMES.settings,
        ],
        "readonly",
      );
      const sessionValues = await requestResult(
        transaction.objectStore(STORE_NAMES.sessions).getAll(),
      );
      const responseValues = await requestResult(
        transaction.objectStore(STORE_NAMES.responses).getAll(),
      );
      const recordingValues = await requestResult(
        transaction.objectStore(STORE_NAMES.recordings).getAll(),
      );
      const trialValues = await requestResult(
        transaction.objectStore(STORE_NAMES.fairnessTrials).getAll(),
      );
      const comparisonValues = await requestResult(
        transaction.objectStore(STORE_NAMES.fairnessComparisons).getAll(),
      );
      const settingsRequest: IDBRequest<unknown> = transaction
        .objectStore(STORE_NAMES.settings)
        .get("user-settings");
      const settingsValue = await requestResult(settingsRequest);
      await transactionDone(transaction);
      return storageSuccess({
        sessions: sessionValues.flatMap((value) => {
          const parsed = storedSessionSchema.safeParse(value);
          return parsed.success
            ? [parseInterviewSession(parsed.data.record)]
            : [];
        }),
        responses: responseValues.flatMap((value) => {
          const parsed = safeParse(parseQuestionResponse, value);
          return parsed ? [parsed] : [];
        }),
        recordings: recordingValues.flatMap((value) => {
          return isStoredRecordingOwner(value)
            ? [{ id: value.id, responseId: value.responseId }]
            : [];
        }),
        fairnessTrials: trialValues.flatMap((value) => {
          const parsed = safeParse(parseFairnessTrial, value);
          return parsed ? [parsed] : [];
        }),
        fairnessComparisons: comparisonValues.flatMap((value) => {
          const parsed = safeParse(parseFairnessComparison, value);
          return parsed ? [parsed] : [];
        }),
        settingsPresent: settingsValue !== undefined,
      });
    } catch (error) {
      return storageFailure("load-deletion-state", error);
    }
  }

  #storedSession(session: InterviewSession) {
    return storedSessionSchema.parse({
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      status: session.status,
      category: session.context.category,
      jobTitleNormalized: normalizeSearchText(session.context.jobTitle),
      record: session,
    });
  }

  async #quarantine(
    storeName: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    if (
      this.#openState?.mode !== "persistent" ||
      !this.#database?.objectStoreNames.contains(STORE_NAMES.meta)
    ) {
      return;
    }
    const schemaVersion = extractSchemaVersion(value);
    const metadata = metadataRecordSchema.parse({
      key: `quarantine:${storeName}:${key}`,
      kind: "quarantine",
      schemaVersion: DATABASE_SCHEMA_VERSION,
      updatedAt: this.#clock.now(),
      value: {
        storeName,
        key,
        ...(schemaVersion === undefined ? {} : { schemaVersion }),
        reasonCode: "schema-invalid",
      },
    });
    try {
      const transaction = this.#database.transaction(
        STORE_NAMES.meta,
        "readwrite",
      );
      transaction.objectStore(STORE_NAMES.meta).put(metadata);
      await transactionDone(transaction);
    } catch {
      // Quarantine metadata is best effort; the corrupt source record remains.
    }
  }

  async #writeSchemaMetadata(): Promise<void> {
    if (
      !this.#database ||
      !this.#database.objectStoreNames.contains(STORE_NAMES.meta)
    ) {
      return;
    }
    const metadata = metadataRecordSchema.parse({
      key: "schema",
      kind: "schema",
      schemaVersion: DATABASE_SCHEMA_VERSION,
      updatedAt: this.#clock.now(),
      value: { databaseSchemaVersion: DATABASE_SCHEMA_VERSION },
    });
    const transaction = this.#database.transaction(
      STORE_NAMES.meta,
      "readwrite",
    );
    transaction.objectStore(STORE_NAMES.meta).put(metadata);
    await transactionDone(transaction);
  }

  #ready(operation: string): StorageResult<never> | undefined {
    return this.#database && this.#openState
      ? undefined
      : this.#notOpen(operation);
  }

  #writable(operation: string): StorageResult<never> | undefined {
    const readiness = this.#ready(operation);
    if (readiness) return readiness;
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
    const injected = this.#failure(operation);
    return injected ? { ok: false, error: injected } : undefined;
  }

  #notOpen(operation: string): StorageResult<never> {
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

  #failure(operation: string): StorageFailure | undefined {
    return this.#failOperation?.(operation);
  }
}

function extractStringKey(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }
  return "unidentified";
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

function safeParse<Value>(
  parser: (input: unknown) => Value,
  input: unknown,
): Value | undefined {
  try {
    assertPersistenceSafe(input);
    return parser(input);
  } catch {
    return undefined;
  }
}

function isStoredRecordingOwner(value: unknown): value is StoredRecordingOwner {
  return Boolean(
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    "responseId" in value &&
    typeof value.responseId === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string",
  );
}

function isQuarantineValue(value: unknown): value is {
  readonly storeName: string;
  readonly key: string;
  readonly schemaVersion?: number;
  readonly reasonCode: "schema-invalid" | "guard-rejected";
} {
  return Boolean(
    value &&
    typeof value === "object" &&
    "storeName" in value &&
    typeof value.storeName === "string" &&
    "key" in value &&
    typeof value.key === "string" &&
    "reasonCode" in value &&
    ["schema-invalid", "guard-rejected"].includes(String(value.reasonCode)),
  );
}
