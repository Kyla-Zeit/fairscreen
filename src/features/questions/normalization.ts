export function normalizeQuestionText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[.?!]+(?=\s|$)/g, "")
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKeyword(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9+#./-]/g, "")
    .trim();
}

export function hasNormalizedDuplicate(values: readonly string[]): boolean {
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeQuestionText(value);
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      return true;
    }
    seen.add(normalized);
  }

  return false;
}
