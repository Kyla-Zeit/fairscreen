import type {
  ByteCount,
  IsoDateTime,
  Milliseconds,
  QuestionResponseId,
  RecordingId,
} from "../../../domain/common";
import type { RecordingReference } from "../../../domain/models";
import type { StorageFailure, StorageResult } from "../../../domain/ports";
import {
  requestResult,
  storageFailure,
  storageSuccess,
  transactionDone,
} from "../db/idb";
import { STORE_NAMES } from "../db/schema";

export interface SavedRecordingInput {
  readonly id: RecordingId;
  readonly responseId: QuestionResponseId;
  readonly mimeType: string;
  readonly sizeBytes: ByteCount;
  readonly durationMs: Milliseconds;
  readonly savedByUserAt: IsoDateTime;
  readonly blob: Blob;
}

interface StoredRecording extends SavedRecordingInput {
  readonly createdAt: IsoDateTime;
}

export class IndexedDbRecordingRepository {
  readonly #database: IDBDatabase;
  readonly #failOperation:
    ((operation: string) => StorageFailure | undefined) | undefined;

  constructor(
    database: IDBDatabase,
    failOperation?: (operation: string) => StorageFailure | undefined,
  ) {
    this.#database = database;
    this.#failOperation = failOperation;
  }

  async saveAfterUserChoice(
    input: SavedRecordingInput,
  ): Promise<StorageResult<RecordingReference>> {
    if (
      input.blob.size !== input.sizeBytes ||
      input.mimeType.trim().length === 0 ||
      (input.blob.type && input.blob.type !== input.mimeType)
    ) {
      return corruptRecordingFailure("save-recording");
    }
    const injected = this.#failOperation?.("save-recording");
    if (injected) return { ok: false, error: injected };

    const stored: StoredRecording = {
      ...input,
      createdAt: input.savedByUserAt,
    };
    try {
      const transaction = this.#database.transaction(
        STORE_NAMES.recordings,
        "readwrite",
      );
      transaction.objectStore(STORE_NAMES.recordings).put(stored);
      const commitFailure = this.#failOperation?.("save-recording:commit");
      if (commitFailure) {
        transaction.abort();
        try {
          await transactionDone(transaction);
        } catch {
          // The injected result below is the privacy-safe failure.
        }
        return { ok: false, error: commitFailure };
      }
      await transactionDone(transaction);
      return storageSuccess(toReference(stored));
    } catch (error) {
      return storageFailure("save-recording", error);
    }
  }

  async get(
    id: RecordingId,
  ): Promise<StorageResult<SavedRecordingInput | null>> {
    try {
      const transaction = this.#database.transaction(
        STORE_NAMES.recordings,
        "readonly",
      );
      const value: unknown = await requestResult(
        transaction.objectStore(STORE_NAMES.recordings).get(id),
      );
      await transactionDone(transaction);
      if (value === undefined) return storageSuccess(null);
      if (!isStoredRecording(value)) {
        return corruptRecordingFailure("get-recording");
      }
      return storageSuccess({
        id: value.id,
        responseId: value.responseId,
        mimeType: value.mimeType,
        sizeBytes: value.sizeBytes,
        durationMs: value.durationMs,
        savedByUserAt: value.savedByUserAt,
        blob: value.blob,
      });
    } catch (error) {
      return storageFailure("get-recording", error);
    }
  }
}

function toReference(recording: StoredRecording): RecordingReference {
  return {
    id: recording.id,
    mimeType: recording.mimeType,
    sizeBytes: recording.sizeBytes,
    durationMs: recording.durationMs,
    savedByUserAt: recording.savedByUserAt,
  };
}

function isStoredRecording(value: unknown): value is StoredRecording {
  return Boolean(
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string" &&
    "responseId" in value &&
    typeof value.responseId === "string" &&
    "mimeType" in value &&
    typeof value.mimeType === "string" &&
    "sizeBytes" in value &&
    typeof value.sizeBytes === "number" &&
    "durationMs" in value &&
    typeof value.durationMs === "number" &&
    "savedByUserAt" in value &&
    typeof value.savedByUserAt === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "blob" in value &&
    value.blob instanceof Blob,
  );
}

function corruptRecordingFailure(operation: string): StorageResult<never> {
  return {
    ok: false,
    error: {
      code: "record-corrupt",
      operation,
      recoverable: true,
      actions: ["export", "continue-without-recording"],
    },
  };
}
