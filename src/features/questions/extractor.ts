import type { ExtractedKeyword, InterviewContext } from "../../domain/models";
import { KEYWORD_EXTRACTOR_VERSION } from "./catalogue";
import { normalizeKeyword } from "./normalization";

export { KEYWORD_EXTRACTOR_VERSION };

const maxKeywords = 12;
const stopWords = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "for",
  "from",
  "have",
  "into",
  "job",
  "our",
  "resume",
  "role",
  "that",
  "the",
  "their",
  "this",
  "with",
  "work",
  "you",
  "your",
]);

const highSignalTerms = new Set([
  "accessibility",
  "accounting",
  "analysis",
  "analyst",
  "api",
  "audit",
  "billing",
  "case",
  "ci/cd",
  "client",
  "cloud",
  "compliance",
  "customer",
  "data",
  "debugging",
  "documentation",
  "frontend",
  "investigation",
  "javascript",
  "leadership",
  "node.js",
  "operations",
  "privacy",
  "project",
  "python",
  "react",
  "research",
  "security",
  "service",
  "sql",
  "support",
  "testing",
  "typescript",
]);

const sensitiveOrIdentifierPattern =
  /(?:@|https?:|www\.|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{6,})/i;

export function extractRoleTerms(
  context: InterviewContext,
): readonly ExtractedKeyword[] {
  const scores = new Map<string, ExtractedKeyword>();

  collectTerms(scores, context.jobTitle, "job-title", 4);
  collectTerms(scores, context.jobDescription ?? "", "job-description", 1);
  collectResumeTerms(scores, context.resumeText ?? "");

  const extracted = Array.from(scores.values()).sort((left, right) => {
    if (right.weight !== left.weight) {
      return right.weight - left.weight;
    }

    return left.display.localeCompare(right.display, "en-CA");
  });

  return extracted.length > 0
    ? extracted.slice(0, maxKeywords)
    : [
        {
          normalized: "role",
          display: "role",
          source: "job-title",
          weight: 1,
          kind: "role",
        },
      ];
}

function collectResumeTerms(
  scores: Map<string, ExtractedKeyword>,
  resumeText: string,
) {
  const skillSection = resumeText
    .split(/\r?\n/)
    .filter((line) => /skill|tool|technology/i.test(line))
    .join(" ");

  collectTerms(scores, skillSection || resumeText, "resume", 1);
}

function collectTerms(
  scores: Map<string, ExtractedKeyword>,
  text: string,
  source: ExtractedKeyword["source"],
  baseWeight: number,
) {
  for (const token of tokenize(text)) {
    const normalized = normalizeKeyword(token);

    if (!isAllowedKeyword(normalized)) {
      continue;
    }

    const existing = scores.get(normalized);
    const weight = baseWeight + (highSignalTerms.has(normalized) ? 2 : 0);

    if (!existing || weight > existing.weight) {
      scores.set(normalized, {
        normalized,
        display: normalized,
        source,
        weight,
        kind: inferKeywordKind(normalized),
      });
    }
  }
}

function tokenize(text: string): readonly string[] {
  return text
    .normalize("NFKC")
    .replace(/C#/g, " c# ")
    .replace(/\.NET/gi, " .net ")
    .replace(/Node\.js/gi, " node.js ")
    .replace(/CI\/CD/gi, " ci/cd ")
    .split(/[^a-zA-Z0-9+#./-]+/)
    .filter(Boolean);
}

function isAllowedKeyword(normalized: string) {
  return (
    normalized.length >= 2 &&
    normalized.length <= 40 &&
    !stopWords.has(normalized) &&
    !sensitiveOrIdentifierPattern.test(normalized)
  );
}

function inferKeywordKind(normalized: string): ExtractedKeyword["kind"] {
  if (
    [
      "api",
      "cloud",
      "data",
      "javascript",
      "node.js",
      "python",
      "react",
      "sql",
      "typescript",
    ].includes(normalized)
  ) {
    return "technology";
  }

  if (
    ["accessibility", "privacy", "security", "testing", "debugging"].includes(
      normalized,
    )
  ) {
    return "skill";
  }

  if (
    ["customer", "service", "support", "investigation"].includes(normalized)
  ) {
    return "domain";
  }

  if (["leadership", "operations", "project"].includes(normalized)) {
    return "responsibility";
  }

  return "role";
}
