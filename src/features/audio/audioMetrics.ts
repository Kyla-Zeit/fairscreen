import type {
  AvailabilityReason,
  DecibelsFullScale,
  MetricValue,
  Milliseconds,
  WordsPerMinute,
} from "../../domain/common";
import {
  decibelsFullScale,
  hertz,
  milliseconds,
  wordsPerMinute,
} from "../../domain/factories";
import type {
  AudioCalibration,
  AudioMetricWarning,
  AudioMetrics,
  SpeechSegment,
} from "../../domain/models";

export const AUDIO_METRIC_ALGORITHM_VERSION = "m07-audio-metrics-v1";
export const AUDIO_SAMPLE_RATE_HZ = 20;
export const AUDIO_SAMPLE_INTERVAL_MS = 50;

const RMS_DBFS_FLOOR = 1e-7;
const DISPLAY_DBFS_MINIMUM = -100;
const DISPLAY_DBFS_MAXIMUM = 0;
const MINIMUM_AUDIO_WINDOWS = 100;
const CALIBRATION_WINDOW_MS = 1_000;
const ATTACK_WINDOWS = 3;
const RELEASE_WINDOWS = 5;
const MERGE_GAP_MS = 300;
const MINIMUM_SEGMENT_MS = 250;
const MINIMUM_WPM_WORDS = 10;
const MINIMUM_WPM_SPEECH_MS = 5_000;
const CLIPPING_DBFS = -3;
const CONTINUOUS_CLIPPING_DBFS = -1;
const CONTINUOUS_CLIPPING_RATIO = 0.8;

const audioLimitations = [
  "Audio timing describes captured signal above an adaptive threshold, not intent or communication quality.",
  "Microphone hardware, room conditions, browser processing, assistive devices, and speech differences can change these values.",
] as const;

export interface AudioWindowObservation {
  readonly offsetMs: number;
  readonly rms: number;
  readonly trackLive: boolean;
}

export interface AudioMetricsInput {
  readonly startedAtMs: number;
  readonly finishedAtMs: number;
  readonly captureRequested: boolean;
  readonly windows: readonly AudioWindowObservation[];
  readonly interruptionReason?: AvailabilityReason;
  readonly failureReason?: AvailabilityReason;
  readonly transcriptWordCount?: number;
}

export interface AudioWindowResult {
  readonly ok: boolean;
  readonly observation?: AudioWindowObservation;
}

export function calculateRms(samples: ArrayLike<number>): number | undefined {
  if (samples.length === 0) {
    return undefined;
  }

  let sumSquares = 0;
  for (const sample of Array.from(samples)) {
    if (!Number.isFinite(sample)) {
      return undefined;
    }
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / samples.length);
}

export function rmsToDbfs(rms: number): DecibelsFullScale {
  if (!Number.isFinite(rms) || rms < 0) {
    return decibelsFullScale(DISPLAY_DBFS_MINIMUM);
  }

  return decibelsFullScale(
    clamp(
      20 * Math.log10(Math.max(rms, RMS_DBFS_FLOOR)),
      DISPLAY_DBFS_MINIMUM,
      DISPLAY_DBFS_MAXIMUM,
    ),
  );
}

export function createAudioWindowObservation(
  samples: ArrayLike<number>,
  offsetMs: number,
  trackLive: boolean,
): AudioWindowResult {
  const rms = calculateRms(samples);
  if (rms === undefined || !Number.isFinite(offsetMs) || offsetMs < 0) {
    return { ok: false };
  }

  return {
    ok: true,
    observation: {
      offsetMs: Math.round(offsetMs),
      rms,
      trackLive,
    },
  };
}

