import type { IsoDateTime } from "../../domain/common";

export interface ResumeMetadata {
  readonly originalFilename: string;
  readonly format: "pdf" | "docx" | "txt";
  readonly fileSizeBytes: number;
  readonly importedAt: IsoDateTime;
  readonly extractionStatus: "ready" | "failed";
}

export interface JobPostingImportSnapshot {
  readonly originalUrl: string;
  readonly normalizedUrl: string;
  readonly importedAt: IsoDateTime;
  readonly title?: string;
  readonly companyName?: string;
  readonly companyWebsiteUrl?: string;
  readonly location?: string;
  readonly description?: string;
}

export interface JobPostingImportRequest {
  readonly originalUrl: string;
  readonly normalizedUrl: string;
  readonly requestedAt: IsoDateTime;
}

export type JobPostingImportFailureCode =
  | "cors-blocked"
  | "authentication-required"
  | "anti-bot-blocked"
  | "expired"
  | "unsupported-markup"
  | "network-unavailable"
  | "provider-unavailable"
  | "invalid-url"
  | "timeout";

export type JobPostingImportResult =
  | { readonly ok: true; readonly value: JobPostingImportSnapshot }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: JobPostingImportFailureCode;
        readonly message: string;
        readonly retrievedAt: IsoDateTime;
      };
    };

export type JobPostingImportService = (
  request: JobPostingImportRequest,
) => Promise<JobPostingImportResult>;

export interface CompanyResearchCandidate {
  readonly id: string;
  readonly name: string;
  readonly websiteUrl?: string;
  readonly reason: string;
}

export interface CompanyResearchSource {
  readonly title: string;
  readonly url: string;
  readonly publisher: string;
  readonly retrievedAt: IsoDateTime;
  readonly supports: readonly string[];
}

export interface CompanyResearchFinding {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly kind:
    | "overview"
    | "products"
    | "values"
    | "careers"
    | "technology"
    | "development"
    | "interview-theme"
    | "inference";
  readonly evidence: "sourced-fact" | "inference" | "anecdotal";
  readonly included: boolean;
  readonly sourceIndexes: readonly number[];
}

export interface CompanyResearchSnapshot {
  readonly providerId: string;
  readonly retrievedAt: IsoDateTime;
  readonly verifiedCompanyName: string;
  readonly officialWebsiteUrl?: string;
  readonly overview: string;
  readonly findings: readonly CompanyResearchFinding[];
  readonly practiceQuestions: readonly string[];
  readonly sources: readonly CompanyResearchSource[];
  readonly limitations: readonly string[];
}

export interface CompanyResearchRequest {
  readonly companyName?: string;
  readonly companyWebsiteUrl?: string;
  readonly jobTitle?: string;
  readonly jobPostingUrl?: string;
  readonly requestedAt: IsoDateTime;
}

export type CompanyResearchFailureCode =
  | "consent-required"
  | "ambiguous-company"
  | "offline"
  | "timeout"
  | "malformed-response"
  | "stale-source"
  | "provider-unavailable"
  | "insufficient-context";

export type CompanyResearchResult =
  | { readonly ok: true; readonly value: CompanyResearchSnapshot }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: CompanyResearchFailureCode;
        readonly message: string;
        readonly candidates?: readonly CompanyResearchCandidate[];
      };
    };

export interface CompanyResearchProvider {
  readonly providerId: string;
  research(request: CompanyResearchRequest): Promise<CompanyResearchResult>;
}

export function createUnavailableJobPostingImportService(): JobPostingImportService {
  return (request) =>
    Promise.resolve({
      ok: false,
      error: {
        code: "provider-unavailable",
        message:
          "Job posting import needs a configured server-side retrieval provider. The URL was kept. Paste the job description instead if import is blocked or unavailable.",
        retrievedAt: request.requestedAt,
      },
    });
}

export function createUnavailableCompanyResearchProvider(): CompanyResearchProvider {
  return {
    providerId: "company-research-unavailable",
    research() {
      return Promise.resolve({
        ok: false,
        error: {
          code: "provider-unavailable",
          message:
            "Company research needs a configured server-side provider. You can continue locally without research.",
        },
      });
    },
  };
}

export function normalizeHttpUrl(
  value: string,
):
  | { readonly ok: true; readonly normalizedUrl: string }
  | { readonly ok: false; readonly message: string } {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "URL is optional." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      message:
        "Enter a valid URL starting with " +
        "http" +
        ":// or " +
        "https" +
        "://.",
    };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      ok: false,
      message: "Only HTTP and HTTPS URLs are supported.",
    };
  }

  parsed.hash = "";
  return { ok: true, normalizedUrl: parsed.toString() };
}

export function safeDisplayFilename(filename: string): string {
  const baseName = filename
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .at(-1);
  const normalized = (baseName ?? "resume").normalize("NFKC").trim();
  return normalized.length > 0 ? normalized.slice(0, 180) : "resume";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${Math.round(kib).toLocaleString("en-CA")} KB`;
  }

  return `${(kib / 1024).toFixed(1)} MB`;
}

export function researchPracticeQuestions(
  snapshot: CompanyResearchSnapshot | null,
): readonly string[] {
  if (!snapshot) {
    return [];
  }

  const includedFindings = snapshot.findings.filter(
    (finding) => finding.included,
  );
  const value = includedFindings.find((finding) => finding.kind === "values");
  const product = includedFindings.find(
    (finding) => finding.kind === "products",
  );
  const technology = includedFindings.find(
    (finding) => finding.kind === "technology",
  );
  const questions = [
    `Why are you interested in ${snapshot.verifiedCompanyName} and its work?`,
    value ? `Tell me about a time you demonstrated ${value.label}.` : undefined,
    product
      ? `How would your experience help users of ${product.label}?`
      : undefined,
    technology
      ? `What trade-offs would you consider when supporting ${technology.label}?`
      : undefined,
    ...snapshot.practiceQuestions.map((question) =>
      question.replace(/\bwill\s+ask\b/gi, "could explore"),
    ),
  ].filter((question): question is string => Boolean(question));

  return Array.from(new Set(questions)).slice(0, 5);
}
