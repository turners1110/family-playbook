/**
 * Resolve shared question context for Conversations / library / Essentials.
 */
import type { ConversationPromptDef } from "@/lib/conversations/response-types";
import type { EssentialsScreenDef } from "@/lib/essentials/pathway";
import {
  getEssentialsScreenByQuestionId,
  listPrimaryScreens,
} from "@/lib/essentials/pathway";
import {
  getEssentialsScreenEnrichment,
  resolveEssentialsWorkshopContext,
  type Score1to5,
} from "@/lib/essentials/screen-context";
import {
  softRec,
  specificOrNull,
  type PreviouslyAnsweredMeta,
  type SharedQuestionContext,
  type SoftRecommendation,
} from "@/lib/content/question-context";
import { questionIdsRelated } from "@/lib/conversations/deep-link";
import type { Question } from "@/lib/types/models";

function priorityToImportance(
  priority: Question["priority"] | undefined,
): Score1to5 | null {
  switch (priority) {
    case "essential_before_birth":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "future":
      return 1;
    default:
      return null;
  }
}

function enrichmentForQuestionId(questionId: string | null | undefined) {
  if (!questionId) return null;
  const screen = getEssentialsScreenByQuestionId(questionId);
  if (!screen) return null;
  return {
    screen,
    enrichment: getEssentialsScreenEnrichment(screen.id),
  };
}

export function sharedContextFromEssentials(
  screen: EssentialsScreenDef,
  question?: Question | null,
  extras?: {
    previouslyAnswered?: PreviouslyAnsweredMeta | null;
    recommendations?: SoftRecommendation[];
    whySeeingThis?: string | null;
  },
): SharedQuestionContext {
  const workshop = resolveEssentialsWorkshopContext(screen, question);
  const recommendations = [...(extras?.recommendations ?? [])];

  if (workshop.importance != null && workshop.importance >= 4) {
    recommendations.push(
      softRec(
        "high_impact",
        "This ranks high for long-term family outcomes in the Essentials pathway.",
      ),
    );
  }
  if (workshop.dependsOn.length > 0) {
    const titles = workshop.dependsOn
      .map((id) => listPrimaryScreens().find((s) => s.id === id)?.title ?? id)
      .filter(Boolean);
    recommendations.push(
      softRec(
        "best_after",
        `Usually clearer after: ${titles.join("; ")}. You can still answer now.`,
        titles[0] ? `Best answered after ${titles[0]}` : undefined,
      ),
    );
  }
  if (extras?.previouslyAnswered) {
    recommendations.push(
      softRec(
        "previously_answered",
        extras.previouslyAnswered.fullyAnswered
          ? "You already have a saved answer in your playbook."
          : "You have a partial answer on file — update or keep going.",
      ),
    );
  }

  return {
    purpose: specificOrNull(workshop.purpose),
    explanation: specificOrNull(workshop.explanation),
    howTo: specificOrNull(workshop.howTo),
    examples: workshop.examples.length ? workshop.examples : undefined,
    prompts: workshop.prompts.length ? workshop.prompts : undefined,
    relatedResearch: specificOrNull(workshop.relatedResearch),
    importance: workshop.importance,
    relevanceNow: workshop.relevanceNow,
    difficulty: workshop.difficulty,
    estimatedMinutes: workshop.estimatedMinutes,
    previouslyAnswered: extras?.previouslyAnswered ?? null,
    recommendations,
    whySeeingThis:
      extras?.whySeeingThis ??
      recommendations[0]?.reason ??
      null,
  };
}

export function sharedContextFromLibraryQuestion(
  question: Question,
  extras?: {
    previouslyAnswered?: PreviouslyAnsweredMeta | null;
    recommendations?: SoftRecommendation[];
    whySeeingThis?: string | null;
  },
): SharedQuestionContext {
  const hit = enrichmentForQuestionId(question.id);
  if (hit?.enrichment) {
    return sharedContextFromEssentials(hit.screen, question, extras);
  }

  // Library seed text is mostly generic — only surface non-filler fields.
  const why = specificOrNull(question.why_it_matters);
  const howTo = specificOrNull(question.discussion_guidance);
  const prompts = (question.follow_up_prompts ?? []).filter((p) =>
    specificOrNull(p),
  );
  const research = specificOrNull(question.evidence_summary);
  const tip = specificOrNull(question.practical_tip);
  const recommendations = [...(extras?.recommendations ?? [])];

  if (
    question.priority === "essential_before_birth" ||
    question.priority === "high"
  ) {
    recommendations.push(
      softRec(
        "high_impact",
        "Marked high priority in the question library.",
      ),
    );
  }
  if (question.babymoon_priority) {
    recommendations.push(
      softRec(
        "stage_relevant",
        "Flagged as useful to discuss before or around birth.",
      ),
    );
  }
  if (extras?.previouslyAnswered) {
    recommendations.push(
      softRec(
        "previously_answered",
        extras.previouslyAnswered.fullyAnswered
          ? "You already answered this in your playbook."
          : "You have started this answer before.",
      ),
    );
  }

  return {
    purpose: why,
    explanation: null,
    howTo,
    examples: undefined,
    prompts: prompts.length ? prompts : undefined,
    relatedResearch: research ?? tip,
    importance: priorityToImportance(question.priority),
    relevanceNow: question.babymoon_priority ? 4 : null,
    difficulty: null,
    estimatedMinutes: question.estimated_minutes || null,
    previouslyAnswered: extras?.previouslyAnswered ?? null,
    recommendations,
    whySeeingThis:
      extras?.whySeeingThis ?? recommendations[0]?.reason ?? null,
  };
}

