import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import { buildEssentialsDashboard } from "@/lib/essentials/progress";
import { planEssentialsByMinutes } from "@/lib/essentials/session-plan";

export const dynamic = "force-dynamic";

export default async function EssentialsSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ length?: string; start?: string }>;
}) {
  await requireFamilyContext();
  const { length, start } = await searchParams;
  const store = await readStore();
  const dash = buildEssentialsDashboard(store);

  const incomplete = dash.screens
    .filter(
      (s) =>
        s.visible &&
        (s.state === "not_started" ||
          s.state === "in_progress" ||
          s.state === "needs_follow_up"),
    )
    .map((s) => s.screen);

  const questionMinutes = new Map(
    store.questions.map((q) => [q.id, q.estimated_minutes]),
  );

  const budget =
    length === "15" ? 15 : length === "30" ? 30 : length === "60" ? 60 : 0;
  const plan = planEssentialsByMinutes(incomplete, budget, questionMinutes);

  if (start === "1") {
    const first = plan.screens[0]?.id ?? dash.resume_screen_id;
    if (first) {
      redirect(`/questions/before-birth/screen/${first}?session=1&length=${length ?? "all"}`);
    }
    redirect("/questions/before-birth/review");
  }

  const options = [
    {
      length: "15",
      label: "About 15 minutes",
      plan: planEssentialsByMinutes(incomplete, 15, questionMinutes),
    },
    {
      length: "30",
      label: "About 30 minutes",
      plan: planEssentialsByMinutes(incomplete, 30, questionMinutes),
    },
    {
      length: "60",
      label: "About 60 minutes",
      plan: planEssentialsByMinutes(incomplete, 60, questionMinutes),
    },
    {
      length: "all",
      label: "Continue until paused",
      plan: planEssentialsByMinutes(incomplete, 0, questionMinutes),
    },
  ];

  return (
    <AppShell
      title="Babymoon session"
      subtitle="One discussion at a time. Progress saves after every screen."
      focusMode
      actions={
        <Link href="/questions/before-birth" className="btn btn-ghost">
          Dashboard
        </Link>
      }
    >
      <section className="surface space-y-4 p-5">
        <p className="text-sm text-ink-muted">
          {incomplete.length} open essentials discussions remain. Choose a session
          length — we pack screens by expected discussion time, not a fixed count.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((opt) => (
            <Link
              key={opt.length}
              href={`/questions/before-birth/session?length=${opt.length}&start=1`}
              className="btn btn-primary min-h-14 justify-start px-4"
            >
              <span>
                {opt.label}
                <span className="mt-1 block text-xs font-normal opacity-90">
                  {opt.plan.screens.length} screen
                  {opt.plan.screens.length === 1 ? "" : "s"} · about{" "}
                  {opt.plan.aboutMinutes || "—"} min
                </span>
              </span>
            </Link>
          ))}
        </div>
        {dash.resume_screen_id ? (
          <Link
            href={`/questions/before-birth/screen/${dash.resume_screen_id}?session=1`}
            className="btn btn-secondary"
          >
            Resume current screen
          </Link>
        ) : (
          <p className="text-sm text-ink-subtle">All visible essentials are complete.</p>
        )}
      </section>
    </AppShell>
  );
}
