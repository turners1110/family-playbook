import { readStore } from "@/lib/db/local-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Answer, AnswerPayload, AnswerVersion } from "@/lib/types/models";
import { saveAnswerSchema, type SaveAnswerInput } from "@/lib/validation/schemas";

type SupabaseFamilyMember = {
  id: string;
  family_id: string;
  user_id: string | null;
  display_name: string;
};

type SupabaseAnswerRow = {
  id: string;
  family_id: string;
  question_id: string;
  member_id: string | null;
  is_shared: boolean;
  payload: AnswerPayload;
  status: Answer["status"];
  confidence: Answer["confidence"];
  bookmarked: boolean;
  needs_research: boolean;
  review_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type StoredAnswerPayload = AnswerPayload & {
  _local_member_id?: string;
};

type SupabaseAnswerVersionRow = {
  id: string;
  answer_id: string;
  version: number;
  payload: AnswerPayload;
  status: Answer["status"];
  confidence: Answer["confidence"];
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
};

function mapAnswer(row: SupabaseAnswerRow): Answer {
  const payload = row.payload as StoredAnswerPayload;
  return {
    ...row,
    member_id: row.member_id ?? payload._local_member_id ?? null,
  };
}

function mapAnswerVersion(row: SupabaseAnswerVersionRow): AnswerVersion {
  return {
    ...row,
    changed_by: row.changed_by ?? "",
  };
}

async function resolveSupabaseFamily() {
  const store = await readStore();
  const currentLocalMember = store.members.find((m) => m.user_id === store.current_user_id);
  const displayNames = [...new Set(store.members.map((m) => m.display_name))];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("id,family_id,user_id,display_name")
    .in("display_name", displayNames);

  if (error) throw new Error(`Could not load Supabase family members: ${error.message}`);
  if (!data?.length) {
    const { data: existingFamily, error: familyFindError } = await supabase
      .from("families")
      .select("id")
      .eq("name", store.family.name)
      .maybeSingle();

    if (familyFindError) {
      throw new Error(`Could not load Supabase family: ${familyFindError.message}`);
    }

    const familyId = existingFamily?.id ?? (await insertSupabaseFamily(store.family.name));

    return {
      familyId,
      memberByLocalId: new Map<string, SupabaseFamilyMember>(),
      currentSupabaseUserId: null,
    };
  }

  const byFamily = new Map<string, SupabaseFamilyMember[]>();
  for (const member of data as SupabaseFamilyMember[]) {
    const list = byFamily.get(member.family_id) ?? [];
    list.push(member);
    byFamily.set(member.family_id, list);
  }

  const currentName = currentLocalMember?.display_name;
  const familyMembers =
    [...byFamily.values()].find(
      (members) =>
        (!currentName || members.some((m) => m.display_name === currentName)) &&
        displayNames.every((name) => members.some((m) => m.display_name === name)),
    ) ?? [...byFamily.values()][0];

  const memberByLocalId = new Map<string, SupabaseFamilyMember>();
  for (const localMember of store.members) {
    const supabaseMember = familyMembers.find(
      (member) => member.display_name === localMember.display_name,
    );
    if (supabaseMember) memberByLocalId.set(localMember.id, supabaseMember);
  }

  const currentSupabaseMember = currentLocalMember
    ? memberByLocalId.get(currentLocalMember.id)
    : undefined;

  return {
    familyId: familyMembers[0].family_id,
    memberByLocalId,
    currentSupabaseUserId: currentSupabaseMember?.user_id ?? null,
  };
}

async function insertSupabaseFamily(name: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("families")
    .insert({ name })
    .select("id")
    .single();

  if (error) throw new Error(`Could not create Supabase family: ${error.message}`);
  return data.id as string;
}

async function ensureSupabaseQuestion(questionId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: findError } = await supabase
    .from("questions")
    .select("id")
    .eq("id", questionId)
    .maybeSingle();

  if (findError) throw new Error(`Could not check Supabase question: ${findError.message}`);
  if (existing) return;

  const store = await readStore();
  const question = store.questions.find((item) => item.id === questionId);
  if (!question) throw new Error("Question not found in local store.");

  const { error } = await supabase.from("questions").insert({
    id: question.id,
    slug: question.slug,
    text: question.text,
    short_title: question.short_title,
    why_it_matters: question.why_it_matters,
    discussion_guidance: question.discussion_guidance,
    question_type: question.question_type,
    response_schema: question.response_schema,
    life_stages: question.life_stages,
    categories: question.categories,
    subcategories: question.subcategories,
    outcomes: question.outcomes,
    related_principles: question.related_principles,
    related_questions: question.related_questions,
    parent_decision_dependency: question.parent_decision_dependency,
    logical_order: question.logical_order,
    priority: question.priority,
    estimated_minutes: question.estimated_minutes,
    emotional_weight: question.emotional_weight,
    evidence_needed: question.evidence_needed,
    evidence_available: question.evidence_available,
    evidence_summary: question.evidence_summary,
    practical_tip: question.practical_tip,
    separate_answers_recommended: question.separate_answers_recommended,
    cooling_off_recommended: question.cooling_off_recommended,
    follow_up_prompts: question.follow_up_prompts,
    review_recommendation: question.review_recommendation,
    child_dependent: question.child_dependent,
    required_before_birth: question.required_before_birth,
    babymoon_priority: question.babymoon_priority,
    research_mode: question.research_mode,
    active: question.active,
  });

  if (error) throw new Error(`Could not mirror Supabase question: ${error.message}`);
}

