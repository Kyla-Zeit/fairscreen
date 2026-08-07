import {
  classifyResumeFile,
  finalizeExtractedResumeText,
  resumeImportFailureMessage,
  type ResumeImportFailure,
  type ResumeImportFormat,
  type ResumeImportResult,
} from "../../features/setup/resumeImport";

type PdfJsModule = typeof import("pdfjs-dist");
type PdfDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;
interface MammothRawTextApi {
  readonly extractRawText: (input: {
    readonly arrayBuffer: ArrayBuffer;
  }) => Promise<{ readonly value: string }>;
}
type MammothModule = MammothRawTextApi & {
  readonly default?: MammothRawTextApi;
};

export interface ResumeFileImportDependencies {
  readonly extractDocxText: (buffer: ArrayBuffer) => Promise<string>;
  readonly extractPdfText: (buffer: ArrayBuffer) => Promise<string>;
  readonly readArrayBuffer: (file: File) => Promise<ArrayBuffer>;
  readonly readText: (file: File) => Promise<string>;
}

export type ResumeFileImportService = (
  file: File,
) => Promise<ResumeImportResult>;

export function createBrowserResumeFileImportService(
  dependencies: ResumeFileImportDependencies = defaultDependencies,
): ResumeFileImportService {
  return async (file) => {
    const classification = classifyResumeFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!classification.ok) {
      return classification;
    }

    const format = classification.format;
    try {
      if (format === "txt") {
        return finalizeExtractedResumeText(
          await dependencies.readText(file),
          "txt",
        );
      }

      let buffer: ArrayBuffer | undefined =
        await dependencies.readArrayBuffer(file);
      try {
        const text =
          format === "pdf"
            ? await dependencies.extractPdfText(buffer)
            : await dependencies.extractDocxText(buffer);
        return finalizeExtractedResumeText(text, format);
      } finally {
        buffer = undefined;
      }
    } catch (error) {
      return {
        ok: false,
        failure: toFailure(format, error),
      };
    }
  };
}

const defaultDependencies: ResumeFileImportDependencies = {
  extractDocxText: extractDocxPlainText,
  extractPdfText: extractPdfPlainText,
  readArrayBuffer: (file) => file.arrayBuffer(),
  readText: (file) => file.text(),
};

async function extractDocxPlainText(buffer: ArrayBuffer): Promise<string> {
  const mammothModule =
    (await import("mammoth/mammoth.browser")) as MammothModule;
  const mammoth = mammothModule.default ?? mammothModule;
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function extractPdfPlainText(buffer: ArrayBuffer): Promise<string> {
  const [{ default: workerSrc }, pdfjsModule] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.worker.mjs?url"),
    import("pdfjs-dist/legacy/build/pdf.mjs"),
  ]);
  const pdfjs: PdfJsModule = pdfjsModule;
  configurePdfWorker(pdfjs, workerSrc);

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    stopAtErrors: true,
    useWorkerFetch: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  try {
    const document: PdfDocumentProxy = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent();
        pages.push(extractTextItems(textContent.items));
      } finally {
        page.cleanup();
      }
    }
    await document.cleanup();
    return pages.join("\n\n");
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

function configurePdfWorker(pdfjs: PdfJsModule, workerSrc: string) {
  if (typeof Worker === "undefined") {
    return;
  }

  if (pdfjs.GlobalWorkerOptions.workerSrc !== workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  }
}

function extractTextItems(items: readonly unknown[]): string {
  const lines: string[] = [];
  let line = "";

  for (const item of items) {
    if (!isTextItem(item)) {
      continue;
    }

    line = line.length === 0 ? item.str : `${line} ${item.str}`;
    if (item.hasEOL) {
      lines.push(line);
      line = "";
    }
  }

  if (line.length > 0) {
    lines.push(line);
  }

  return lines.join("\n");
}

function isTextItem(
  item: unknown,
): item is { readonly hasEOL?: boolean; readonly str: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof item.str === "string"
  );
}

function toFailure(
  format: ResumeImportFormat,
  error: unknown,
): ResumeImportFailure {
  const code =
    format === "pdf" && isPasswordError(error)
      ? "password-protected-pdf"
      : "parsing-error";
  return {
    code,
    message: resumeImportFailureMessage(code),
  };
}

function isPasswordError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "PasswordException" ||
    error.message.toLowerCase().includes("password")
  );
}
