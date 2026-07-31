import { readStore, updateStore, nowIso, id } from "@/lib/db/local-store";
import { coolingOffSchema, settingsSchema } from "@/lib/validation/schemas";
import { z } from "zod";

export async function startCoolingOff(
  input: z.infer<typeof coolingOffSchema>,
) {
  const data = coolingOffSchema.parse(input);
  const timestamp = nowIso();
  const start = timestamp.slice(0, 10);
  const revisit = new Date(Date.now() + data.wait_days * 86400000)
    .toISOString()
    .slice(0, 10);

  await updateStore((store) => {
    store.cooling_off_items.unshift({
      id: id("cool"),
      family_id: store.family.id,
      question_id: data.question_id ?? null,
      decision_id: data.decision_id ?? null,
      start_date: start,
      wait_days: data.wait_days,
      reason: data.reason,
      revisit_date: revisit,
      notes: data.notes ?? null,
      active: true,
      created_at: timestamp,
    });

    if (data.question_id) {
      const answers = store.answers.filter((a) => a.question_id === data.question_id);
      for (const answer of answers) {
        answer.status = "cooling_off";
        answer.updated_at = timestamp;
      }
    }
    return store;
  });
}

export async function scheduleReview(input: {
  entity_type: "question" | "answer" | "decision" | "outcome" | "principle";
  entity_id: string;
  review_date: string;
  reason?: string;
}) {
  const timestamp = nowIso();
  await updateStore((store) => {
    store.reviews.unshift({
      id: id("review"),
      family_id: store.family.id,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      review_date: input.review_date,
      reason: input.reason ?? null,
      completed: false,
      created_at: timestamp,
    });
    return store;
  });
}

export async function toggleBookmark(questionId: string, memberId: string) {
  await updateStore((store) => {
    const existing = store.bookmarks.find(
      (b) => b.question_id === questionId && b.member_id === memberId,
    );
    if (existing) {
      store.bookmarks = store.bookmarks.filter((b) => b.id !== existing.id);
    } else {
      store.bookmarks.push({
        id: id("bm"),
        family_id: store.family.id,
        member_id: memberId,
        question_id: questionId,
        created_at: nowIso(),
      });
    }
    return store;
  });
}

export async function updateSettings(input: z.infer<typeof settingsSchema>) {
  const data = settingsSchema.parse(input);
  await updateStore((store) => {
    store.settings = {
      ...store.settings,
      ...data,
      updated_at: nowIso(),
    };
    return store;
  });
}

export async function getFamilyContext() {
  // Deprecated for identity: use requireFamilyContext() from lib/auth/family-context.
  // Kept for local product-data callers during Phase 1.
  const store = await readStore();
  const currentUser = store.users.find((u) => u.id === store.current_user_id)!;
  const currentMember = store.members.find((m) => m.user_id === store.current_user_id)!;
  return {
    family: store.family,
    users: store.users,
    members: store.members,
    currentUser,
    currentMember,
    settings: store.settings,
    demoMode: store.demo_mode,
  };
}

/** @deprecated Fake identity switching is removed. */
export async function switchCurrentUser(_userId?: string) {
  void _userId;
  throw new Error("Identity switching is disabled. Sign in with your own magic link.");
}
