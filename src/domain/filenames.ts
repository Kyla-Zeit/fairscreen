import type { IsoDate } from "./common";

const invalidFilenamePattern = /[<>:"/\\|?*]+/g;
const repeatedSeparatorPattern = /[-_.]{2,}/g;
const reservedWindowsNamePattern =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function sanitizeFilenamePart(value: string): string {
  const withoutControls = Array.from(value.normalize("NFKC"), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 ? "-" : character;
  }).join("");
  const normalized = withoutControls
    .replaceAll(invalidFilenamePattern, "-")
    .replaceAll(/\s+/g, "-")
    .replaceAll(repeatedSeparatorPattern, "-")
    .replaceAll(/^[.\s-]+|[.\s-]+$/g, "")
    .toLocaleLowerCase("en")
    .slice(0, 80);

  if (!normalized || reservedWindowsNamePattern.test(normalized)) {
    return "export";
  }
  return normalized;
}

export function createExportFilename(
  kind: "session" | "fairness-comparison",
  date: IsoDate,
  format: "txt" | "json",
  label?: string,
): string {
  const safeLabel = label ? `-${sanitizeFilenamePart(label)}` : "";
  return `fairscreen-${kind}${safeLabel}-${date}.${format}`;
}
