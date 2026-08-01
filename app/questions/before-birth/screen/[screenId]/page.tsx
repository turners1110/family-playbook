import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EssentialsScreenView } from "@/components/essentials/EssentialsScreen";
import { requireFamilyContext } from "@/lib/auth/family-context";
import { readStore } from "@/lib/db/store";
import {
  getEssentialsModule,
  getEssentialsScreen,
} from "@/lib/essentials/pathway";
import { nextScreenId } from "@/lib/essentials/progress";

export const dynamic = "force-dynamic";

export default async function EssentialsScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ screenId: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  await requireFamilyContext();
  const { screenId } = await params;
  const { session } = await searchParams;
  const store = await readStore();
  const screen = getEssentialsScreen(screenId);
  if (!screen) notFound();

  const question = store.questions.find((q) => q.id === screen.question_id);
  if (!question) notFound();

  const pairedQuestions = (screen.paired_question_ids ?? [])
    .map((id) => store.questions.find((q) => q.id === id))
    .filter(Boolean) as typeof store.questions;

  const answers = store.answers.filter((a) => a.question_id === screen.question_id);
  const pairedAnswers: Record<string, typeof answers> = {};
  for (const pq of pairedQuestions) {
    pairedAnswers[pq.id] = store.answers.filter((a) => a.question_id === pq.id);
  }

  const nextId = nextScreenId(screen.id, store);
  const nextHref = nextId
    ? `/questions/before-birth/screen/${nextId}${session ? "?session=1" : ""}`
    : "/questions/before-birth/review";

  const mod = getEssentialsModule(screen.module_id);
  const sessionMode = session === "1";

  return (
    <AppShell
      title={sessionMode ? "Babymoon session" : "Before Birth Essentials"}
      subtitle={mod?.title}
      focusMode={sessionMode}
      actions={
        <Link href="/questions/before-birth" className="btn btn-ghost">
          Exit to dashboard
        </Link>
      }
    >
      <EssentialsScreenView
        screen={screen}
        question={question}
        pairedQuestions={pairedQuestions}
        answers={answers}
        pairedAnswers={pairedAnswers}
        members={store.members}
        nextHref={nextHref}
        moduleTitle={mod?.title ?? "Essentials"}
        progressLabel={`Screen ${screen.display_order}`}
        sessionMode={sessionMode}
      />
    </AppShell>
  );
}
