const prohibitedExactKeys = new Set([
  "frame",
  "frames",
  "frameData",
  "imageData",
  "interimText",
  "finalText",
  "segments",
  "transientRecognitionState",
]);

const prohibitedKeyPattern =
  /landmark|blendshape|embedding|pixel|pcm|transformation.?matrix|face.?matrix/i;

export class RepositoryGuardError extends Error {
  readonly code:
    | "prohibited-key"
    | "binary-value"
    | "unreviewed-transcript"
    | "analysis-video-coupling"
    | "unsupported-value";

  constructor(code: RepositoryGuardError["code"]) {
    super(`Persistence payload rejected: ${code}.`);
    this.name = "RepositoryGuardError";
    this.code = code;
  }
}

export function assertPersistenceSafe(input: unknown): void {
  inspect(input, new WeakSet<object>(), []);
}

function inspect(
  value: unknown,
  visited: WeakSet<object>,
  path: readonly string[],
): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new RepositoryGuardError("unsupported-value");
    }
    return;
  }

  if (typeof value !== "object") {
    throw new RepositoryGuardError("unsupported-value");
  }

  if (
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof Blob !== "undefined" && value instanceof Blob)
  ) {
    throw new RepositoryGuardError("binary-value");
  }

  if (visited.has(value)) {
    throw new RepositoryGuardError("unsupported-value");
  }
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      inspect(item, visited, path);
    }
    visited.delete(value);
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (prohibitedExactKeys.has(key) || prohibitedKeyPattern.test(key)) {
      throw new RepositoryGuardError("prohibited-key");
    }
    if (key === "reviewedByUser" && nestedValue !== true) {
      throw new RepositoryGuardError("unreviewed-transcript");
    }
    if (path.at(-1) === "analysis" && /video/i.test(key)) {
      throw new RepositoryGuardError("analysis-video-coupling");
    }
    inspect(nestedValue, visited, [...path, key]);
  }
  visited.delete(value);
}

export function cloneRecord<Value>(value: Value): Value {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
  }
  return value;
}