export function calibrateAudio(
  observations: readonly AudioWindowObservation[],
): AudioCalibration {
  const validObservations = observations.filter(isValidObservation);
  const dbfsValues = validObservations.map((observation) =>
    Number(rmsToDbfs(observation.rms)),
  );
  const noiseFloorDbfs = median(dbfsValues) ?? DISPLAY_DBFS_MINIMUM;
  const speechThresholdDbfs = clamp(noiseFloorDbfs + 10, -50, -25);
  const aboveThresholdRatio =
    dbfsValues.length === 0
      ? 0
      : dbfsValues.filter((value) => value > speechThresholdDbfs).length /
        dbfsValues.length;
  const clippingRatio =
    dbfsValues.length === 0
      ? 0
      : dbfsValues.filter((value) => value >= CONTINUOUS_CLIPPING_DBFS).length /
        dbfsValues.length;
  const allZero =
    validObservations.length === 0 ||
    validObservations.every((observation) => observation.rms === 0);

  const calibrationQuality =
    allZero || clippingRatio >= CONTINUOUS_CLIPPING_RATIO
      ? "invalid"
      : noiseFloorDbfs > -35 || aboveThresholdRatio > 0.4
        ? "noisy"
        : "adequate";

  return {
    sampleCount: validObservations.length,
    noiseFloorDbfs: decibelsFullScale(roundTo(noiseFloorDbfs, 3)),
    speechThresholdDbfs: decibelsFullScale(roundTo(speechThresholdDbfs, 3)),
    attackMs: milliseconds(ATTACK_WINDOWS * AUDIO_SAMPLE_INTERVAL_MS),
    releaseMs: milliseconds(RELEASE_WINDOWS * AUDIO_SAMPLE_INTERVAL_MS),
    calibrationQuality,
  };
}

export function detectSpeechSegments(
  observations: readonly AudioWindowObservation[],
  calibration: AudioCalibration,
): readonly SpeechSegment[] {
  if (calibration.calibrationQuality === "invalid") {
    return [];
  }

  const validObservations = observations.filter(isValidObservation);
  const rawSegments: { start: number; end: number }[] = [];
  let activeStart: number | undefined;
  let aboveRun = 0;
  let belowRun = 0;

  for (const observation of validObservations) {
    const above =
      Number(rmsToDbfs(observation.rms)) > calibration.speechThresholdDbfs;

    if (above) {
      aboveRun += 1;
      belowRun = 0;
      if (activeStart === undefined && aboveRun >= ATTACK_WINDOWS) {
        activeStart =
          observation.offsetMs -
          (ATTACK_WINDOWS - 1) * AUDIO_SAMPLE_INTERVAL_MS;
      }
      continue;
    }

    aboveRun = 0;
    if (activeStart !== undefined) {
      belowRun += 1;
      if (belowRun >= RELEASE_WINDOWS) {
        rawSegments.push({
          start: activeStart,
          end:
            observation.offsetMs -
            (RELEASE_WINDOWS - 1) * AUDIO_SAMPLE_INTERVAL_MS,
        });
        activeStart = undefined;
        belowRun = 0;
      }
    }
  }

  if (activeStart !== undefined) {
    const last = validObservations.at(-1);
    if (last) {
      rawSegments.push({
        start: activeStart,
        end: last.offsetMs + AUDIO_SAMPLE_INTERVAL_MS,
      });
    }
  }

  return mergeAndFilterSegments(rawSegments).map((segment) => ({
    startOffsetMs: milliseconds(Math.max(0, Math.round(segment.start))),
    endOffsetMs: milliseconds(Math.max(0, Math.round(segment.end))),
  }));
}

