# Audio Feature

M07 implements local optional audio metrics.

- `audioMetrics.ts` is pure domain-adjacent logic for RMS, dBFS, adaptive VAD,
  speech segments, speaking duration, first detected speech delay, longest
  internal silence, average and peak microphone level, warnings, and
  unavailable/limited states.
- Web Audio sampling lives in `src/infrastructure/browser/webAudioAnalyzer.ts`
  and reuses a single time-domain buffer while storing only aggregate
  observations.
- Metrics describe recording setup and timing conditions only. They are never a
  communication quality, fluency, emotion, identity, accent, disability, or
  personality assessment.
