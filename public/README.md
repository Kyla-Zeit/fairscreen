# Public Assets

FairScreen serves runtime assets from the same origin.

- `pdf.worker.mjs` supports browser-local PDF resume extraction.
- `mediapipe/models/face_landmarker.task` is the pinned optional M08 Face
  Landmarker model.
- `mediapipe/wasm/*` contains the pinned MediaPipe Tasks Vision WASM loader and
  runtime files copied from `@mediapipe/tasks-vision@0.10.35`.

Static pages and camera-free interview paths must not load MediaPipe assets.
