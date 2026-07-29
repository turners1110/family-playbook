import { beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { clearMemoryStore, readStore } from "@/lib/db/local-store";
import { saveAnswer, getAnswerHistory } from "@/lib/services/answers";
import { createSession, getSession, advanceSession } from "@/lib/services/sessions";
import { saveDecision, getDecision } from "@/lib/services/decisions";
import { buildPlaybookPreview } from "@/lib/services/playbook";

beforeAll(() => {
  clearMemoryStore();
  const gen = spawnSync("pnpm", ["generate:questions"], { cwd: process.cwd(), shell: true });
  if (gen.status !== 0) throw new Error(gen.stderr?.toString() || "generate failed");
  const seed = spawnSync("pnpm", ["seed"], { cwd: process.cwd(), shell: true });
  if (seed.status !== 0) throw new Error(seed.stderr?.toString() || "seed failed");
  clearMemoryStore();
});

describe("seed and answer versioning", () => {
  it("seeds at least 300 questions and 75 outcomes", async () => {
    const store = await readStore();
    expect(store.questions.length).toBeGreaterThanOrEqual(300);
    expect(store.outcomes.length).toBeGreaterThanOrEqual(75);
    expect(store.family.name).toBe("Turner Family");
  });

  it("preserves answer history on update", async () => {
    const store = await readStore();
    const question =
      store.questions.find(
        (q) => !store.answers.some((a) => a.question_id === q.id && a.is_shared),
      ) ?? store.questions[5];
    await saveAnswer({
      question_id: question.id,
      is_shared: true,
      payload: { text: "First answer" },
      status: "in_discussion",
      confidence: 2,
      change_reason: "first",
    });
    await saveAnswer({
      question_id: question.id,
      is_shared: true,
      payload: { text: "Revised answer" },
      status: "tentatively_decided",
      confidence: 4,
      change_reason: "revised",
    });
    clearMemoryStore();
    const next = await readStore();
    const answer = next.answers.find((a) => a.question_id === question.id && a.is_shared)!;
    expect(answer.payload.text).toBe("Revised answer");
    expect(answer.version).toBeGreaterThanOrEqual(2);
    const history = await getAnswerHistory(answer.id);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history.some((h) => h.payload.text === "First answer")).toBe(true);
  });

  it("supports separate answers", async () => {
    const store = await readStore();
    const question = store.questions[1];
    const sam = store.members.find((m) => m.display_name === "Sam")!;
    const michelle = store.members.find((m) => m.display_name === "Michelle")!;
    await saveAnswer({
      question_id: question.id,
      is_shared: false,
      member_id: sam.id,
      payload: { text: "Sam view" },
      status: "in_discussion",
      confidence: null,
    });
    await saveAnswer({
      question_id: question.id,
      is_shared: false,
      member_id: michelle.id,
      payload: { text: "Michelle view" },
      status: "in_discussion",
      confidence: null,
    });
    clearMemoryStore();
    const next = await readStore();
    const answers = next.answers.filter((a) => a.question_id === question.id && !a.is_shared);
    expect(answers.length).toBeGreaterThanOrEqual(2);
  });

  it("creates and resumes sessions", async () => {
    const sessionId = await createSession({
      title: "Test session",
      length: "quick",
      filters: { only_unanswered: true, include_high_priority: true },
      babymoon_mode: true,
    });
    const detail = await getSession(sessionId);
    expect(detail?.items.length).toBeGreaterThan(0);
    await advanceSession(sessionId, "answered");
    const resumed = await getSession(sessionId);
    expect(resumed?.session.current_index).toBeGreaterThanOrEqual(1);
  });

  it("creates decisions linked to outcomes and appears in playbook", async () => {
    const store = await readStore();
    await saveDecision({
      title: "Night duty plan",
      statement: "We will alternate primary overnight response in week one.",
      status: "decided",
      confidence: 4,
      decision_type: "operational",
      outcome_ids: [store.outcomes[0].id],
      categories: ["parent_partnership", "sleep"],
      source_question_ids: [store.questions[0].id],
    });
    const decisions = (await readStore()).decisions;
    const created = decisions.find((d) => d.title === "Night duty plan");
    expect(created).toBeTruthy();
    const detail = await getDecision(created!.id);
    expect(detail?.versions.length).toBeGreaterThanOrEqual(1);
    const { playbook } = await buildPlaybookPreview(false);
    const text = playbook.sections.map((s) => s.content).join("\n");
    expect(text).toContain("Night duty plan");
  });
});
