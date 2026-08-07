import { Database, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";

import { useFairScreenRepository } from "../../app/FairScreenRepositoryProvider";
import {
  isoDateTime,
  milliseconds,
  validatedLocale,
} from "../../domain/factories";
import type {
  ContrastPreference,
  MotionPreference,
  TextSizePreference,
  UserSettings,
} from "../../domain/models";
import type { StorageFailure } from "../../domain/ports";
import {
  estimateStorage,
  type ApproximateStorageEstimate,
} from "../../infrastructure/browser/storageEstimate";
import { Button } from "../../shared/components/Button";
import { Notice } from "../../shared/components/Notice";
import { PageContainer } from "../../shared/components/PageContainer";
import { PageHeader } from "../../shared/components/PageHeader";
import { Status } from "../../shared/components/Status";

interface LocalDataSummary {
  readonly sessions: number;
  readonly responses: number;
  readonly recordings: number;
}

export function SettingsPage() {
  const {
    repository,
    status,
    error: repositoryError,
    retry,
  } = useFairScreenRepository();
  const [settings, setSettings] = useState<UserSettings>();
  const [summary, setSummary] = useState<LocalDataSummary>({
    sessions: 0,
    responses: 0,
    recordings: 0,
  });
  const [estimate, setEstimate] = useState<ApproximateStorageEstimate>();
  const [failure, setFailure] = useState<StorageFailure>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  const load = useCallback(async () => {
    if (status === "opening") return;
    if (status === "unavailable") {
      setFailure(repositoryError);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFailure(undefined);
    const [settingsResult, storageEstimate] = await Promise.all([
      repository.getSettings(),
      estimateStorage(
        typeof navigator === "undefined" ? undefined : navigator.storage,
      ),
    ]);
    setEstimate(storageEstimate);
    if (!settingsResult.ok) {
      setFailure(settingsResult.error);
      setLoading(false);
      return;
    }

    const sessions = [];
    let cursor: string | undefined;
    let responseCount = 0;
    let recordingCount = 0;
    do {
      const result = await repository.listSessions(
        { sort: "updated-desc" },
        { pageSize: 100, ...(cursor ? { cursor } : {}) },
      );
      if (!result.ok) {
        setFailure(result.error);
        setLoading(false);
        return;
      }
      sessions.push(...result.value.values);
      cursor = result.value.nextCursor;
    } while (cursor);

    for (const session of sessions) {
      const responseResult = await repository.listResponses(session.id);
      if (!responseResult.ok) {
        setFailure(responseResult.error);
        setLoading(false);
        return;
      }
      responseCount += responseResult.value.length;
      recordingCount += responseResult.value.filter(
        (response) => response.recording,
      ).length;
    }

    setSettings(settingsResult.value);
    setSummary({
      sessions: sessions.length,
      responses: responseCount,
      recordings: recordingCount,
    });
    setLoading(false);
  }, [repository, repositoryError, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  function updateSettings(patch: Partial<UserSettings>) {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  }

  async function saveSettings() {
    if (!settings || status !== "persistent") return;
    setSaving(true);
    const result = await repository.saveSettings({
      ...settings,
      updatedAt: isoDateTime(new Date().toISOString()),
    });
    setSaving(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setLiveMessage("Settings saved on this device.");
    await load();
  }

  async function resetSettings() {
    if (status !== "persistent") return;
    setSaving(true);
    const result = await repository.resetSettings();
    setSaving(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setSettings(result.value);
    setLiveMessage("Settings restored to FairScreen defaults.");
  }

  async function deleteAllLocalData() {
    if (status !== "persistent") return;
    setSaving(true);
    const result = await repository.delete({
      kind: "all-data",
      includeSettings: false,
    });
    setSaving(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setConfirmDelete(false);
    setLiveMessage(
      `Deleted ${result.value.sessions} sessions, ${result.value.responses} responses, and ${result.value.recordings} recordings. Settings were kept.`,
    );
    await load();
  }

  const readOnly = status !== "persistent";

  return (
    <PageContainer className="page-stack settings-page">
      <PageHeader
        eyebrow="Local preferences"
        title="Settings"
        lead={
          <p>
            Adjust defaults for future practice and manage data stored in this
            browser. Saved sessions and recordings remain local unless you
            choose to export or delete them.
          </p>
        }
      />

      <p aria-live="polite" className="visually-hidden">
        {liveMessage}
      </p>

      {failure ? (
        <Notice title="Settings could not be loaded" variant="error">
          <p>{storageFailureMessage(failure)}</p>
          <Button
            icon={<RefreshCw aria-hidden="true" size={18} />}
            onClick={() => void retry().then(load)}
            variant="secondary"
          >
            Try again
          </Button>
        </Notice>
      ) : null}

      {status === "read-only-recovery" ? (
        <Notice title="Settings are read-only" variant="warning">
          <p>
            This browser database was created by a newer FairScreen build. You
            can inspect local data, but this build will not alter it.
          </p>
        </Notice>
      ) : null}

      {loading || !settings ? (
        <Status>Opening local settings…</Status>
      ) : (
        <>
          <section
            aria-labelledby="practice-defaults-title"
            className="settings-card"
          >
            <div className="settings-card__heading">
              <div>
                <p className="eyebrow">Future interviews</p>
                <h2 id="practice-defaults-title">Practice defaults</h2>
              </div>
            </div>

            <div className="settings-grid">
              <label className="field-stack">
                <span>Default question count</span>
                <input
                  disabled={readOnly}
                  max={20}
                  min={1}
                  onChange={(event) => {
                    updateSettings({
                      defaultInterviewSettings: {
                        ...settings.defaultInterviewSettings,
                        questionCount: clampNumber(event, 1, 20),
                      },
                    });
                  }}
                  type="number"
                  value={settings.defaultInterviewSettings.questionCount}
                />
              </label>

              <label className="field-stack">
                <span>Preparation time (seconds)</span>
                <input
                  disabled={readOnly}
                  max={600}
                  min={0}
                  onChange={(event) => {
                    updateSettings({
                      defaultInterviewSettings: {
                        ...settings.defaultInterviewSettings,
                        preparationTimeMs: milliseconds(
                          clampNumber(event, 0, 600) * 1_000,
                        ),
                      },
                    });
                  }}
                  type="number"
                  value={
                    settings.defaultInterviewSettings.preparationTimeMs / 1_000
                  }
                />
              </label>

              <label className="field-stack">
                <span>Answer time (seconds)</span>
                <input
                  disabled={readOnly}
                  max={1_800}
                  min={0}
                  onChange={(event) => {
                    updateSettings({
                      defaultInterviewSettings: {
                        ...settings.defaultInterviewSettings,
                        answerTimeMs: milliseconds(
                          clampNumber(event, 0, 1_800) * 1_000,
                        ),
                      },
                    });
                  }}
                  type="number"
                  value={settings.defaultInterviewSettings.answerTimeMs / 1_000}
                />
              </label>

              <label className="field-stack">
                <span>Preferred locale</span>
                <input
                  disabled={readOnly}
                  onChange={(event) => {
                    updateSettings({
                      preferredLocale: validatedLocale(
                        event.currentTarget.value || "en-CA",
                      ),
                    });
                  }}
                  type="text"
                  value={settings.preferredLocale}
                />
              </label>
            </div>

            <div className="settings-checks">
              <CheckSetting
                checked={settings.announceTimerThresholds}
                disabled={readOnly}
                label="Announce timer thresholds for screen readers"
                onChange={(checked) => {
                  updateSettings({ announceTimerThresholds: checked });
                }}
              />
              <CheckSetting
                checked={settings.hideSelfPreviewWhileAnswering}
                disabled={readOnly}
                label="Hide my self-preview while answering"
                onChange={(checked) => {
                  updateSettings({ hideSelfPreviewWhileAnswering: checked });
                }}
              />
              <CheckSetting
                checked={settings.showConditionPrompts}
                disabled={readOnly}
                label="Show optional video-call condition prompts"
                onChange={(checked) => {
                  updateSettings({ showConditionPrompts: checked });
                }}
              />
              <CheckSetting
                checked={settings.rememberSelectedDevices}
                disabled={readOnly}
                label="Remember selected camera and microphone on this device"
                onChange={(checked) => {
                  updateSettings({ rememberSelectedDevices: checked });
                }}
              />
            </div>
          </section>

          <section aria-labelledby="display-title" className="settings-card">
            <div className="settings-card__heading">
              <div>
                <p className="eyebrow">Accessibility</p>
                <h2 id="display-title">Display and motion</h2>
              </div>
            </div>
            <div className="settings-grid">
              <SelectSetting<TextSizePreference>
                disabled={readOnly}
                label="Text size"
                onChange={(textSize) => {
                  updateSettings({ textSize });
                }}
                options={[
                  ["default", "Default"],
                  ["large", "Large"],
                  ["extra-large", "Extra large"],
                ]}
                value={settings.textSize}
              />
              <SelectSetting<ContrastPreference>
                disabled={readOnly}
                label="Contrast"
                onChange={(contrast) => {
                  updateSettings({ contrast });
                }}
                options={[
                  ["system", "Use system setting"],
                  ["default", "Default"],
                  ["high", "High contrast"],
                ]}
                value={settings.contrast}
              />
              <SelectSetting<MotionPreference>
                disabled={readOnly}
                label="Motion"
                onChange={(motion) => {
                  updateSettings({ motion });
                }}
                options={[
                  ["system", "Use system setting"],
                  ["reduced", "Reduced motion"],
                  ["standard", "Standard motion"],
                ]}
                value={settings.motion}
              />
            </div>
          </section>

          <div className="action-row">
            <Button
              disabled={readOnly || saving}
              icon={<Save aria-hidden="true" size={18} />}
              onClick={() => void saveSettings()}
            >
              Save settings
            </Button>
            <Button
              disabled={readOnly || saving}
              icon={<RefreshCw aria-hidden="true" size={18} />}
              onClick={() => void resetSettings()}
              variant="secondary"
            >
              Restore defaults
            </Button>
          </div>

          <section
            aria-labelledby="storage-title"
            className="settings-card settings-card--storage"
          >
            <div className="settings-card__heading">
              <div>
                <p className="eyebrow">Browser storage</p>
                <h2 id="storage-title">Local data</h2>
              </div>
              <Database aria-hidden="true" size={28} />
            </div>

            <dl className="storage-summary">
              <div>
                <dt>Saved sessions</dt>
                <dd>{summary.sessions}</dd>
              </div>
              <div>
                <dt>Saved responses</dt>
                <dd>{summary.responses}</dd>
              </div>
              <div>
                <dt>Saved recordings</dt>
                <dd>{summary.recordings}</dd>
              </div>
              <div>
                <dt>Approximate browser usage</dt>
                <dd>{formatStorageEstimate(estimate)}</dd>
              </div>
            </dl>

            <p className="field-help">
              The browser estimate may include other websites. Recordings are
              never included in text or JSON exports and can be deleted without
              deleting the interview.
            </p>

            {!confirmDelete ? (
              <Button
                disabled={readOnly || saving || summary.sessions === 0}
                icon={<Trash2 aria-hidden="true" size={18} />}
                onClick={() => {
                  setConfirmDelete(true);
                }}
                variant="danger"
              >
                Delete all saved sessions
              </Button>
            ) : (
              <Notice
                title="Delete all saved interview data?"
                variant="warning"
              >
                <p>
                  This permanently removes every saved session, response, and
                  recording in this browser. Your settings remain.
                </p>
                <div className="action-row">
                  <Button
                    disabled={saving}
                    icon={<Trash2 aria-hidden="true" size={18} />}
                    onClick={() => void deleteAllLocalData()}
                    variant="danger"
                  >
                    Delete all saved data
                  </Button>
                  <Button
                    disabled={saving}
                    onClick={() => {
                      setConfirmDelete(false);
                    }}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                </div>
              </Notice>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}

function CheckSetting({
  checked,
  disabled,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="check-control">
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function SelectSetting<Value extends string>({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly (readonly [Value, string])[];
  readonly value: Value;
}) {
  return (
    <label className="field-stack">
      <span>{label}</span>
      <select
        disabled={disabled}
        onChange={(event) => {
          onChange(event.currentTarget.value as Value);
        }}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function clampNumber(
  event: ChangeEvent<HTMLInputElement>,
  min: number,
  max: number,
) {
  const value = Number(event.currentTarget.value);
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function formatStorageEstimate(
  estimate: ApproximateStorageEstimate | undefined,
) {
  if (!estimate) return "Checking…";
  if (estimate.status === "unavailable") return "Not available";
  const usage = formatBytes(estimate.usageBytes);
  return estimate.quotaBytes === undefined
    ? usage
    : `${usage} of ${formatBytes(estimate.quotaBytes)}`;
}

function formatBytes(value: number) {
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${(value / 1_024).toFixed(1)} KB`;
  if (value < 1_024 * 1_024 * 1_024) {
    return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
  }
  return `${(value / (1_024 * 1_024 * 1_024)).toFixed(1)} GB`;
}

function storageFailureMessage(failure: StorageFailure) {
  switch (failure.code) {
    case "blocked":
      return "Another FairScreen tab is blocking local storage. Close it, then try again.";
    case "quota-exceeded":
      return "Browser storage is full. Export important work and remove old recordings or sessions.";
    case "future-version":
      return "This data was created by a newer FairScreen build and is available only in recovery mode.";
    case "record-corrupt":
      return "A damaged local record was isolated so the remaining data can still be used.";
    default:
      return "Local browser storage is unavailable. Your current tab can continue without persistent saving.";
  }
}
