import {
  registerChecklistTemplate,
  type ChecklistTemplateDef,
} from "@/lib/checklists/types";

function section(
  slug: string,
  label: string,
  sort_order: number,
  titles: string[],
  priority: "high" | "medium" | "low" = "medium",
): ChecklistTemplateDef["sections"][number] {
  return {
    slug,
    label,
    sort_order,
    tasks: titles.map((title, index) => ({
      slug: `${slug}_${index + 1}`,
      title,
      priority,
    })),
  };
}

/** First Month / After Birth planning checklist (not a medical tracker). */
export const AFTER_BIRTH_TEMPLATE: ChecklistTemplateDef = {
  slug: "after-birth",
  title: "First Month",
  description:
    "Planning reminders for the first six weeks after birth — paperwork, support, and family check-ins. Confirm medical items with your provider.",
  sections: [
    section(
      "first_72h",
      "First 72 hours",
      1,
      [
        "Confirm baby added to hospital records",
        "Confirm birth certificate paperwork started",
        "Confirm Social Security process started",
        "Contact pediatrician",
        "Confirm first pediatrician visit",
        "Review feeding questions for pediatrician",
        "Review postpartum medications",
        "Confirm safe sleep setup at home",
        "Confirm Lulu introduction plan",
        "Confirm meal and household support",
      ],
      "high",
    ),
    section(
      "first_week",
      "First week",
      2,
      [
        "Add baby to health insurance",
        "Attend first pediatrician visit",
        "Review feeding plan",
        "Review overnight roles",
        "Review visitor boundaries",
        "Check postpartum recovery supplies",
        "Review urgent contact instructions",
        "Review household task division",
        "Check Lulu stress and behavior",
      ],
      "high",
    ),
    section(
      "week_two",
      "Week two",
      3,
      [
        "Parent stress check-in",
        "Review feeding workload",
        "Review sleep workload",
        "Review visitor plan",
        "Review meal and laundry support",
        "Review pediatrician follow-up needs",
        "Review postpartum emotional health support",
        "Review partner resentment or overload",
      ],
    ),
    section(
      "weeks_3_4",
      "Weeks three and four",
      4,
      [
        "Review return-to-work plan",
        "Review childcare timing",
        "Review family budget",
        "Open 529 if chosen and required information exists",
        "Update beneficiaries if needed",
        "Review date and connection plan",
        "Review recurring household duties",
        "Review Lulu and baby boundaries",
      ],
    ),
    section(
      "six_week",
      "Six-week review",
      5,
      [
        "Family systems review",
        "Parent partnership review",
        "Feeding and sleep review",
        "Childcare and work review",
        "Budget review",
        "Support-network review",
        "Update Before Baby plan into First Year plan",
      ],
      "high",
    ),
  ],
};

registerChecklistTemplate(AFTER_BIRTH_TEMPLATE);
