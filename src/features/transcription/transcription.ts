import type { IsoDateTime, Sha256Digest } from "../../domain/common";
import { sha256Digest, transcriptRevisionId } from "../../domain/factories";
import type {
  TranscriptResult,
  TranscriptRevision,
  TranscriptSource,
  TranscriptionProcessingMode,
} from "../../domain/models";

export interface TranscriptRevisionInput {
  readonly revisionKey: string;
  readonly createdAt: IsoDateTime;
  readonly text: string;
  readonly source: TranscriptSource;
  readonly reviewedByUser: boolean;
  readonly locale: string;
}

export function normalizeTranscriptText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatTranscriptParagraphs(text: string): string {
  const normalized = normalizeTranscriptText(text);
  if (!normalized) return "";

  const explicitParagraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter(Boolean);
  if (explicitParagraphs.length > 1) {
    return explicitParagraphs.join("\n\n");
  }

  const flat = explicitParagraphs[0] ?? normalized.replace(/\n+/g, " ");
  const sentences = splitTranscriptSentences(flat);
  if (sentences.length < 3) {
    return paragraphizeLongUnpunctuatedText(flat);
  }

  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentLength = 0;
  for (const sentence of sentences) {
    const startsNewThought =
      /^(?:first|second|third|then|next|after|finally|the result|as a result|to test|to monitor|in production|for example|in that situation)\b/i.test(
        sentence,
      );
    if (
      current.length > 0 &&
      (startsNewThought ||
        current.length >= 3 ||
        currentLength + sentence.length > 360)
    ) {
      paragraphs.push(current.join(" "));
      current = [];
      currentLength = 0;
    }
    current.push(sentence);
    currentLength += sentence.length + 1;
  }
  if (current.length > 0) paragraphs.push(current.join(" "));
  return paragraphs.join("\n\n");
}

export function countTranscriptWords(text: string): number {
  const normalized = normalizeTranscriptText(text);
  return normalized.length === 0 ? 0 : normalized.split(/\s+/).length;
}

function splitTranscriptSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function paragraphizeLongUnpunctuatedText(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 70) return text;

  const paragraphs: string[] = [];
  let start = 0;
  while (start < words.length) {
    const target = Math.min(start + 55, words.length);
    let end = target;
    for (let index = target; index > start + 35; index -= 1) {
      if (
        /^(?:first|then|next|after|finally|because|however|so|the|to)$/i.test(
          words[index] ?? "",
        )
      ) {
        end = index;
        break;
      }
    }
    paragraphs.push(words.slice(start, end).join(" "));
    start = end;
  }
  return paragraphs.join("\n\n");
}

export function createTranscriptRevision(
  input: TranscriptRevisionInput,
): TranscriptRevision {
  const text = formatTranscriptParagraphs(input.text);
  const safeKey = input.revisionKey
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  return {
    id: transcriptRevisionId(`transcript:${safeKey || "revision"}`),
    createdAt: input.createdAt,
    text,
    source: input.source,
    reviewedByUser: input.reviewedByUser,
    locale: input.locale,
    wordCount: countTranscriptWords(text),
    normalizedDigest: digestTranscript(text),
  };
}

export function createManualTranscriptResult(input: {
  readonly revisionKey: string;
  readonly createdAt: IsoDateTime;
  readonly text: string;
  readonly locale: string;
}): TranscriptResult {
  const revision = createTranscriptRevision({
    ...input,
    source: "manual",
    reviewedByUser: true,
  });

  return {
    status: "manual",
    providerId: "manual-transcript",
    processingMode: "device",
    activeRevision: revision,
    revisions: [revision],
    errors: [],
    limitations: [
      "This transcript was entered or confirmed by the user and was not generated from audio.",
    ],
  };
}

export function createTimingOnlyTranscriptResult(
  reason = "Transcription was not requested for this answer.",
): TranscriptResult {
  return {
    status: "timing-only",
    providerId: "no-transcription",
    processingMode: "unknown",
    revisions: [],
    errors: [],
    limitations: [reason],
  };
}

export function createUnavailableTranscriptResult(input: {
  readonly providerId: string;
  readonly processingMode: TranscriptionProcessingMode;
  readonly safeMessage: string;
  readonly recoverable?: boolean;
  readonly limitation?: string;
}): TranscriptResult {
  return {
    status: "unavailable",
    providerId: input.providerId,
    processingMode: input.processingMode,
    revisions: [],
    errors: [
      {
        code: "unsupported",
        recoverable: input.recoverable ?? true,
        safeMessage: input.safeMessage,
      },
    ],
    limitations: [
      input.limitation ??
        "Enter a transcript manually if you want answer-content coaching.",
    ],
  };
}

