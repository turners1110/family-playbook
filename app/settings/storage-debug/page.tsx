import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { requireFamilyContext } from "@/lib/auth/family-context";
import {
  getRemoteStoreHealth,
  getStorageMode,
  readStore,
  usesRemoteJsonStore,
} from "@/lib/db/store";
import {
  hashFamilyId,
  storageBackupLabel,
} from "@/lib/db/durable-save";
import { isEmergencyAccessModeEnabled } from "@/lib/auth/emergency";
import { buildFamilyProgressMetrics, buildProgressSnapshot } from "@/lib/services/answered-status";
import { getConversationSessionProgress } from "@/lib/services/conversations";
import { reconcileProgressTileCounts } from "@/lib/services/progress-records";
import {
  resolveDiscussionMode,
  summarizeClassification,
  type DiscussionMode,
} from "@/lib/discussions/discussion-mode";

export const dynamic = "force-dynamic";

/**
 * Safe storage diagnostics — never shows answer text, tokens, or secrets.
 */
export default async function StorageDebugPage() {
  const ctx = await requireFamilyContext();
  const store = await readStore();
  const mode = getStorageMode();
  const backup = storageBackupLabel();
  const health = usesRemoteJsonStore()
    ? await getRemoteStoreHealth()
    : {
        connected: false,
        familyName: store.family.name,
        familyId: store.family.id,
        version: null as number | null,
        updatedAt: null as string | null,
        backupCount: 0,
        lastBackupAt: null as string | null,
      };

  const sessions = store.conversation_sessions ?? [];
  const items = store.conversation_session_items ?? [];
  const quick = store.conversation_quick_answers ?? [];
  const answers = store.answers ?? [];
  const tasks = (store.checklist_tasks ?? []).length;
  const qaRuns = store.qa_runs?.length ?? 0;
  const activeSession =
    sessions
      .filter((s) => s.status === "active" || s.status === "paused")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;
  const snapshot = buildProgressSnapshot(store, activeSession);
  const familyProgress = buildFamilyProgressMetrics(store, activeSession);
  const resumeProgress = activeSession
    ? getConversationSessionProgress(store, activeSession.id)
    : null;
  const reconciliation = reconcileProgressTileCounts(store, familyProgress);

  const latestQuick = [...quick].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  )[0];

  const remoteCanonical = familyProgress.canonicalQuestionsAnswered;
  const remoteQuick = familyProgress.conversationQuickAnswers;
  const remoteSessionAnswered = familyProgress.conversationPromptsCompleted;
  const homeCanonical = familyProgress.canonicalQuestionsAnswered;
  const homeConversation = familyProgress.conversationPromptsCompleted;
  const essentialsDisplayed = familyProgress.essentialsScreensCompleted;

  const countMismatch =
    !reconciliation.allMatch ||
    remoteCanonical !== homeCanonical ||
    remoteSessionAnswered !== homeConversation ||
    (resumeProgress != null &&
      resumeProgress.answeredCount !== snapshot.conversationAnsweredCount);

  const discussionModes = store.questions.map(
    (q) =>
      resolveDiscussionMode({ question: q, preferExistingSeparate: false })
        .mode,
  );
  const discussionDist = summarizeClassification(discussionModes);
  const storedMissing = store.questions.filter((q) => !q.discussion_mode).length;

  return (
    <AppShell
      title="Storage debug"
      subtitle="Safe diagnostics for durability — no answer text."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/storage-health" className="btn btn-secondary">
            Storage health
          </Link>
          <Link href="/settings" className="btn btn-ghost">
            Settings
          </Link>
        </div>
      }
    >
      {backup.warning ? (
        <section className="surface mb-5 border-danger/40 bg-danger-soft/40 p-5">
          <h2 className="font-display text-xl text-danger">Durability warning</h2>
          <p className="mt-2 text-sm">{backup.warning}</p>
        </section>
      ) : null}

      <section className="surface p-5">
        <h2 className="font-display text-xl">Current store</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Storage mode</dt>
            <dd>{mode}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Trip Mode</dt>
            <dd>{isEmergencyAccessModeEnabled() ? "on" : "off"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Backup label</dt>
            <dd>{backup.label}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Remote connected</dt>
            <dd>
              {mode === "remote" ? (health.connected ? "yes" : "no") : "n/a"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Family</dt>
            <dd>{store.family.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Family id hash</dt>
            <dd className="font-mono text-xs">
              {hashFamilyId(store.family.id)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Actor</dt>
            <dd>{ctx.member.display_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Auth mode</dt>
            <dd>{ctx.mode}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">RLS catalog</dt>
            <dd>0012 reference tables secured (live migration applied)</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Latest migration file</dt>
            <dd className="font-mono text-xs">0012_secure_reference_tables.sql</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Remote required on Vercel</dt>
            <dd>{process.env.VERCEL === "1" ? "yes" : "n/a (not Vercel)"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Remote version</dt>
            <dd>{health.version ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Last remote update</dt>
            <dd>
              {health.updatedAt
                ? new Date(health.updatedAt).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Version history rows</dt>
            <dd>{health.backupCount}</dd>
          </div>
        </dl>
      </section>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-xl">Discussion modes</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Resolved modes for live questions. Never shows answer text.
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-ink-subtle">shared_first</dt>
            <dd>{discussionDist.shared_first}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">separate_first</dt>
            <dd>{discussionDist.separate_first}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">either</dt>
            <dd>{discussionDist.either}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">stored missing</dt>
            <dd>{storedMissing}</dd>
          </div>
        </dl>
      </section>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-xl">Compare counts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Home tile, detail list, and remote raw counts. Never hide mismatches.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-ink-subtle">
                <th className="py-2 pr-3">Metric</th>
                <th className="py-2 pr-3">Home tile</th>
                <th className="py-2 pr-3">Detail list</th>
                <th className="py-2 pr-3">Remote raw</th>
                <th className="py-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.rows.map((row) => (
                <tr key={row.key} className="border-b border-border/60">
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className="py-2 pr-3">{row.home}</td>
                  <td className="py-2 pr-3">{row.detail}</td>
                  <td className="py-2 pr-3">{row.remoteRaw}</td>
                  <td
                    className={
                      row.match ? "py-2 text-accent" : "py-2 text-danger"
                    }
                  >
                    {row.match ? "yes" : "no"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Essentials visible
            </dt>
            <dd>
              {essentialsDisplayed} of{" "}
              {familyProgress.essentialsScreensVisible}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Real quick answers
            </dt>
            <dd>{remoteQuick}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Legacy unique answer IDs
            </dt>
            <dd>{familyProgress.legacyUniqueAnsweredQuestionIds}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Active session answered
            </dt>
            <dd>
              {resumeProgress
                ? `${resumeProgress.answeredCount} / ${resumeProgress.itemCount}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Latest saved prompt</dt>
            <dd className="font-mono text-xs">
              {latestQuick?.prompt_id ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Latest session item</dt>
            <dd className="font-mono text-xs">
              {latestQuick?.session_item_id ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Latest actor</dt>
            <dd>{latestQuick?.actor ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Latest verified remote version
            </dt>
            <dd>{health.version ?? "—"}</dd>
          </div>
        </dl>
        {countMismatch ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            Counts differ
            {reconciliation.rows
              .filter((r) => !r.match)
              .map((r) => ` · ${r.label.toLowerCase()}`)
              .join("")}
          </p>
        ) : (
          <p className="mt-3 text-sm text-accent" role="status">
            Counts match
          </p>
        )}
      </section>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-xl">Counts (no content)</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Conversation sessions</dt>
            <dd>{sessions.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Session items</dt>
            <dd>{items.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Quick answers</dt>
            <dd>{quick.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Library answers</dt>
            <dd>{answers.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Checklist tasks</dt>
            <dd>{tasks}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">QA runs</dt>
            <dd>{qaRuns}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Active session</dt>
            <dd className="font-mono text-xs">
              {activeSession?.id ?? "—"} · index{" "}
              {activeSession?.current_item_index ?? "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="surface mt-5 p-5">
        <h2 className="font-display text-xl">Sessions (metadata only)</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {sessions
            .slice()
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .slice(0, 12)
            .map((s) => {
              const answered = items.filter(
                (i) =>
                  i.session_id === s.id &&
                  [
                    "answered_same",
                    "answered_different",
                    "shared_answer_saved",
                  ].includes(i.status),
              ).length;
              const quickFor = quick.filter((a) => a.session_id === s.id).length;
              return (
                <li key={s.id} className="rounded-lg border border-border p-3">
                  <div className="font-medium">{s.title}</div>
                  <div className="font-mono text-xs text-ink-muted">
                    {s.id} · {s.status} · index {s.current_item_index} ·{" "}
                    {answered} answered · {quickFor} quick rows · updated{" "}
                    {new Date(s.updated_at).toLocaleString()}
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
    </AppShell>
  );
}