export function buildAudioMetrics(input: AudioMetricsInput): AudioMetrics {
  const answerDuration = answerDurationMetric(input);
  const validObservations = input.windows.filter(isValidObservation);
  const invalidSampleCount = input.windows.length - validObservations.length;
  const sampleCount = validObservations.length;
  const baseReason = input.failureReason ?? "not-requested";

  if (!input.captureRequested || input.failureReason) {
    return unavailableAudioMetrics({
      answerDuration,
      reason: input.captureRequested ? baseReason : "not-requested",
      sampleCount,
      invalidSampleCount,
      warnings: input.captureRequested ? [] : ["transcript-missing"],
    });
  }

  const allZeroValidated =
    sampleCount >= 40 &&
    validObservations
      .slice(0, 40)
      .every((observation) => observation.rms === 0);
  if (sampleCount === 0 || allZeroValidated) {
    return unavailableAudioMetrics({
      answerDuration,
      reason: sampleCount === 0 ? "insufficient-samples" : "invalid-signal",
      sampleCount,
      invalidSampleCount,
      warnings: allZeroValidated ? ["all-zero-signal"] : [],
    });
  }

  const calibration = calibrateAudio(
    validObservations.filter(
      (observation) => observation.offsetMs < CALIBRATION_WINDOW_MS,
    ),
  );
  const calibrationValid = calibration.calibrationQuality !== "invalid";
  const sampleQualityReason =
    input.interruptionReason ??
    (sampleCount < MINIMUM_AUDIO_WINDOWS ? "insufficient-samples" : undefined);
  const speechSegments = calibrationValid
    ? detectSpeechSegments(validObservations, calibration)
    : [];
  const speakingMs = sumSegmentDuration(speechSegments);
  const delayMs = speechSegments[0]?.startOffsetMs;
  const longestInternalSilenceMs = longestInternalSilence(speechSegments);
  const warningSet = new Set<AudioMetricWarning>();

  if (calibration.calibrationQuality === "noisy") {
    warningSet.add("high-noise-floor");
  }
  if (calibration.calibrationQuality === "invalid") {
    warningSet.add("all-zero-signal");
  }
  if (sampleQualityReason === "device-lost") {
    warningSet.add("device-lost");
  }
  if (sampleQualityReason === "interrupted") {
    warningSet.add("tab-or-device-suspended");
  }
  if (sampleCount < MINIMUM_AUDIO_WINDOWS) {
    warningSet.add("partial-samples");
  }

  const averageDbfs = averageMicrophoneLevel(validObservations);
  const peakDbfs = percentileDbfs(validObservations, 0.95);
  if (peakDbfs !== undefined && peakDbfs > CLIPPING_DBFS) {
    warningSet.add("possible-clipping");
  }
  if (input.transcriptWordCount === undefined) {
    warningSet.add("transcript-missing");
  }
  if (speakingMs < MINIMUM_WPM_SPEECH_MS) {
    warningSet.add("insufficient-speech");
  }

  const metricStatus =
    sampleQualityReason !== undefined ||
    calibration.calibrationQuality === "noisy"
      ? "partial"
      : "available";
  const signalReason = sampleQualityReason ?? "unknown";
  const signalLimitations = limitationsForSignal(
    calibration,
    sampleQualityReason,
  );
  const levelMetric =
    sampleCount >= MINIMUM_AUDIO_WINDOWS && averageDbfs !== undefined
      ? metricValue(
          metricStatus,
          decibelsFullScale(roundTo(averageDbfs, 3)),
          signalLimitations,
          signalReason,
        )
      : partialOrUnavailable(
          averageDbfs,
          decibelsFullScale,
          "insufficient-samples",
          signalLimitations,
        );
  const peakMetric =
    sampleCount >= MINIMUM_AUDIO_WINDOWS && peakDbfs !== undefined
      ? metricValue(
          metricStatus,
          decibelsFullScale(roundTo(peakDbfs, 3)),
          signalLimitations,
          signalReason,
        )
      : partialOrUnavailable(
          peakDbfs,
          decibelsFullScale,
          "insufficient-samples",
          signalLimitations,
        );
  const speechMetricAvailable =
    calibrationValid && sampleCount >= MINIMUM_AUDIO_WINDOWS;
  const speechMetricStatus =
    speechMetricAvailable && sampleQualityReason === undefined
      ? "available"
      : "partial";
  const speechReason = sampleQualityReason ?? "insufficient-samples";

  const speakingMetric: MetricValue<Milliseconds> =
    speechMetricAvailable || speakingMs > 0
      ? metricValue(
          speechMetricStatus,
          milliseconds(speakingMs),
          signalLimitations,
          speechReason,
        )
      : unavailable("insufficient-samples", signalLimitations);
  const silenceMetric: MetricValue<Milliseconds> =
    speechMetricAvailable || speakingMs > 0
      ? metricValue(
          speechMetricStatus,
          milliseconds(Math.max(0, metricNumber(answerDuration) - speakingMs)),
          signalLimitations,
          speechReason,
        )
      : unavailable("insufficient-samples", signalLimitations);
  const delayMetric: MetricValue<Milliseconds> =
    delayMs !== undefined && calibrationValid
      ? metricValue(
          speechMetricStatus,
          milliseconds(delayMs),
          [
            ...signalLimitations,
            "Calibration used the first second of answer audio, so initial timing may be limited.",
          ],
          speechReason,
        )
      : unavailable(
          calibrationValid ? "insufficient-samples" : "invalid-signal",
          signalLimitations,
        );
  const longestSilenceMetric: MetricValue<Milliseconds> =
    longestInternalSilenceMs !== undefined && calibrationValid
      ? metricValue(
          speechMetricStatus,
          milliseconds(longestInternalSilenceMs),
          signalLimitations,
          speechReason,
        )
      : unavailable("insufficient-samples", signalLimitations);
  const wpmMetric = approximateWordsPerMinute(
    input.transcriptWordCount,
    speakingMs,
    signalLimitations,
  );

  return {
    algorithmVersion: AUDIO_METRIC_ALGORITHM_VERSION,
    status:
      metricStatus === "available" && speechMetricStatus === "available"
        ? "complete"
        : "partial",
    sampleRateHz: hertz(AUDIO_SAMPLE_RATE_HZ),
    sampleCount,
    invalidSampleCount,
    calibration,
    answerDurationMs: answerDuration,
    delayBeforeSpeechMs: delayMetric,
    speakingDurationMs: speakingMetric,
    silenceDurationMs: silenceMetric,
    longestInternalSilenceMs: longestSilenceMetric,
    averageMicrophoneLevelDbfs: levelMetric,
    peakMicrophoneLevelDbfs: peakMetric,
    approximateWordsPerMinute: wpmMetric,
    speechSegments,
    warnings: [...warningSet],
  };
}

