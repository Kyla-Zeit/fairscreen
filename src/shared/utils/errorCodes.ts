const MAX_DIAGNOSTIC_CODE_LENGTH = 64;

export function formatDiagnosticCode(code: string) {
  const formatted = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_DIAGNOSTIC_CODE_LENGTH);

  return formatted.length > 0 ? formatted : "FS_UNKNOWN_ERROR";
}
