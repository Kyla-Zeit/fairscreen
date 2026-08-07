# Interview Feature

M06 implements the interview workflow shell. M07 adds optional microphone audio
measurement and recording review without changing the approved state names. M08
adds optional camera preview, camera-inclusive recording modes, and aggregate
video-condition measurement during answering only.

- `machine.ts` is a pure reducer with the approved six states:
  `ready`, `preparing`, `answering`, `reviewing`, `betweenQuestions`, and
  `complete`.
- `timing.ts` derives countdown, expiry, warnings, overtime, and sparse
  announcements from injected timestamps.
- `progressPersistence.ts` serializes only safe checkpoints and projects saved
  attempts through the M03 `FairScreenRepository` domain port.
- `InterviewPage.tsx` provides keyboard-accessible controls, confirmation
  before discarding active work, retry attempts, report-attempt selection,
  preview visibility, Exit, and global Stop integration with the resource
  registry.
- M07 capture starts only from the answering flow, stops on finish/repeat/skip/
  end/exit/pagehide/global Stop, and persists only safe aggregate audio metrics
  plus an explicit saved recording reference.
- M08 camera and MediaPipe analysis also start only from answering, stop through
  the same cleanup paths, and persist only safe aggregate `VideoMetrics`.

M09 and M10 add opt-in browser recognition, manual/reviewed transcript flow,
deterministic post-answer coaching, and optional live delivery/structure prompts.
Reports, exports, and saved-session UI are implemented in later milestones. FairScreen still produces no hiring score, rank, or
recommendation.
