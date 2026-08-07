# Recording Feature

M07 implements optional recording review.

- `transientRecording.ts` owns in-memory recording review handles and object URL
  cleanup.
- MediaRecorder capture is implemented in `src/infrastructure/browser` and is
  started only from a user-selected interview answer flow.
- A completed recording is saved to IndexedDB only after the user chooses to
  save it on this device. Save failure keeps the in-memory review available
  while the page remains active.
- Domain models store only a saved recording reference and metadata. Recording
  blobs stay inside the infrastructure recording repository.
