# Video Feature

M08 implements optional video-condition measurement for the interview answering
state.

- `conditions.ts` converts transient MediaPipe Face Landmarker results into the
  approved face-presence, centering, framing, near-camera orientation,
  brightness, multi-face, and sampling observations.
- `aggregate.ts` summarizes observations into `VideoMetrics` for review and
  safe persistence.
- `videoWorkerProtocol.ts` defines the typed main-thread/worker boundary and
  rejects raw frames, pixels, landmarks, matrices, and blendshape-shaped data in
  worker responses.
- `videoAnalysis.worker.ts` lazily initializes the pinned same-origin MediaPipe
  runtime and model, processes one queued frame at a time, drops stale frames,
  and emits aggregate-only observations.

The feature never infers emotion, identity, personality, honesty, competence,
employability, disability, demographics, intent, liveness, cheating, or
interview suitability. Video observations are not an input to answer-content
analysis.
