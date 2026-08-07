export const RESUME_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const RESUME_IMPORT_MAX_TEXT_CHARACTERS = 20_000;

export type ResumeImportFormat = "pdf" | "docx" | "txt";

export type ResumeImportFailureCode =
  | "empty-document"
  | "excessive-text"
  | "image-only-pdf"
  | "legacy-doc"
  | "oversized-file"
  | "parsing-error"
  | "password-protected-pdf"
  | "unsupported-format";

export interface ResumeFileDescriptor {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

export interface ResumeImportFailure {
  readonly code: ResumeImportFailureCode;
  readonly message: string;
}

export type ResumeImportClassification =
  | { readonly ok: true; readonly format: ResumeImportFormat }
  | { readonly ok: false; readonly failure: ResumeImportFailure };

export type ResumeImportResult =
  | {
      readonly ok: true;
      readonly format: ResumeImportFormat;
      readonly text: string;
    }
  | { readonly ok: false; readonly failure: ResumeImportFailure };

const docxMimeType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function classifyResumeFile(
  file: ResumeFileDescriptor,
): ResumeImportClassification {
  if (file.size > RESUME_IMPORT_MAX_FILE_BYTES) {
    return failure("oversized-file");
  }

  const extension = fileExtension(file.name);
  const mimeType = file.type.trim().toLowerCase();

  if (extension === ".doc" || mimeType === "application/msword") {
    return failure("legacy-doc");
  }

  if (
    extension === ".pdf" ||
    (extension === "" && mimeType === "application/pdf")
  ) {
    return { ok: true, format: "pdf" };
  }

  if (
    extension === ".docx" ||
    (extension === "" && mimeType === docxMimeType)
  ) {
    return { ok: true, format: "docx" };
  }

  if (extension === ".txt" || (extension === "" && mimeType === "text/plain")) {
    return { ok: true, format: "txt" };
  }

  return failure("unsupported-format");
}

export function finalizeExtractedResumeText(
  text: string,
  format: ResumeImportFormat,
): ResumeImportResult {
  const sanitized = sanitizeExtractedResumeText(text);

  if (sanitized.trim().length === 0) {
    return {
      ok: false,
      failure:
        format === "pdf"
          ? failure("image-only-pdf").failure
          : failure("empty-document").failure,
    };
  }

  if (sanitized.length > RESUME_IMPORT_MAX_TEXT_CHARACTERS) {
    return failure("excessive-text");
  }

  return {
    ok: true,
    format,
    text: sanitized,
  };
}

export function sanitizeExtractedResumeText(text: string): string {
  return stripUnsafeControlCharacters(text.replaceAll(/\r\n?/g, "\n"))
    .replaceAll(/[ \t]+\n/g, "\n")
    .trim();
}

export function resumeImportFailureMessage(
  code: ResumeImportFailureCode,
): string {
  switch (code) {
    case "empty-document":
      return "No readable text was found. Upload a valid text-based PDF, DOCX, or TXT file.";
    case "excessive-text":
      return "The extracted résumé is longer than 20,000 characters. Upload a shorter résumé.";
    case "image-only-pdf":
      return "No extractable text was found in the PDF. FairScreen does not run OCR; upload a text-based document.";
    case "legacy-doc":
      return "Legacy .doc files are not supported. Save the document as DOCX or PDF, then try again.";
    case "oversized-file":
      return "Upload a PDF, DOCX, or TXT file that is 5 MiB or smaller.";
    case "parsing-error":
      return "FairScreen could not read this file. Upload a valid text-based PDF, DOCX, or TXT file.";
    case "password-protected-pdf":
      return "Password-protected PDFs are not supported. Remove the password or upload another copy.";
    case "unsupported-format":
      return "Upload a supported résumé file: PDF, DOCX, or TXT.";
  }
}

function failure(code: ResumeImportFailureCode): {
  readonly ok: false;
  readonly failure: ResumeImportFailure;
} {
  return {
    ok: false,
    failure: {
      code,
      message: resumeImportFailureMessage(code),
    },
  };
}

function fileExtension(name: string): string {
  const normalized = name.trim().toLowerCase();
  const index = normalized.lastIndexOf(".");
  return index >= 0 ? normalized.slice(index) : "";
}

function stripUnsafeControlCharacters(text: string): string {
  let result = "";
  for (const character of text) {
    const code = character.charCodeAt(0);
    if (
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      (code >= 0x7f && code <= 0x9f)
    ) {
      continue;
    }
    result += character;
  }
  return result;
}
