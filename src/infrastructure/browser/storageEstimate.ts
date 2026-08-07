import type { ByteCount } from "../../domain/common";
import { byteCount } from "../../domain/factories";

export interface StorageManagerPort {
  estimate(): Promise<{ readonly usage?: number; readonly quota?: number }>;
}

export type ApproximateStorageEstimate =
  | {
      readonly status: "available";
      readonly approximate: true;
      readonly usageBytes: ByteCount;
      readonly quotaBytes?: ByteCount;
      readonly softWarningBytes: ByteCount;
      readonly approachingSoftLimit: boolean;
    }
  | {
      readonly status: "unavailable";
      readonly approximate: true;
      readonly reason: "unsupported" | "failed" | "invalid-result";
    };

export const DEFAULT_SOFT_RECORDING_BYTES = byteCount(250 * 1024 * 1024);

export async function estimateStorage(
  storageManager: StorageManagerPort | undefined,
  configuredSoftLimit = DEFAULT_SOFT_RECORDING_BYTES,
): Promise<ApproximateStorageEstimate> {
  if (!storageManager) {
    return {
      status: "unavailable",
      approximate: true,
      reason: "unsupported",
    };
  }

  try {
    const estimate = await storageManager.estimate();
    if (
      estimate.usage === undefined ||
      !Number.isSafeInteger(estimate.usage) ||
      estimate.usage < 0 ||
      (estimate.quota !== undefined &&
        (!Number.isSafeInteger(estimate.quota) || estimate.quota < 0))
    ) {
      return {
        status: "unavailable",
        approximate: true,
        reason: "invalid-result",
      };
    }

    const usageBytes = byteCount(estimate.usage);
    const quotaBytes =
      estimate.quota === undefined ? undefined : byteCount(estimate.quota);
    const quotaThreshold =
      quotaBytes === undefined
        ? configuredSoftLimit
        : byteCount(Math.floor(quotaBytes * 0.7));
    const softWarningBytes = byteCount(
      Math.min(configuredSoftLimit, quotaThreshold),
    );

    return {
      status: "available",
      approximate: true,
      usageBytes,
      ...(quotaBytes === undefined ? {} : { quotaBytes }),
      softWarningBytes,
      approachingSoftLimit: usageBytes >= softWarningBytes,
    };
  } catch {
    return {
      status: "unavailable",
      approximate: true,
      reason: "failed",
    };
  }
}
