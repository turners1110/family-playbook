"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { QaRunRecord } from "@/lib/types/models";
import type { IntegrityReport } from "@/lib/qa/integrity";
import {
  actionCleanupQaData,
  actionCompleteQaSession,
  actionConfirmQaTasks,
  actionCreateQaTestPack,
  actionExportQaReport,
  actionPreviewQaCleanup,
  actionRunQaIntegrity,
  actionSeedQaAnswers,
  actionUpdateQaPhase,
} from "@/lib/actions/qa-lab";
import { useSaveFeedback } from "@/hooks/useSaveFeedback";
import {
  RetrySavePanel,
  SaveButton,
  SlowSaveNotice,
} from "@/components/ui/save-feedback";

export function TestLabClient({
  runs,
  selectedRun,
  actorName,
  authMode,
}: {
  runs: QaRunRecord[];
  selectedRun: QaRunRecord | null;
  actorName: string;
  authMode: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const taskSave = useSaveFeedback();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [cleanupPreview, setCleanupPreview] = useState<{
    counts: Record<string, number>;
    confirmation_token: string;
  } | null>(null);
  const [cleanupConfirm, setCleanupConfirm] = useState("");
  const [taskSelection, setTaskSelection] = useState<string[]>([
    "QA Task One",
    "QA Provider Follow-Up",
  ]);

  function run(fn: () => Promise<void>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed.");
      }
    });
  }

  const busy = pending || taskSave.isBusy;

  return (
    <div className="space-y-5">
      <section className="surface border-warning/40 bg-warning-soft/40 p-5">
        <h2 className="font-display text-xl text-warning">Warning</h2>
        <p className="mt-2 text-sm">
          Test Lab creates temporary test answers, sessions, and tasks. Test
          records are clearly labeled and removable. Do not use this against
          important real answers unless you choose to.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Actor: {actorName} · Auth: {authMode} · Access: Sam only (Michelle via
          ENABLE_QA_TEST_LAB_MICHELLE)
        </p>
      </section>

      <section className="surface p-5">
        <h2 className="font-display text-xl">Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await actionCreateQaTestPack();
                setMessage(`Created ${result.testRunId}`);
                router.push(`/settings/test-lab?run=${result.testRunId}`);
              })
            }
          >
            Create QA Test Pack
          </button>
          {selectedRun ? (
            <>
              <Link
                href={`/conversations/test/${selectedRun.test_run_id}`}
                className="btn btn-secondary"
              >
                Open QA Session
              </Link>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const report = await actionRunQaIntegrity(
                      selectedRun.test_run_id,
                    );
                    setIntegrity(report);
                    setMessage(
                      `Integrity: ${report.summary.pass} pass / ${report.summary.fail} fail / ${report.summary.warning} warn`,
                    );
                  })
                }
              >
                Run Automated Integrity Check
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await actionSeedQaAnswers(selectedRun.test_run_id);
                    setMessage("Seeded expected QA answers for automated checks.");
                  })
                }
              >
                Seed expected answers
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const exported = await actionExportQaReport(
                      selectedRun.test_run_id,
                    );
                    downloadBlob(
                      exported.filenameJson,
                      JSON.stringify(exported.json, null, 2),
                      "application/json",
                    );
                    downloadBlob(exported.filenameMd, exported.md, "text/markdown");
                    setMessage("QA report downloaded (JSON + Markdown).");
                  })
                }
              >
                Export QA Report
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await actionCompleteQaSession(selectedRun.test_run_id);
                    setMessage("QA session marked complete with summary.");
                  })
                }
              >
                Complete QA session
              </button>
            </>
          ) : null}
        </div>
        {message ? <p className="mt-3 text-sm text-accent">{message}</p> : null}
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="surface p-5">
        <h2 className="font-display text-xl">Inspect Test Data</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No active QA runs.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <code className="text-xs">{r.test_run_id}</code>
                  <span className="ml-2 text-ink-muted">
                    {r.status} · {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <Link
                  href={`/settings/test-lab?run=${r.test_run_id}`}
                  className="btn btn-ghost"
                >
                  Select
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedRun ? (
        <>
          <section className="surface p-5">
            <h2 className="font-display text-xl">Selected run</h2>
            <p className="mt-2 font-mono text-sm">{selectedRun.test_run_id}</p>
            <p className="mt-1 text-sm text-ink-muted">
              Session: {selectedRun.session_id ?? "—"} · Status:{" "}
              {selectedRun.status}
            </p>
            {selectedRun.integrity_summary ? (
              <p className="mt-2 text-sm">
                Last integrity: {selectedRun.integrity_summary.pass} pass /{" "}
                {selectedRun.integrity_summary.fail} fail /{" "}
                {selectedRun.integrity_summary.warning} warn
              </p>
            ) : null}
          </section>

          <section className="surface p-5">
            <h2 className="font-display text-xl">Task-suggestion test</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Suggestions only until confirmed. Confirm is idempotent.
            </p>
            <ul className="mt-3 space-y-2">
              {selectedRun.suggested_tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={taskSelection.includes(t.title)}
                    onChange={(e) => {
                      setTaskSelection((prev) =>
                        e.target.checked
                          ? [...prev, t.title]
                          : prev.filter((x) => x !== t.title),
                      );
                    }}
                  />
                  <span>
                    {t.title}
                    {t.confirmed ? " · confirmed" : " · suggestion"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-2">
              <SlowSaveNotice tier={taskSave.slowTier} />
              <RetrySavePanel
                state={taskSave.state}
                message={taskSave.statusMessage}
                onRetry={() => void taskSave.retry()}
                disabled={taskSave.isBusy}
              />
              <p className="sr-only" aria-live="polite">
                {taskSave.statusMessage}
              </p>
              <SaveButton
                state={taskSave.state}
                idleLabel="Confirm selected tasks"
                className="mt-1"
                onClick={() =>
                  void taskSave.runSave(
                    async () => {
                      await actionConfirmQaTasks(
                        selectedRun.test_run_id,
                        taskSelection,
                      );
                      setMessage("Confirmed selected QA tasks (idempotent).");
                    },
                    {
                      operation: "confirm_qa_tasks",
                      route: "/settings/test-lab",
                      testRunId: selectedRun.test_run_id,
                      onSuccess: async () => router.refresh(),
                    },
                  )
                }
              />
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="font-display text-xl">Phone test checklist</h2>
            <div className="mt-3 space-y-4">
              {selectedRun.manual_phases.map((phase) => (
                <article
                  key={phase.id}
                  className="rounded-xl border border-border bg-bg-elevated p-4"
                >
                  <h3 className="font-medium">{phase.title}</h3>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-muted">
                    {phase.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Expected:</span> {phase.expected}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        ["passed", "Mark passed"],
                        ["failed", "Mark failed"],
                        ["not_tested", "Not tested"],
                      ] as const
                    ).map(([status, label]) => (
                      <button
                        key={status}
                        type="button"
                        className={
                          phase.status === status
                            ? "btn btn-primary"
                            : "btn btn-secondary"
                        }
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await actionUpdateQaPhase(
                              selectedRun.test_run_id,
                              phase.id,
                              { status },
                            );
                          })
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="mt-2 w-full rounded-xl border border-border bg-bg p-3 text-sm"
                    rows={2}
                    placeholder="Notes"
                    defaultValue={phase.notes}
                    onBlur={(e) => {
                      const notes = e.target.value;
                      if (notes === phase.notes) return;
                      run(async () => {
                        await actionUpdateQaPhase(
                          selectedRun.test_run_id,
                          phase.id,
                          { notes },
                        );
                      });
                    }}
                  />
                </article>
              ))}
            </div>
          </section>

          {integrity ? (
            <section className="surface p-5">
              <h2 className="font-display text-xl">Integrity results</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {integrity.summary.pass} pass · {integrity.summary.fail} fail ·{" "}
                {integrity.summary.warning} warning
              </p>
              <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">
                {integrity.checks.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border p-3">
                    <div className="font-medium">
                      [{c.status}] {c.label}
                    </div>
                    <div className="text-ink-muted">
                      expected: {c.expected} · actual: {c.actual}
                    </div>
                    <div className="text-xs text-ink-subtle">{c.diagnostic}</div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="surface border-danger/30 p-5">
            <h2 className="font-display text-xl text-danger">Clean Up QA Data</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Removes only records where is_test_data=true and test_run_id matches.
              Real questions, answers, sessions, and tasks are never deleted.
            </p>
            <button
              type="button"
              className="btn btn-secondary mt-3"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const preview = await actionPreviewQaCleanup(
                    selectedRun.test_run_id,
                  );
                  setCleanupPreview(preview);
                })
              }
            >
              Preview cleanup counts
            </button>
            {cleanupPreview ? (
              <div className="mt-3 space-y-2 text-sm">
                <ul>
                  {Object.entries(cleanupPreview.counts).map(([k, v]) => (
                    <li key={k}>
                      {k}: {v}
                    </li>
                  ))}
                </ul>
                <p>
                  Type exactly:{" "}
                  <code>
                    DELETE QA {cleanupPreview.confirmation_token}
                  </code>
                </p>
                <input
                  className="w-full rounded-xl border border-border px-3 py-3"
                  value={cleanupConfirm}
                  onChange={(e) => setCleanupConfirm(e.target.value)}
                  placeholder={`DELETE QA ${cleanupPreview.confirmation_token}`}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await actionCleanupQaData(
                        selectedRun.test_run_id,
                        cleanupConfirm,
                      );
                      const report = await actionRunQaIntegrity(
                        selectedRun.test_run_id,
                      );
                      setIntegrity(report);
                      setMessage(
                        "Cleanup complete. Integrity re-run (expect zeros).",
                      );
                      setCleanupPreview(null);
                      setCleanupConfirm("");
                      router.push("/settings/test-lab");
                    })
                  }
                >
                  Confirm cleanup
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