export function createUnavailableAudioMetrics(
  reason: AvailabilityReason,
  startedAtMs: number,
  finishedAtMs: number,
): AudioMetrics {
  return unavailableAudioMetrics({
    answerDuration: answerDurationMetric({
      startedAtMs,
      finishedAtMs,
      captureRequested: false,
      windows: [],
    }),
    reason,
    sampleCount: 0,
    invalidSampleCount: 0,
    warnings: reason === "not-requested" ? ["transcript-missing"] : [],
  });
}

function answerDurationMetric(
  input: AudioMetricsInput,
): MetricValue<Milliseconds> {
  if (
    !Number.isFinite(input.startedAtMs) ||
    !Number.isFinite(input.finishedAtMs)
  ) {
    return unavailable("unknown", [
      "Answer duration timestamps were unavailable.",
    ]);
  }

  const value = milliseconds(
    Math.max(0, Math.round(input.finishedAtMs - input.startedAtMs)),
  );
  if (input.interruptionReason) {
    return partial(value, input.interruptionReason, [
      "The duration includes an interruption and may be approximate.",
    ]);
  }

  return available(value, ["Answer duration comes from the interview timer."]);
}

function unavailableAudioMetrics({
  answerDuration,
  invalidSampleCount,
  reason,
  sampleCount,
  warnings,
}: {
  readonly answerDuration: MetricValue<Milliseconds>;
  readonly invalidSampleCount: number;
  readonly reason: AvailabilityReason;
  readonly sampleCount: number;
  readonly warnings: readonly AudioMetricWarning[];
}): AudioMetrics {
  const limitations = [
    ...audioLimitations,
    "Audio signal metrics were not available.",
  ];
  return {
    algorithmVersion: AUDIO_METRIC_ALGORITHM_VERSION,
    status: "unavailable",
    sampleRateHz: hertz(AUDIO_SAMPLE_RATE_HZ),
    sampleCount,
    invalidSampleCount,
    answerDurationMs: answerDuration,
    delayBeforeSpeechMs: unavailable(reason, limitations),
    speakingDurationMs: unavailable(reason, limitations),
    silenceDurationMs: unavailable(reason, limitations),
    longestInternalSilenceMs: unavailable(reason, limitations),
    averageMicrophoneLevelDbfs: unavailable(reason, limitations),
    peakMicrophoneLevelDbfs: unavailable(reason, limitations),
    approximateWordsPerMinute: unavailable("missing-transcript", [
      ...limitations,
      "Approximate words per minute needs a reviewed transcript and enough detected speech time.",
    ]),
    speechSegments: [],
    warnings,
  };
}

function isValidObservation(observation: AudioWindowObservation) {
  return (
    observation.trackLive &&
    Number.isFinite(observation.rms) &&
    observation.rms >= 0 &&
    Number.isFinite(observation.offsetMs) &&
    observation.offsetMs >= 0
  );
}

function metricValue<Value>(
  status: "available" | "partial",
  value: Value,
  limitations: readonly string[],
  reason: AvailabilityReason,
): MetricValue<Value> {
  return status === "available"
    ? available(value, limitations)
    : partial(value, reason, limitations);
}

function partialOrUnavailable<Value>(
  rawValue: number | undefined,
  factory: (value: number) => Value,
  reason: AvailabilityReason,
  limitations: readonly string[],
): MetricValue<Value> {
  if (rawValue === undefined) {
    return unavailable(reason, limitations);
  }

  return partial(factory(roundTo(rawValue, 3)), reason, limitations);
}

