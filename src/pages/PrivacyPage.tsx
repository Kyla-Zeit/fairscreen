import { Database, Download, LockKeyhole, ShieldCheck } from "lucide-react";

import { LinkButton } from "../shared/components/LinkButton";
import { Notice } from "../shared/components/Notice";
import { PageContainer } from "../shared/components/PageContainer";
import { PageHeader } from "../shared/components/PageHeader";

const lifecycleRows = [
  {
    data: "Camera frames",
    trigger:
      "Only after the user chooses camera and grants browser permission.",
    processing: "Current frame is processed locally for the current sample.",
    stored: "Never stored by FairScreen.",
    export: "Never exported.",
    deletion: "Frame references are discarded and tracks stop on exit.",
  },
  {
    data: "Audio samples",
    trigger: "Only after the user chooses microphone and grants permission.",
    processing: "Audio level and pause estimates are calculated in memory.",
    stored: "Raw samples are never stored.",
    export: "Only aggregate metrics when the user selects them.",
    deletion:
      "Audio resources stop and saved aggregates delete with the session.",
  },
  {
    data: "Face landmarks",
    trigger: "Only while optional local video analysis processes a frame.",
    processing: "Used inside the worker to produce sanitized observations.",
    stored: "Never stored.",
    export: "Never exported.",
    deletion: "References are cleared after the current frame.",
  },
  {
    data: "Transcripts",
    trigger: "Manual entry or browser speech recognition after disclosure.",
    processing: "Only the user-reviewed text is analyzed.",
    stored: "Reviewed text may be saved with the session.",
    export: "Only when the user includes it.",
    deletion: "Deletes with the response, session, or all-data action.",
  },
  {
    data: "Recordings",
    trigger: "Only when recording is enabled before practice.",
    processing: "Completed recording stays in memory for review.",
    stored: "Saved in this browser only after a separate save choice.",
    export: "Not embedded in text or JSON reports.",
    deletion: "Discard transient recordings or delete saved recordings.",
  },
  {
    data: "Session data",
    trigger: "When the user creates or saves a local session.",
    processing: "Questions, settings, notes, and references remain local.",
    stored: "Best-effort origin browser storage.",
    export: "Only selected fields in user-initiated exports.",
    deletion: "Delete one item or all stored data when controls are available.",
  },
  {
    data: "Job description and résumé text",
    trigger:
      "Job description is typed by the user. Résumé text is added only after the user uploads a file and confirms the extracted plain text.",
    processing:
      "Résumé files are parsed locally; only confirmed plain text is used for question context and reviewed feedback.",
    stored: "With the session snapshot after creation.",
    export: "Excluded unless selected.",
    deletion: "Deletes with the session or all-data action.",
  },
  {
    data: "Capability and device preferences",
    trigger: "Capability scan or an explicit remembered-device choice.",
    processing: "Used to explain fallbacks.",
    stored: "Optional and limited to settings.",
    export: "Technical support output only after user action.",
    deletion: "Reset settings or delete all data.",
  },
];

export function PrivacyPage() {
  return (
    <PageContainer className="page-stack education-page">
      <PageHeader
        eyebrow="Privacy"
        title="Your practice data stays under your control"
        lead="FairScreen is designed as a static, client-only application. Practice features are built around local processing, explicit choices, and clear limits on what browser storage can promise."
        actions={
          <>
            <LinkButton to="/interviews/new">
              Start a practice interview
            </LinkButton>
            <LinkButton to="/methodology" variant="secondary">
              Read methodology
            </LinkButton>
          </>
        }
      />

      <section className="content-grid" aria-label="Privacy commitments">
        <article className="info-card">
          <div className="card-icon">
            <ShieldCheck aria-hidden="true" size={24} />
          </div>
          <h2>What runs locally</h2>
          <p>
            FairScreen&apos;s app code, deterministic content checks, and
            optional condition observations run in the browser. Runtime assets
            are served from the app origin.
          </p>
        </article>
        <article className="info-card">
          <div className="card-icon">
            <LockKeyhole aria-hidden="true" size={24} />
          </div>
          <h2>What is never stored</h2>
          <p>
            Raw camera frames, face landmarks, transformation matrices, and raw
            audio samples are not represented in saved data or exports.
          </p>
        </article>
        <article className="info-card">
          <div className="card-icon">
            <Database aria-hidden="true" size={24} />
          </div>
          <h2>What is stored and when</h2>
          <p>
            Saved sessions use origin-scoped browser storage only after a user
            action. Browser storage is best effort and can be cleared by the
            browser, private mode, or the person using the profile.
          </p>
        </article>
        <article className="info-card">
          <div className="card-icon">
            <Download aria-hidden="true" size={24} />
          </div>
          <h2>Export and deletion</h2>
          <p>
            Exports are user initiated and should preview included sensitive
            fields. Deletion controls must explain whether one item or all local
            data is affected.
          </p>
        </article>
      </section>

      <Notice title="Speech-recognition caveat" variant="warning">
        Browser speech recognition is optional and is not available everywhere.
        Depending on your browser, audio may be sent to the browser vendor or
        another recognition service. Review and edit the transcript before
        FairScreen analyzes it, or choose a manual transcript instead.
      </Notice>

      <section className="section-block" aria-labelledby="data-lifecycle">
        <div className="section-heading">
          <p className="eyebrow">Data lifecycle</p>
          <h2 id="data-lifecycle">Plain-language handling table</h2>
          <p>
            Practice workflows save local records only after user action. These
            rows describe the required handling as each workflow becomes
            available.
          </p>
        </div>
        <div
          className="table-wrap"
          role="region"
          aria-label="Data lifecycle table"
        >
          <table>
            <caption>How FairScreen handles each data type</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Collection trigger</th>
                <th scope="col">Processing</th>
                <th scope="col">Persistence</th>
                <th scope="col">Export</th>
                <th scope="col">Deletion</th>
              </tr>
            </thead>
            <tbody>
              {lifecycleRows.map((row) => (
                <tr key={row.data}>
                  <th scope="row">{row.data}</th>
                  <td>{row.trigger}</td>
                  <td>{row.processing}</td>
                  <td>{row.stored}</td>
                  <td>{row.export}</td>
                  <td>{row.deletion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="limitation-panel" aria-labelledby="storage-limits">
        <div className="card-icon">
          <LockKeyhole aria-hidden="true" size={24} />
        </div>
        <div>
          <h2 id="storage-limits">Browser storage limits</h2>
          <p>
            FairScreen does not promise browser storage is encrypted, permanent,
            securely erased, or inaccessible to other people using this browser
            profile or extensions. It does not use analytics, advertising,
            tracking pixels, cookies, session replay, or remote error reporting.
          </p>
        </div>
      </section>
    </PageContainer>
  );
}
