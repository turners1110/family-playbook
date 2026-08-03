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
import { buildProgressSnapshot } from "@/lib/services/answered-status";
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
  const resumeProgress = activeSession
    ? getConversationSessionProgress(store, activeSession.id)
    : null;

  const latestQuick = [...quick].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  )[0];

  const countMismatch =
    resumeProgress &&
    (resumeProgress.answeredCount !== snapshot.conversationAnsweredCount ||
      resumeProgress.itemCount !== snapshot.conversationItemCount);

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
          Canonical progress vs resume display. Mismatches are flagged.
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Homepage / library answered
            </dt>
            <dd>
              {snapshot.libraryAnsweredCount} / {snapshot.libraryQuestionCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Essentials completed screens
            </dt>
            <dd>
              {snapshot.essentialsCompletedScreens} /{" "}
              {snapshot.essentialsVisibleScreens}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Active session answered (canonical)
            </dt>
            <dd>
              {snapshot.conversationAnsweredCount} /{" "}
              {snapshot.conversationItemCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Resume card answered
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
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Canonical library answered
            </dt>
            <dd>{snapshot.libraryAnsweredCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Status index size
            </dt>
            <dd>{snapshot.statusIndexSize}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Last remote update (cache signal)
            </dt>
            <dd>
              {health.updatedAt
                ? new Date(health.updatedAt).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-ink-subtle">
              Count mismatch flagged
            </dt>
            <dd>{countMismatch ? "yes" : "no"}</dd>
          </div>
        </dl>
        {countMismatch ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            Count mismatch between canonical snapshot and resume progress.
          </p>
        ) : (
          <p className="mt-3 text-sm text-accent">Counts aligned.</p>
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
