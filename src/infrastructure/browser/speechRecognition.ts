import type { IsoDateTime } from "../../domain/common";
import { isoDateTime, milliseconds } from "../../domain/factories";
import type {
  RecognitionSegment,
  TranscriptResult,
  TranscriptionError,
} from "../../domain/models";
import type {
  CancellationSignal,
  TranscriptionCapability,
  TranscriptionProvider,
  TranscriptionSession,
  TranscriptionStartInput,
} from "../../domain/ports";
import { createTranscriptRevision } from "../../features/transcription/transcription";

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error?: string;
  readonly message?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionWindow extends Window {
  readonly SpeechRecognition?: SpeechRecognitionConstructor;
  readonly webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export function createBrowserSpeechRecognitionProvider(): TranscriptionProvider {
  return {
    kind: "browser-speech",
    getCapability: async () => capability(),
    start: async (input, signal) => startSession(input, signal),
  };
}

export function createUnavailableTranscriptionProvider(): TranscriptionProvider {
  return {
    kind: "none",
    getCapability: async () => ({
      status: "unsupported",
      processingMode: "unknown",
      disclosureRequired: false,
      limitations: [
        "Browser speech recognition is unavailable. A manual transcript can still be entered.",
      ],
    }),
    start: async () => unavailableSession(),
  };
}

function capability(): TranscriptionCapability {
  const constructor = recognitionConstructor();
  if (!constructor) {
    return {
      status: "unsupported",
      processingMode: "unknown",
      disclosureRequired: false,
      limitations: [
        "This browser does not expose the Web Speech recognition API.",
        "Use a manual transcript for answer-content coaching.",
      ],
    };
  }

  return {
    status: "limited",
    processingMode: "unknown",
    disclosureRequired: true,
    limitations: [
      "The browser may process speech on-device or through a browser/vendor service; FairScreen cannot verify which mode is used.",
      "Only microphone speech is submitted to the browser recognition service. Camera frames, recordings, résumé data, and job context are not sent by FairScreen.",
      "Recognition output must be reviewed by the user before content coaching runs.",
    ],
  };
}

async function startSession(
  input: TranscriptionStartInput,
  signal?: CancellationSignal,
): Promise<TranscriptionSession> {
  const Constructor = recognitionConstructor();
  if (!Constructor) {
    return unavailableSession();
  }
  if (!input.disclosureAccepted) {
    return unavailableSession({
      code: "service-not-allowed",
      recoverable: true,
      safeMessage:
        "Speech recognition was not started because disclosure was not accepted.",
    });
  }

  const recognition = new Constructor();
  const sessionId = `speech:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
  const listeners = new Set<(result: TranscriptResult) => void>();
  const startedAt = performance.now();
  let stopped = false;
  let ended = false;
  let finalText = "";
  let interimText = "";
  let segments: RecognitionSegment[] = [];
  let errors: TranscriptionError[] = [];
  let resolveStopped: ((result: TranscriptResult) => void) | undefined;
  let stopPromise: Promise<TranscriptResult> | undefined;
  const disclosureAcceptedAt = nowIso();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = input.locale;
  recognition.maxAlternatives = 1;

  const currentResult = (): TranscriptResult => {
    const text = [finalText, interimText].filter(Boolean).join(" ").trim();
    const revision = text
      ? createTranscriptRevision({
          revisionKey: `${sessionId}:${segments.length}`,
          createdAt: nowIso(),
          text,
          source: "browser-speech",
          reviewedByUser: false,
          locale: input.locale,
        })
      : undefined;

    return {
      status: ended
        ? finalText.trim()
          ? "complete"
          : "unavailable"
        : "partial",
      providerId: "browser-web-speech",
      processingMode: "unknown",
      disclosureAcceptedAt,
      ...(revision
        ? { activeRevision: revision, revisions: [revision] }
        : { revisions: [] }),
      errors,
      limitations: capability().limitations,
    };
  };

  const emit = () => {
    const result = currentResult();
    for (const listener of listeners) {
      listener(result);
    }
  };

  recognition.onresult = (event) => {
    let nextInterim = "";
    const nextSegments = [...segments];
    for (
      let index = event.resultIndex;
      index < event.results.length;
      index += 1
    ) {
      const result = event.results[index];
      const alternative = result?.[0];
      const text = alternative?.transcript?.replace(/\s+/g, " ").trim();
      if (!result || !text) continue;
      if (result.isFinal) {
        finalText = `${finalText} ${text}`.trim();
        nextSegments.push({
          text,
          isFinal: true,
          startOffsetMs: milliseconds(
            Math.max(0, Math.round(performance.now() - startedAt)),
          ),
        });
      } else {
        nextInterim = `${nextInterim} ${text}`.trim();
      }
    }
    interimText = nextInterim;
    segments = nextSegments;
    emit();
  };

  recognition.onerror = (event) => {
    const error = mapRecognitionError(event.error);
    if (!errors.some((candidate) => candidate.code === error.code)) {
      errors = [...errors, error];
    }
    emit();
  };

  recognition.onend = () => {
    ended = true;
    interimText = "";
    emit();
    if (resolveStopped) {
      resolveStopped(currentResult());
      resolveStopped = undefined;
    }
  };

  const unregisterAbort = signal?.addAbortListener(() => {
    if (!stopped) {
      stopped = true;
      recognition.abort();
    }
  });

  try {
    recognition.start();
  } catch {
    unregisterAbort?.();
    return unavailableSession({
      code: "unknown",
      recoverable: true,
      safeMessage: "Browser speech recognition could not start.",
    });
  }

  return {
    sessionId,
    stop: () => {
      if (stopPromise) return stopPromise;
      stopped = true;
      stopPromise = new Promise<TranscriptResult>((resolve) => {
        resolveStopped = resolve;
        try {
          recognition.stop();
        } catch {
          ended = true;
          resolve(currentResult());
        }
        window.setTimeout(() => {
          if (!ended) {
            ended = true;
            try {
              recognition.abort();
            } catch {
              // The recognizer may already be closed.
            }
            resolve(currentResult());
          }
        }, 1_500);
      }).finally(() => {
        unregisterAbort?.();
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
      });
      return stopPromise;
    },
    abort: () => {
      if (stopped) return;
      stopped = true;
      unregisterAbort?.();
      try {
        recognition.abort();
      } catch {
        // The recognizer may already be closed.
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      listener(currentResult());
      return () => listeners.delete(listener);
    },
  };
}

function unavailableSession(error?: TranscriptionError): TranscriptionSession {
  const result: TranscriptResult = {
    status: "unavailable",
    providerId: "browser-web-speech",
    processingMode: "unknown",
    revisions: [],
    errors: error
      ? [error]
      : [
          {
            code: "unsupported",
            recoverable: true,
            safeMessage: "Browser speech recognition is unavailable.",
          },
        ],
    limitations: ["Enter a transcript manually for answer-content coaching."],
  };
  return {
    sessionId: `speech:unavailable:${Date.now()}`,
    stop: async () => result,
    abort: () => undefined,
    subscribe: (listener) => {
      listener(result);
      return () => undefined;
    },
  };
}

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function mapRecognitionError(code: string | undefined): TranscriptionError {
  switch (code) {
    case "not-allowed":
      return {
        code: "permission-denied",
        recoverable: true,
        safeMessage: "Speech recognition permission was not granted.",
      };
    case "service-not-allowed":
      return {
        code: "service-not-allowed",
        recoverable: false,
        safeMessage: "The browser blocked its speech-recognition service.",
      };
    case "audio-capture":
      return {
        code: "audio-capture",
        recoverable: true,
        safeMessage: "Speech recognition could not access microphone audio.",
      };
    case "network":
      return {
        code: "network",
        recoverable: true,
        safeMessage:
          "The browser speech-recognition service reported a network error.",
      };
    case "no-speech":
    case "no-match":
      return {
        code: "no-match",
        recoverable: true,
        safeMessage: "No usable speech was recognized.",
      };
    case "aborted":
      return {
        code: "aborted",
        recoverable: true,
        safeMessage: "Speech recognition stopped.",
      };
    default:
      return {
        code: "unknown",
        recoverable: true,
        safeMessage: "Speech recognition reported an unknown error.",
      };
  }
}

function nowIso(): IsoDateTime {
  return isoDateTime(new Date().toISOString());
}