export function shouldUseSupabaseAnswers() {
  // Phase 1 keeps product answer data on the local store.
  // Phase 3 will re-enable Supabase answers via the user-scoped client (not service role).
  return false;
}

export async function listSupabaseAnswersForQuestion(questionId: string): Promise<Answer[]> {
  const { familyId } = await resolveSupabaseFamily();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("answers")
    .select("*")
    .eq("family_id", familyId)
    .eq("question_id", questionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load Supabase answers: ${error.message}`);
  return ((data ?? []) as SupabaseAnswerRow[]).map(mapAnswer);
}

export async function listSupabaseAnswerVersionsForAnswers(
  answerIds: string[],
): Promise<AnswerVersion[]> {
  if (answerIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("answer_versions")
    .select("*")
    .in("answer_id", answerIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load Supabase answer history: ${error.message}`);
  return ((data ?? []) as SupabaseAnswerVersionRow[]).map(mapAnswerVersion);
}

export async function saveSupabaseAnswer(input: SaveAnswerInput): Promise<Answer> {
  const data = saveAnswerSchema.parse(input);
  const { familyId, memberByLocalId, currentSupabaseUserId } = await resolveSupabaseFamily();
  const supabase = createSupabaseAdminClient();
  const supabaseMember = data.member_id ? memberByLocalId.get(data.member_id) : undefined;
  const memberId = data.is_shared ? null : supabaseMember?.id;
  const payloadForStorage: StoredAnswerPayload =
    !data.is_shared && !memberId && data.member_id
      ? { ...data.payload, _local_member_id: data.member_id }
      : data.payload;

  await ensureSupabaseQuestion(data.question_id);

  const existingResponse =
    data.is_shared || memberId
      ? await supabase
          .from("answers")
          .select("*")
          .eq("family_id", familyId)
          .eq("question_id", data.question_id)
          .eq("is_shared", data.is_shared)
          .match(memberId ? { member_id: memberId } : {})
          .maybeSingle()
      : await supabase
          .from("answers")
          .select("*")
          .eq("family_id", familyId)
          .eq("question_id", data.question_id)
          .eq("is_shared", false);

  const existingData = Array.isArray(existingResponse.data)
    ? existingResponse.data.find(
        (row) => (row.payload as StoredAnswerPayload)._local_member_id === data.member_id,
      ) ?? null
    : existingResponse.data;

  const { error: findError } = existingResponse;
  if (findError) throw new Error(`Could not check Supabase answer: ${findError.message}`);

  if (existingData) {
    const existingAnswer = existingData as SupabaseAnswerRow;
    const nextVersion = existingAnswer.version + 1;
    const { data: updated, error: updateError } = await supabase
      .from("answers")
      .update({
        payload: payloadForStorage,
        status: data.status,
        confidence: data.confidence,
        needs_research: data.needs_research ?? existingAnswer.needs_research,
        review_date:
          data.review_date !== undefined ? data.review_date : existingAnswer.review_date,
        bookmarked: data.bookmarked ?? existingAnswer.bookmarked,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingAnswer.id)
      .select("*")
      .single();

    if (updateError) throw new Error(`Could not update Supabase answer: ${updateError.message}`);

    await insertAnswerVersion({
      answerId: existingAnswer.id,
      version: nextVersion,
      input: data,
      payload: payloadForStorage,
      changedBy: currentSupabaseUserId,
      defaultReason: "Updated answer",
    });

    return mapAnswer(updated as SupabaseAnswerRow);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("answers")
    .insert({
      family_id: familyId,
      question_id: data.question_id,
      member_id: memberId,
      is_shared: data.is_shared,
      payload: payloadForStorage,
      status: data.status,
      confidence: data.confidence,
      bookmarked: data.bookmarked ?? false,
      needs_research: data.needs_research ?? false,
      review_date: data.review_date ?? null,
      version: 1,
    })
    .select("*")
    .single();

  if (insertError) throw new Error(`Could not insert Supabase answer: ${insertError.message}`);

  const answer = inserted as SupabaseAnswerRow;
  await insertAnswerVersion({
    answerId: answer.id,
    version: 1,
    input: data,
    payload: payloadForStorage,
    changedBy: currentSupabaseUserId,
    defaultReason: "Initial answer",
  });

  return mapAnswer(answer);
}

async function insertAnswerVersion({
  answerId,
  version,
  input,
  payload,
  changedBy,
  defaultReason,
}: {
  answerId: string;
  version: number;
  input: SaveAnswerInput;
  payload: StoredAnswerPayload;
  changedBy: string | null;
  defaultReason: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("answer_versions").insert({
    answer_id: answerId,
    version,
    payload,
    status: input.status,
    confidence: input.confidence,
    changed_by: changedBy,
    change_reason: input.change_reason ?? defaultReason,
  });

  if (error) throw new Error(`Could not insert Supabase answer history: ${error.message}`);
}
