import type { ChecklistOwner } from "@/lib/types/models";

export type OwnershipSuggestion = {
  primary_owner: ChecklistOwner;
  contributor: ChecklistOwner | null;
  joint_approval_required: boolean;
  reason: string;
};

/**
 * Suggested ownership for Before Baby template task slugs.
 * Defaults remain editable; apply only when current owner is still "both".
 */
export const BEFORE_BABY_OWNERSHIP: Record<string, OwnershipSuggestion> = {
  hospital_birth_1: {
    primary_owner: "michelle",
    contributor: "sam",
    joint_approval_required: true,
    reason: "Hospital choice usually needs joint approval with Michelle leading logistics.",
  },
  hospital_birth_2: {
    primary_owner: "michelle",
    contributor: "sam",
    joint_approval_required: false,
    reason: "Registration paperwork is typically led by Michelle.",
  },
  hospital_birth_5: {
    primary_owner: "sam",
    contributor: "michelle",
    joint_approval_required: false,
    reason: "Car seat install/verification is a practical Sam-led task.",
  },
  hospital_birth_6: {
    primary_owner: "sam",
    contributor: "michelle",
    joint_approval_required: false,
    reason: "Car seat inspection scheduling fits Sam as contributor owner.",
  },
  hospital_birth_7: {
    primary_owner: "michelle",
    contributor: "sam",
    joint_approval_required: false,
    reason: "Michelle’s hospital bag packing.",
  },
  hospital_birth_8: {
    primary_owner: "sam",
    contributor: "michelle",
    joint_approval_required: false,
    reason: "Sam’s hospital bag packing.",
  },
  hospital_birth_13: {
    primary_owner: "sam",
    contributor: "michelle",
    joint_approval_required: false,
    reason: "Route/transportation planning.",
  },
  hospital_birth_14: {
    primary_owner: "both",
    contributor: null,
    joint_approval_required: true,
    reason: "Birth preferences need joint approval.",
  },
  medical_1: {
    primary_owner: "both",
    contributor: null,
    joint_approval_required: true,
    reason: "Pediatrician choice needs joint approval.",
  },
  paperwork_1: {
    primary_owner: "michelle",
    contributor: "sam",
    joint_approval_required: false,
    reason: "Michelle leave paperwork.",
  },
  paperwork_2: {
    primary_owner: "sam",
    contributor: "michelle",
    joint_approval_required: false,
    reason: "Sam leave paperwork.",
  },
  paperwork_3: {
    primary_owner: "both",
    contributor: null,
    joint_approval_required: false,
    reason: "Insurance enrollment after birth — either parent can own.",
  },
  financial_3: {
    primary_owner: "both",
    contributor: null,
    joint_approval_required: true,
    reason: "Guardian choice requires joint approval.",
  },
  financial_4: {
    primary_owner: "both",
    contributor: null,
    joint_approval_required: true,
    reason: "Will updates require joint approval.",
  },
  pets_1: {
    primary_owner: "sam",
    contributor: "michelle",
    joint_approval_required: false,
    reason: "Lulu labor-care plan led by Sam.",
  },
  pets_2: {
    primary_owner: "sam",
    contributor: "michelle",
    joint_approval_required: false,
    reason: "Stroller practice with Lulu.",
  },
  relationship_4: {
    primary_owner: "both",
    contributor: null,
    joint_approval_required: true,
    reason: "Pre-birth date is a shared relationship task.",
  },
  final_week_1: {
    primary_owner: "sam",
    contributor: "michelle",
    joint_approval_required: false,
    reason: "Fuel/car readiness.",
  },
};

export function ownershipForSlug(slug: string | null | undefined): OwnershipSuggestion | null {
  if (!slug) return null;
  return BEFORE_BABY_OWNERSHIP[slug] ?? null;
}
