# MediaPipe Runtime Assets

FairScreen uses MediaPipe Face Landmarker for optional, local video-condition measurement.

The large runtime assets are intentionally not committed to Git:

- `npm run prepare:mediapipe` copies the six WASM loader/runtime files from the exact pinned `@mediapipe/tasks-vision` dependency.
- It downloads the pinned Google Face Landmarker float16 model and verifies its SHA-256 checksum before writing it to `models/face_landmarker.task`.
- `npm run dev` and `npm run build` invoke this preparation automatically.

The built application serves all MediaPipe files from the FairScreen origin. No model, frame, landmark, or recording is sent to a third-party service at runtime.
