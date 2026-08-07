import type {
  Brand,
  ByteCount,
  DecibelsFullScale,
  Degrees,
  FairnessComparisonId,
  FairnessGroupId,
  FairnessTrialId,
  Hertz,
  InterviewQuestionId,
  InterviewSessionId,
  IsoDate,
  IsoDateTime,
  Milliseconds,
  NormalizedRatio,
  Percentage,
  QuestionResponseId,
  QuestionTemplateId,
  RecordingId,
  Sha256Digest,
  TranscriptRevisionId,
  UserSettingsId,
  WordsPerMinute,
} from "./common";

const idPattern = /^(?:demo:)?[a-z0-9][a-z0-9:_-]{2,127}$/i;
const sha256Pattern = /^[a-f0-9]{64}$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function boundedNumber<Name extends string>(
  value: number,
  name: Name,
  minimum: number,
  maximum: number,
): Brand<number, Name> {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} is outside its supported range.`);
  }

  return value as Brand<number, Name>;
}

function nonNegativeInteger<Name extends string>(
  value: number,
  name: Name,
): Brand<number, Name> {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }

  return value as Brand<number, Name>;
}

function identifier<Name extends string>(
  value: string,
  name: Name,
): Brand<string, Name> {
  const normalized = value.trim();
  if (!idPattern.test(normalized)) {
    throw new TypeError(`${name} is invalid.`);
  }

  return normalized as Brand<string, Name>;
}

export function isoDateTime(value: string): IsoDateTime {
  const timestamp = Date.parse(value);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== value
  ) {
    throw new TypeError("IsoDateTime must be a canonical UTC timestamp.");
  }

  return value as IsoDateTime;
}

export function isoDate(value: string): IsoDate {
  if (!isoDatePattern.test(value)) {
    throw new TypeError("IsoDate must use YYYY-MM-DD.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError("IsoDate is not a valid calendar date.");
  }

  return value as IsoDate;
}

export function sha256Digest(value: string): Sha256Digest {
  if (!sha256Pattern.test(value)) {
    throw new TypeError("Sha256Digest must contain 64 hexadecimal characters.");
  }

  return value.toLowerCase() as Sha256Digest;
}

export function interviewSessionId(value: string): InterviewSessionId {
  return identifier(value, "InterviewSessionId");
}

export function interviewQuestionId(value: string): InterviewQuestionId {
  return identifier(value, "InterviewQuestionId");
}

export function questionTemplateId(value: string): QuestionTemplateId {
  return identifier(value, "QuestionTemplateId");
}

export function questionResponseId(value: string): QuestionResponseId {
  return identifier(value, "QuestionResponseId");
}

export function transcriptRevisionId(value: string): TranscriptRevisionId {
  return identifier(value, "TranscriptRevisionId");
}

export function recordingId(value: string): RecordingId {
  return identifier(value, "RecordingId");
}

export function fairnessTrialId(value: string): FairnessTrialId {
  return identifier(value, "FairnessTrialId");
}

export function fairnessComparisonId(value: string): FairnessComparisonId {
  return identifier(value, "FairnessComparisonId");
}

export function fairnessGroupId(value: string): FairnessGroupId {
  return identifier(value, "FairnessGroupId");
}

export function userSettingsId(value: string): UserSettingsId {
  return identifier(value, "UserSettingsId");
}

export function milliseconds(value: number): Milliseconds {
  return nonNegativeInteger(value, "Milliseconds");
}

export function hertz(value: number): Hertz {
  return boundedNumber(value, "Hertz", 0, 384_000);
}

export function decibelsFullScale(value: number): DecibelsFullScale {
  return boundedNumber(value, "DecibelsFullScale", -200, 0);
}

export function wordsPerMinute(value: number): WordsPerMinute {
  return boundedNumber(value, "WordsPerMinute", 0, 1_000);
}

export function percentage(value: number): Percentage {
  return boundedNumber(value, "Percentage", 0, 100);
}

export function normalizedRatio(value: number): NormalizedRatio {
  return boundedNumber(value, "NormalizedRatio", 0, 1);
}

export function degrees(value: number): Degrees {
  return boundedNumber(value, "Degrees", -360, 360);
}

export function byteCount(value: number): ByteCount {
  return nonNegativeInteger(value, "ByteCount");
}

export function validatedLocale(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 35) {
    throw new TypeError("Locale is invalid.");
  }

  try {
    const [canonical] = Intl.getCanonicalLocales(normalized);
    if (!canonical) {
      throw new TypeError("Locale is invalid.");
    }
    return canonical;
  } catch {
    throw new TypeError("Locale is invalid.");
  }
}

export function boundedText(
  value: string,
  fieldName: string,
  maximumCodePoints: number,
): string {
  const normalized = value.trim();
  if (Array.from(normalized).length > maximumCodePoints) {
    throw new RangeError(`${fieldName} is too long.`);
  }
  return normalized;
}
