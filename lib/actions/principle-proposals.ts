"use server";

import { revalidatePath } from "next/cache";
import {
  acceptPrincipleProposal,
  deferPrincipleProposal,
  rejectPrincipleProposal,
  savePrincipleProposalEdit,
} from "@/lib/services/principle-proposals";

export async function actionAcceptPrincipleProposal(input: {
  topicSlug: string;
  statement?: string;
}) {
  const result = await acceptPrincipleProposal(input);
  revalidatePath("/decisions");
  revalidatePath("/home");
  return result;
}

export async function actionRejectPrincipleProposal(topicSlug: string) {
  await rejectPrincipleProposal(topicSlug);
  revalidatePath("/decisions");
}

export async function actionDeferPrincipleProposal(topicSlug: string) {
  await deferPrincipleProposal(topicSlug);
  revalidatePath("/decisions");
  revalidatePath("/home");
  revalidatePath("/questions/before-birth");
  revalidatePath("/conversations");
}

export async function actionSavePrincipleProposalEdit(
  topicSlug: string,
  statement: string,
) {
  await savePrincipleProposalEdit(topicSlug, statement);
  revalidatePath("/decisions");
}
