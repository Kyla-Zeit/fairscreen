# Third-Party Notices

Application version: `0.10.0`

This file records third-party packages and bundled runtime assets that are
relevant to the FairScreen runtime, M07.2 resume file import, and M08 optional
video-condition measurement. Package source text and complete license files
remain in `node_modules` after installation and are excluded from release ZIP
artifacts.

## Direct Runtime Packages

| Package                   | Version   | License      | Use                                               |
| ------------------------- | --------- | ------------ | ------------------------------------------------- |
| `@mediapipe/tasks-vision` | `0.10.35` | Apache-2.0   | Local optional Face Landmarker worker runtime.    |
| `lucide-react`            | `1.28.0`  | ISC          | Same-origin bundled UI icons.                     |
| `mammoth`                 | `1.12.0`  | BSD-2-Clause | Local DOCX plain-text extraction.                 |
| `pdfjs-dist`              | `6.2.108` | Apache-2.0   | Local PDF text extraction and bundled PDF worker. |
| `react`                   | `19.2.8`  | MIT          | UI runtime.                                       |
| `react-dom`               | `19.2.8`  | MIT          | UI rendering.                                     |
| `react-router-dom`        | `7.18.2`  | MIT          | Hash routing.                                     |
| `zod`                     | `4.4.3`   | MIT          | Runtime validation at configured boundaries.      |

## Bundled Mammoth Browser Dependencies

The Mammoth browser bundle used for DOCX import includes these notices from its
packaged browser build:

| Package              | License                 |
| -------------------- | ----------------------- |
| `@xmldom/xmldom`     | MIT                     |
| `base64-js`          | MIT                     |
| `bluebird`           | MIT                     |
| `buffer`             | MIT                     |
| `dingbat-to-unicode` | BSD-2-Clause            |
| `ieee754`            | BSD-3-Clause            |
| `isarray`            | MIT                     |
| `jszip`              | MIT OR GPL-3.0-or-later |
| `lop`                | BSD-2-Clause            |
| `path-is-absolute`   | MIT                     |
| `pako`               | MIT                     |
| `process`            | MIT                     |
| `readable-stream`    | MIT                     |
| `safe-buffer`        | MIT                     |
| `sax`                | ISC                     |
| `underscore`         | MIT                     |
| `util-deprecate`     | MIT                     |
| `xmlbuilder`         | MIT                     |

## M07.2 Runtime Boundary

Resume import uses these packages only after a user chooses a local file. It
does not use a CDN, backend upload, remote conversion service, OCR service,
remote AI provider, or browser extension. Extracted content is rendered only as
plain text in a read-only setup preview and is saved to setup state only after
the user confirms it.

## M08 MediaPipe Assets

FairScreen bundles these same-origin assets for optional camera-condition
measurement:

- `public/mediapipe/models/face_landmarker.task`, prepared at development/build time from the Google
  MediaPipe model path
  `mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`.
- `public/mediapipe/wasm/*`, prepared at development/build time from
  `node_modules/@mediapipe/tasks-vision/wasm` for the pinned
  `@mediapipe/tasks-vision@0.10.35` package.

These assets are lazy-loaded only after the user starts answering with camera
analysis enabled. The worker discards frames, pixels, landmarks, matrices, and
blendshapes immediately after approved aggregate observations are calculated.
No model or WASM asset is loaded from a CDN at runtime.
