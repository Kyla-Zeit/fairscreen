# Transcription

M09 implements a local interview transcript lifecycle with three supported
paths: manual transcript, timing-only, and opt-in browser speech recognition.

Browser recognition is capability-gated and disclosed before start because the
browser may process speech on-device or through a vendor service. FairScreen
does not send camera frames, recordings, résumé data, job context, or company
research to that service. Generated text remains unreviewed until the user
confirms or edits it. Original and reviewed revisions are retained separately,
and only reviewed text may enter answer-content coaching.