export function reviseTranscriptResult(input: {
  readonly result: TranscriptResult;
  readonly revisionKey: string;
  readonly createdAt: IsoDateTime;
  readonly text: string;
  readonly locale: string;
}): TranscriptResult {
  const prior = input.result.activeRevision;
  const source: TranscriptSource =
    prior?.source === "browser-speech" ||
    prior?.source === "edited-browser-speech"
      ? "edited-browser-speech"
      : "manual";
  const revision = createTranscriptRevision({
    revisionKey: input.revisionKey,
    createdAt: input.createdAt,
    text: input.text,
    source,
    reviewedByUser: true,
    locale: input.locale,
  });

  return {
    ...input.result,
    status: source === "manual" ? "manual" : "complete",
    activeRevision: revision,
    revisions: [...input.result.revisions, revision],
  };
}

export function transcriptNeedsReview(result: TranscriptResult): boolean {
  return Boolean(
    result.activeRevision && !result.activeRevision.reviewedByUser,
  );
}

export function digestTranscript(text: string): Sha256Digest {
  return sha256Digest(sha256(normalizeTranscriptText(text)));
}

// Compact synchronous SHA-256 implementation. Transcript text never leaves the
// browser; the digest is used only to bind analysis to an exact reviewed revision.
function sha256(message: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));
  const words: number[] = [];
  const ascii = unescape(encodeURIComponent(message));
  const bitLength = ascii.length * 8;
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let index = 0; index < ascii.length; index += 1) {
    words[index >> 2] =
      (words[index >> 2] ?? 0) |
      (ascii.charCodeAt(index) << (24 - (index % 4) * 8));
  }
  words[bitLength >> 5] =
    (words[bitLength >> 5] ?? 0) | (0x80 << (24 - (bitLength % 32)));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  for (let block = 0; block < words.length; block += 16) {
    const schedule = new Array<number>(64);
    for (let index = 0; index < 64; index += 1) {
      if (index < 16) {
        schedule[index] = words[block + index] ?? 0;
      } else {
        const prior15 = schedule[index - 15] ?? 0;
        const prior2 = schedule[index - 2] ?? 0;
        const sigma0 =
          rightRotate(prior15, 7) ^ rightRotate(prior15, 18) ^ (prior15 >>> 3);
        const sigma1 =
          rightRotate(prior2, 17) ^ rightRotate(prior2, 19) ^ (prior2 >>> 10);
        schedule[index] =
          ((schedule[index - 16] ?? 0) +
            sigma0 +
            (schedule[index - 7] ?? 0) +
            sigma1) |
          0;
      }
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 =
        rightRotate(e ?? 0, 6) ^
        rightRotate(e ?? 0, 11) ^
        rightRotate(e ?? 0, 25);
      const choice = ((e ?? 0) & (f ?? 0)) ^ (~(e ?? 0) & (g ?? 0));
      const temporary1 =
        ((h ?? 0) +
          sum1 +
          choice +
          (constants[index] ?? 0) +
          (schedule[index] ?? 0)) |
        0;
      const sum0 =
        rightRotate(a ?? 0, 2) ^
        rightRotate(a ?? 0, 13) ^
        rightRotate(a ?? 0, 22);
      const majority =
        ((a ?? 0) & (b ?? 0)) ^ ((a ?? 0) & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0));
      const temporary2 = (sum0 + majority) | 0;
      h = g;
      g = f;
      f = e;
      e = ((d ?? 0) + temporary1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) | 0;
    }

    hash[0] = ((hash[0] ?? 0) + (a ?? 0)) | 0;
    hash[1] = ((hash[1] ?? 0) + (b ?? 0)) | 0;
    hash[2] = ((hash[2] ?? 0) + (c ?? 0)) | 0;
    hash[3] = ((hash[3] ?? 0) + (d ?? 0)) | 0;
    hash[4] = ((hash[4] ?? 0) + (e ?? 0)) | 0;
    hash[5] = ((hash[5] ?? 0) + (f ?? 0)) | 0;
    hash[6] = ((hash[6] ?? 0) + (g ?? 0)) | 0;
    hash[7] = ((hash[7] ?? 0) + (h ?? 0)) | 0;
  }

  return hash
    .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
    .join("");
}
