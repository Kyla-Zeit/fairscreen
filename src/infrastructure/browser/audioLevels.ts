export type MicrophoneLevelText =
  "No level yet" | "Low signal" | "Signal detected" | "Possible clipping";

export interface MicrophoneLevelReading {
  readonly percent: number;
  readonly text: MicrophoneLevelText;
}

export interface MicrophoneLevelMonitor {
  readonly subscribe: (
    listener: (reading: MicrophoneLevelReading) => void,
  ) => () => void;
  readonly stop: () => Promise<void>;
}

export interface AudioLevelEnvironment {
  readonly AudioContext?: typeof AudioContext | undefined;
  readonly webkitAudioContext?: typeof AudioContext | undefined;
}

export function createBrowserMicrophoneLevelMonitor(
  stream: MediaStream,
  environment: AudioLevelEnvironment = readAudioLevelEnvironment(),
  intervalMs = 160,
): MicrophoneLevelMonitor {
  const AudioContextConstructor =
    environment.AudioContext ?? environment.webkitAudioContext;

  if (!AudioContextConstructor) {
    return createStaticMicrophoneLevelMonitor();
  }

  const audioContext = new AudioContextConstructor();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const listeners = new Set<(reading: MicrophoneLevelReading) => void>();
  const data = new Uint8Array(analyser.fftSize);
  const intervalId = window.setInterval(() => {
    analyser.getByteTimeDomainData(data);
    const percent = calculateLevelPercent(data);
    const reading = {
      percent,
      text: levelTextFromPercent(percent),
    };

    for (const listener of listeners) {
      listener(reading);
    }
  }, intervalMs);

  void audioContext.resume().catch(() => undefined);

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener({ percent: 0, text: "No level yet" });

      return () => {
        listeners.delete(listener);
      };
    },
    async stop() {
      window.clearInterval(intervalId);
      listeners.clear();
      source.disconnect();
      analyser.disconnect();
      await audioContext.close().catch(() => undefined);
    },
  };
}

export function createStaticMicrophoneLevelMonitor(): MicrophoneLevelMonitor {
  const listeners = new Set<(reading: MicrophoneLevelReading) => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener({ percent: 0, text: "No level yet" });

      return () => {
        listeners.delete(listener);
      };
    },
    stop() {
      listeners.clear();
      return Promise.resolve();
    },
  };
}

export function levelTextFromPercent(percent: number): MicrophoneLevelText {
  if (percent <= 0) {
    return "No level yet";
  }

  if (percent < 18) {
    return "Low signal";
  }

  if (percent > 88) {
    return "Possible clipping";
  }

  return "Signal detected";
}

function calculateLevelPercent(samples: Uint8Array): number {
  let sumSquares = 0;

  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sumSquares += normalized * normalized;
  }

  const rms = Math.sqrt(sumSquares / samples.length);
  return Math.min(100, Math.round(rms * 220));
}

function readAudioLevelEnvironment(): AudioLevelEnvironment {
  const windowLike = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

  return {
    AudioContext: windowLike.AudioContext,
    webkitAudioContext: windowLike.webkitAudioContext,
  };
}
