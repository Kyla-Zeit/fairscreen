import type { StorageFailure, StorageResult } from "../../../domain/ports";

export function requestResult<Value>(
  request: IDBRequest<Value>,
): Promise<Value> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(
        request.error ?? new DOMException("Request failed", "UnknownError"),
      );
    };
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onabort = () => {
      reject(
        transaction.error ??
          new DOMException("Transaction aborted", "AbortError"),
      );
    };
    transaction.onerror = () => {
      // The abort event reports the final transaction result.
    };
  });
}

export function storageSuccess<Value>(value: Value): StorageResult<Value> {
  return { ok: true, value };
}

export function storageFailure(
  operation: string,
  error: unknown,
): StorageResult<never> {
  return { ok: false, error: normalizeStorageFailure(operation, error) };
}

export function normalizeStorageFailure(
  operation: string,
  error: unknown,
): StorageFailure {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "QuotaExceededError") {
    return {
      code: "quota-exceeded",
      operation,
      recoverable: true,
      actions: [
        "continue-without-recording",
        "export",
        "delete-selected-data",
        "retry",
      ],
    };
  }
  if (name === "AbortError" || name === "TransactionInactiveError") {
    return {
      code: "transaction-aborted",
      operation,
      recoverable: true,
      actions: ["retry", "export", "use-ephemeral-session"],
    };
  }
  if (name === "VersionError") {
    return {
      code: "future-version",
      operation,
      recoverable: true,
      actions: ["export"],
    };
  }

  return {
    code: "unknown",
    operation,
    recoverable: true,
    actions: ["retry", "use-ephemeral-session", "export"],
  };
}
