# Browser adapters

M03 includes injected clock/ID/random implementations and an on-demand Storage
API estimate adapter. Nothing in this directory runs merely because a route
loads. Permission and media capability adapters begin in M04.

M07 adds user-triggered Web Audio, MediaRecorder, and recording-storage
adapters. They keep raw audio samples, chunks, and blobs inside infrastructure
boundaries and clean up through page lifecycle and global Stop paths.

M07.2 keeps resume import user-triggered and upload-only for PDF, DOCX, and TXT.
Adapters return only sanitized plain text for explicit setup confirmation and
keep original files, filenames, bytes, parser buffers, and PDF/DOCX internals
transient.

M08 adds the optional video analysis client. It creates the dedicated MediaPipe
worker only after answering begins with camera analysis enabled, samples at the
configured frame rate with queue depth one, drops stale frames, and returns only
approved aggregate observations. Camera streams, workers, frame handles,
recorders, object URLs, and timers are disposed through the same Stop,
pagehide, replacement, error, and route-leave cleanup paths.
