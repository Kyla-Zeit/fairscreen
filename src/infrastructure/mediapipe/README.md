# MediaPipe Infrastructure

M08 keeps the MediaPipe runtime behind the browser service boundary:

- Same-origin runtime assets live under `public/mediapipe`.
- The application creates the worker only after explicit interview camera
  analysis enablement.
- Raw frame and landmark data stays in the worker and is discarded immediately
  after aggregate observations are produced.
- Failures return unavailable or partial video metrics without ending the
  interview or destroying audio, timing, notes, or recording results.
