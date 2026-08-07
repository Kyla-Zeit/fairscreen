import { describe, expect, it } from "vitest";

import { byteCount } from "../../domain/factories";
import { estimateStorage, type StorageManagerPort } from "./storageEstimate";

describe("approximate storage estimate", () => {
  it("uses the lower of the configured limit and 70 percent of quota", async () => {
    const storage: StorageManagerPort = {
      estimate: () =>
        Promise.resolve({
          usage: 80,
          quota: 100,
        }),
    };
    await expect(estimateStorage(storage, byteCount(250))).resolves.toEqual({
      status: "available",
      approximate: true,
      usageBytes: 80,
      quotaBytes: 100,
      softWarningBytes: 70,
      approachingSoftLimit: true,
    });
  });

  it("does not fail when the API is absent, throws, or returns invalid data", async () => {
    await expect(estimateStorage(undefined)).resolves.toEqual({
      status: "unavailable",
      approximate: true,
      reason: "unsupported",
    });
    await expect(
      estimateStorage({
        estimate: () => Promise.reject(new Error("fixture")),
      }),
    ).resolves.toEqual({
      status: "unavailable",
      approximate: true,
      reason: "failed",
    });
    await expect(
      estimateStorage({
        estimate: () => Promise.resolve({ usage: -1 }),
      }),
    ).resolves.toEqual({
      status: "unavailable",
      approximate: true,
      reason: "invalid-result",
    });
  });
});
