# Dependency Inventory

Application version: `0.10.0`

FairScreen pins all direct dependencies exactly in `package.json` and
`package-lock.json`. Runtime dependencies are served from the FairScreen origin
after build; no CDN, analytics, tracking, remote conversion, OCR, or remote AI
provider is used.

## Runtime Dependencies

| Package                   | Version   | Purpose                                                                           | Boundary                                               |
| ------------------------- | --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `@mediapipe/tasks-vision` | `0.10.35` | Local Face Landmarker runtime for optional M08 video-condition measurement.       | Lazy worker import after camera analysis is enabled.   |
| `lucide-react`            | `1.28.0`  | Local UI icons.                                                                   | Bundled same-origin.                                   |
| `mammoth`                 | `1.12.0`  | Browser-local DOCX plain-text extraction for M07.2 resume import.                 | Loaded only after user selects a DOCX file; no upload. |
| `pdfjs-dist`              | `6.2.108` | Browser-local PDF text extraction and same-origin worker for M07.2 resume import. | Loaded only after user selects a PDF file; no upload.  |
| `react`                   | `19.2.8`  | UI runtime.                                                                       | Bundled same-origin.                                   |
| `react-dom`               | `19.2.8`  | UI rendering.                                                                     | Bundled same-origin.                                   |
| `react-router-dom`        | `7.18.2`  | Hash routing.                                                                     | Bundled same-origin.                                   |
| `zod`                     | `4.4.3`   | Runtime schema validation at storage/export/config boundaries.                    | Bundled same-origin.                                   |

## M08.3 Provider Boundary Notes

- Job posting import and company research add injectable provider interfaces but
  no browser-bundled secrets and no additional runtime dependency.
- The default static browser services return explicit unavailable/fallback
  results. Real URL retrieval must be implemented behind a server-side provider
  with HTTP/HTTPS-only allowlisting, private-network blocking, redirect limits,
  response-size limits, content-type checks, timeouts, and sanitization.

## M07.2 Parser Notes

- PDF.js worker output is emitted by Vite under the configured `/fairscreen/`
  base path and loaded from the same origin.
- Mammoth is used only for `extractRawText`; document HTML is never rendered.
- Original files, filenames, document bytes, parser buffers, PDF page objects,
  and DOCX archives remain transient and are not persisted or exported.
- Extracted text is staged in a read-only preview and enters setup state only
  after the user confirms it.
- `npm run audit:deps` allowlists these runtime dependencies and still rejects
  unpinned versions, tracking packages, remote runtime URLs, and browser API
  boundary bypasses.

## M08 MediaPipe Asset Notes

- MediaPipe Tasks Vision is pinned to `0.10.35`.
- The Face Landmarker model is pinned to
  `face_landmarker/face_landmarker/float16/1/face_landmarker.task` and prepared at build time as `public/mediapipe/models/face_landmarker.task` with SHA-256 verification.
- The Tasks Vision WASM loader/runtime files are copied at development/build time from
  `node_modules/@mediapipe/tasks-vision/wasm` to `public/mediapipe/wasm` so the
  production app fetches them from the FairScreen origin.
- Static routes, setup, device check, and camera-free interviews do not load
  MediaPipe. The worker is created only after the user starts answering with
  camera analysis enabled.
- Worker responses are sanitized to approved aggregate observations only. Raw
  frames, pixels, landmarks, transformation matrices, and blendshapes must not
  cross into persistence, logs, exports, or answer-content analysis.