function available<Value>(
  value: Value,
  limitations: readonly string[],
): MetricValue<Value> {
  return {
    status: "available",
    value,
    calculationQuality: "adequate",
    limitations,
  };
}

function partial<Value>(
  value: Value,
  reason: AvailabilityReason,
  limitations: readonly string[],
): MetricValue<Value> {
  return {
    status: "partial",
    value,
    calculationQuality: "limited",
    limitations,
    reason,
  };
}

function unavailable<Value>(
  reason: AvailabilityReason,
  limitations: readonly string[],
): MetricValue<Value> {
  return {
    status: "unavailable",
    reason,
    limitations,
  };
}

function limitationsForSignal(
  calibration: AudioCalibration,
  reason: AvailabilityReason | undefined,
) {
  const limitations: string[] = [...audioLimitations];
  if (calibration.calibrationQuality === "noisy") {
    limitations.push("Calibration detected a high room or device noise floor.");
  }
  if (calibration.calibrationQuality === "invalid") {
    limitations.push("The captured signal could not be validated.");
  }
  if (reason === "insufficient-samples") {
    limitations.push(
      "Fewer than 5 seconds of valid audio windows were captured.",
    );
  }
  if (reason === "interrupted" || reason === "device-lost") {
    limitations.push("Capture stopped before the answer review was finalized.");
  }
  return limitations;
}

function averageMicrophoneLevel(
  observations: readonly AudioWindowObservation[],
): number | undefined {
  if (observations.length === 0) {
    return undefined;
  }

  const meanSquares =
    observations.reduce(
      (total, observation) => total + observation.rms ** 2,
      0,
    ) / observations.length;
  return Number(rmsToDbfs(Math.sqrt(meanSquares)));
}

function percentileDbfs(
  observations: readonly AudioWindowObservation[],
  percentile: number,
): number | undefined {
  if (observations.length === 0) {
    return undefined;
  }

  const values = observations
    .map((observation) => Number(rmsToDbfs(observation.rms)))
    .sort((left, right) => left - right);
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(percentile * values.length) - 1),
  );
  return values[index];
}

function approximateWordsPerMinute(
  transcriptWordCount: number | undefined,
  speakingMs: number,
  limitations: readonly string[],
): MetricValue<WordsPerMinute> {
  if (transcriptWordCount === undefined) {
    return unavailable("missing-transcript", [
      ...limitations,
      "Approximate words per minute needs a reviewed transcript.",
    ]);
  }

  if (
    transcriptWordCount < MINIMUM_WPM_WORDS ||
    speakingMs < MINIMUM_WPM_SPEECH_MS
  ) {
    return unavailable("insufficient-samples", [
      ...limitations,
      "Approximate words per minute needs at least 10 reviewed words and 5 seconds of detected speech time.",
    ]);
  }

  return available(
    wordsPerMinute(roundTo(transcriptWordCount / (speakingMs / 60_000), 1)),
    [
      ...limitations,
      "Approximate words per minute is based on reviewed text and detected speech activity.",
    ],
  );
}

function mergeAndFilterSegments(
  rawSegments: readonly { readonly start: number; readonly end: number }[],
) {
  const merged: { start: number; end: number }[] = [];
  for (const segment of rawSegments) {
    if (segment.end <= segment.start) {
      continue;
    }

    const previous = merged.at(-1);
    if (previous && segment.start - previous.end < MERGE_GAP_MS) {
      previous.end = Math.max(previous.end, segment.end);
      continue;
    }

    merged.push({ start: segment.start, end: segment.end });
  }

  return merged.filter(
    (segment) => segment.end - segment.start >= MINIMUM_SEGMENT_MS,
  );
}

function sumSegmentDuration(segments: readonly SpeechSegment[]) {
  return segments.reduce(
    (total, segment) => total + (segment.endOffsetMs - segment.startOffsetMs),
    0,
  );
}

function longestInternalSilence(
  segments: readonly SpeechSegment[],
): number | undefined {
  if (segments.length < 2) {
    return undefined;
  }

  let longest = 0;
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const current = segments[index];
    if (!previous || !current) {
      continue;
    }
    longest = Math.max(longest, current.startOffsetMs - previous.endOffsetMs);
  }
  return longest;
}

function metricNumber(metric: MetricValue<Milliseconds>) {
  return metric.status === "unavailable" ? 0 : metric.value;
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left === undefined || right === undefined
    ? undefined
    : (left + right) / 2;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