export function sharedContextFromConversationPrompt(
  prompt: ConversationPromptDef,
  input?: {
    linkedQuestion?: Question | null;
    previouslyAnswered?: PreviouslyAnsweredMeta | null;
    /** Earlier answered deep question ids in this family. */
    answeredDeepIds?: string[];
    sessionMode?: string | null;
    babymoonRound?: number | null;
  },
): SharedQuestionContext {
  const linked = input?.linkedQuestion ?? null;
  const followUp = prompt.follow_up_open_question_id;
  const essentialsHit = enrichmentForQuestionId(followUp ?? linked?.id);

  const minutes =
    prompt.suggested_discussion_minutes ??
    Math.max(1, Math.round(prompt.estimated_time_seconds / 60));

  const recommendations: SoftRecommendation[] = [];
  const whyParts: string[] = [];

  if (input?.babymoonRound) {
    whyParts.push(
      `Part of Babymoon Set round ${input.babymoonRound} — a curated path, not a random draw.`,
    );
    recommendations.push(
      softRec(
        "recommended_first",
        `Included in Babymoon round ${input.babymoonRound}.`,
      ),
    );
  } else if (input?.sessionMode) {
    whyParts.push(
      `Selected for your ${input.sessionMode.replaceAll("_", " ")} conversation mix.`,
    );
  }

  if (essentialsHit?.enrichment && essentialsHit.enrichment.importance >= 4) {
    recommendations.push(
      softRec(
        "high_impact",
        "Linked Essentials topic ranks high for long-term outcomes.",
      ),
    );
  }

  if (essentialsHit?.enrichment?.depends_on?.length) {
    const depId = essentialsHit.enrichment.depends_on[0]!;
    const depTitle =
      listPrimaryScreens().find((s) => s.id === depId)?.title ?? depId;
    recommendations.push(
      softRec(
        "best_after",
        `Often clearer after “${depTitle}.” Optional — answer anytime.`,
        `Best answered after ${depTitle}`,
      ),
    );
  }

  if (followUp && input?.answeredDeepIds?.length) {
    const relatedAnswered = input.answeredDeepIds.find((id) =>
      questionIdsRelated(id, followUp),
    );
    if (relatedAnswered) {
      recommendations.push(
        softRec(
          "previously_answered",
          "You already have a library answer linked to this prompt.",
        ),
      );
    } else {
      // Soft related: if user answered another essentials in same module
      const screen = essentialsHit?.screen;
      if (screen) {
        const siblingAnswered = listPrimaryScreens().find(
          (s) =>
            s.module_id === screen.module_id &&
            s.id !== screen.id &&
            input.answeredDeepIds!.some((id) =>
              questionIdsRelated(id, s.question_id),
            ),
        );
        if (siblingAnswered) {
          recommendations.push(
            softRec(
              "related",
              `Related to “${siblingAnswered.title},” which you have already discussed.`,
            ),
          );
          whyParts.push(
            `Suggested because you already discussed “${siblingAnswered.title}.”`,
          );
        }
      }
    }
  }

  if (input?.previouslyAnswered) {
    recommendations.push(
      softRec(
        "previously_answered",
        input.previouslyAnswered.fullyAnswered
          ? "Keep your previous answer or update it below."
          : "A partial answer is already on file.",
      ),
    );
  }

  if (linked?.babymoon_priority || prompt.session_tags.includes("babymoon")) {
    recommendations.push(
      softRec(
        "stage_relevant",
        "Timed for pregnancy / early parenthood conversations.",
      ),
    );
  }

  const base = essentialsHit
    ? sharedContextFromEssentials(essentialsHit.screen, linked, {
        previouslyAnswered: input?.previouslyAnswered,
        recommendations: [],
      })
    : linked
      ? sharedContextFromLibraryQuestion(linked, {
          previouslyAnswered: input?.previouslyAnswered,
          recommendations: [],
        })
      : {
          purpose: null,
          explanation: null,
          howTo: null,
          examples: undefined,
          prompts: undefined,
          relatedResearch: null,
          importance: null,
          relevanceNow: null,
          difficulty:
            prompt.conversation_energy === "big_conversation"
              ? (4 as Score1to5)
              : prompt.conversation_energy === "planning"
                ? (3 as Score1to5)
                : prompt.conversation_energy === "coffee"
                  ? (2 as Score1to5)
                  : (1 as Score1to5),
          estimatedMinutes: minutes,
          previouslyAnswered: input?.previouslyAnswered ?? null,
          recommendations: [],
          whySeeingThis: null,
        };

  // Conversation minutes win when present (card-sized discussion).
  const merged: SharedQuestionContext = {
    ...base,
    estimatedMinutes: minutes || base.estimatedMinutes,
    previouslyAnswered:
      input?.previouslyAnswered ?? base.previouslyAnswered ?? null,
    recommendations: [...(base.recommendations ?? []), ...recommendations],
    whySeeingThis:
      whyParts[0] ??
      recommendations[0]?.reason ??
      base.whySeeingThis ??
      null,
  };

  // Deduplicate recommendation kinds (keep first reason).
  const seen = new Set<string>();
  merged.recommendations = (merged.recommendations ?? []).filter((r) => {
    const key = `${r.kind}:${r.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return merged;
}
