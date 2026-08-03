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
    remoteCanonical !== homeCanonical ||
    remoteSessionAnswered !== homeConversation ||
    (resumeProgress != null &&
      resumeProgress.answeredCount !== snapshot.conversationAnsweredCount);

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
        <h2 className="font-display text-xl">Compare counts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Home and Storage Debug both use{" "}
          <code className="text-xs">buildFamilyProgressMetrics</code>. Mismatches
          are flagged in red.
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Deep discussions (Home = Debug)
            </dt>
            <dd>{familyProgress.canonicalQuestionsAnswered}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Conversation prompts
            </dt>
            <dd>{familyProgress.conversationPromptsCompleted}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Essentials</dt>
            <dd>
              {familyProgress.essentialsScreensCompleted} of{" "}
              {familyProgress.essentialsScreensVisible}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Shared decisions</dt>
            <dd>{familyProgress.sharedDecisions}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">Open follow-ups</dt>
            <dd>{familyProgress.openFollowUps}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Real quick answers
            </dt>
            <dd>{familyProgress.conversationQuickAnswers}</dd>
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
            {remoteCanonical !== homeCanonical
              ? " · deep discussions"
              : ""}
            {remoteSessionAnswered !== homeConversation
              ? " · conversation prompts"
              : ""}
            {resumeProgress != null &&
            resumeProgress.answeredCount !== snapshot.conversationAnsweredCount
              ? " · active session"
              : ""}
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
