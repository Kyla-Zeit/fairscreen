import { describe, expect, it, vi } from "vitest";

import { RESUME_IMPORT_MAX_FILE_BYTES } from "../../features/setup/resumeImport";
import { createBrowserResumeFileImportService } from "./resumeFileImport";

describe("resumeFileImport", () => {
  it("extracts TXT text with Unicode through File.text", async () => {
    const service = createBrowserResumeFileImportService();
    const result = await service(
      new File(["Résumé\nSkills:\tSQL • TypeScript"], "resume.txt", {
        type: "text/plain",
      }),
    );

    expect(result).toEqual({
      ok: true,
      format: "txt",
      text: "Résumé\nSkills:\tSQL • TypeScript",
    });
  });

  it("extracts representative DOCX plain text", async () => {
    const service = createBrowserResumeFileImportService();
    const result = await service(
      new File(
        [toArrayBuffer(createDocx(["Résumé import", "Accessibility testing"]))],
        "resume.docx",
        {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      ),
    );

    expect(result).toMatchObject({
      ok: true,
      format: "docx",
    });
    if (result.ok) {
      expect(result.text).toContain("Résumé import");
      expect(result.text).toContain("Accessibility testing");
    }
  });

  it("extracts representative PDF text and marks image-only PDFs unavailable", async () => {
    const service = createBrowserResumeFileImportService();

    await expect(
      service(
        new File(
          [toArrayBuffer(createPdf("Product analyst PDF resume"))],
          "resume.pdf",
          {
            type: "application/pdf",
          },
        ),
      ),
    ).resolves.toMatchObject({
      ok: true,
      format: "pdf",
      text: expect.stringContaining("Product analyst PDF resume") as string,
    });

    await expect(
      service(
        new File([toArrayBuffer(createPdf(null))], "resume.pdf", {
          type: "application/pdf",
        }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "image-only-pdf" },
    });
  });

  it("reports empty, unsupported, legacy, oversized, corrupt, and password cases safely", async () => {
    const service = createBrowserResumeFileImportService();

    await expect(
      service(new File(["   "], "resume.txt", { type: "text/plain" })),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "empty-document" },
    });
    await expect(
      service(new File(["hello"], "resume.rtf", { type: "application/rtf" })),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "unsupported-format" },
    });
    await expect(
      service(
        new File(["hello"], "resume.doc", { type: "application/msword" }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "legacy-doc" },
    });
    await expect(
      service(
        new File(
          [new Uint8Array(RESUME_IMPORT_MAX_FILE_BYTES + 1)],
          "resume.pdf",
          {
            type: "application/pdf",
          },
        ),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "oversized-file" },
    });
    await expect(
      service(
        new File(["not a docx"], "resume.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "parsing-error" },
    });

    const passwordError = new Error("Password required");
    passwordError.name = "PasswordException";
    const passwordService = createBrowserResumeFileImportService({
      extractDocxText: () => Promise.resolve("unused"),
      extractPdfText: () => Promise.reject(passwordError),
      readArrayBuffer: (file) => file.arrayBuffer(),
      readText: (file) => file.text(),
    });
    await expect(
      passwordService(
        new File(["%PDF"], "resume.pdf", { type: "application/pdf" }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      failure: { code: "password-protected-pdf" },
    });
  });

  it("does not return original file names, blobs, or buffers in diagnostics", async () => {
    const service = createBrowserResumeFileImportService();
    const result = await service(
      new File(["private text"], "sensitive-name.txt", { type: "text/plain" }),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("sensitive-name");
    expect(serialized).not.toContain("ArrayBuffer");
    expect(serialized).not.toContain("Blob");
    expect(serialized).not.toContain("File");
  });

  it("does not log document content during import", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const service = createBrowserResumeFileImportService();

    await service(
      new File(["secret resume text"], "resume.txt", { type: "text/plain" }),
    );

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });
});

function createDocx(paragraphs: readonly string[]): Uint8Array {
  const schemaBase = "http" + "://schemas.openxmlformats.org";
  return createStoredZip([
    {
      name: "[Content_Types].xml",
      text:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Types xmlns="${schemaBase}/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      text:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Relationships xmlns="${schemaBase}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${schemaBase}/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
        "</Relationships>",
    },
    {
      name: "word/document.xml",
      text:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<w:document xmlns:w="${schemaBase}/wordprocessingml/2006/main">` +
        "<w:body>" +
        paragraphs
          .map(
            (paragraph) =>
              `<w:p><w:r><w:t>${escapeXml(paragraph)}</w:t></w:r></w:p>`,
          )
          .join("") +
        "</w:body></w:document>",
    },
  ]);
}

function createPdf(text: string | null): Uint8Array {
  const stream =
    text === null
      ? ""
      : `BT /F1 24 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

interface ZipSource {
  readonly name: string;
  readonly text: string;
}

function createStoredZip(files: readonly ZipSource[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const local = createLocalFileHeader(name, data, crc);
    localParts.push(local, data);
    centralParts.push(createCentralDirectoryHeader(name, data, crc, offset));
    offset += local.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce(
    (size, part) => size + part.length,
    0,
  );
  const end = createEndOfCentralDirectory(
    files.length,
    centralSize,
    centralOffset,
  );
  return concatenate([...localParts, ...centralParts, end]);
}

function createLocalFileHeader(
  name: Uint8Array,
  data: Uint8Array,
  crc: number,
): Uint8Array {
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, name.length, true);
  header.set(name, 30);
  return header;
}

function createCentralDirectoryHeader(
  name: Uint8Array,
  data: Uint8Array,
  crc: number,
  localOffset: number,
): Uint8Array {
  const header = new Uint8Array(46 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, data.length, true);
  view.setUint32(24, data.length, true);
  view.setUint16(28, name.length, true);
  view.setUint32(42, localOffset, true);
  header.set(name, 46);
  return header;
}

function createEndOfCentralDirectory(
  fileCount: number,
  centralSize: number,
  centralOffset: number,
): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return header;
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((size, part) => size + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapePdfText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}
