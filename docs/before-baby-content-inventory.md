# Before Baby content inventory

Factual snapshot of the **current template** for a later content-audit pass. This pass did not add or remove tasks.

Source: `lib/checklists/templates/before-baby.ts`, `lib/checklists/default-timing.ts`, `lib/checklists/ownership.ts`, `lib/checklists/dependencies.ts`.

Counted with `countTemplateTasks(BEFORE_BABY_TEMPLATE)` and `getDefaultTimingForTask(slug, section)`.

## Totals

| Metric | Count |
|---|---|
| Template tasks | **127** |
| Timing map entries (`BEFORE_BABY_TASK_TIMING`) | 169 (includes extras not on the current template) |
| Template slugs with an explicit timing row | 127 |
| Template dependency chains (`TEMPLATE_DEPENDENCIES`) | 10 |
| Ownership suggestion rows (`BEFORE_BABY_OWNERSHIP`) | 31 |

## By category (template section)

| Section | Tasks |
|---|---|
| hospital_birth | 18 |
| medical | 7 |
| home | 14 |
| baby_gear | 23 |
| paperwork | 9 |
| financial | 5 |
| relationship | 5 |
| pets | 4 |
| work_leave | 8 |
| postpartum_prep | 7 |
| legal_extra | 6 |
| lulu_extra | 6 |
| home_extra | 3 |
| final_week | 12 |

## By pregnancy timing window

Windows come from default timing (`timing_window_label`), not from a new scheduler.

| Window | Tasks |
|---|---|
| second_trimester | 3 |
| early_third_trimester | 21 |
| by_30_weeks | 9 |
| by_32_weeks | 13 |
| by_34_weeks | 23 |
| by_36_weeks | 29 |
| final_two_weeks | 16 |
| final_week | 12 |
| after_birth | 1 |

## By template priority

Template `section(..., priority)` default is medium unless overridden.

| Priority | Tasks |
|---|---|
| high | 67 |
| medium | 60 |
| low | 0 |
| critical | 0 |

## By owner default

Template tasks rarely set `owner`. Effective default below uses `BEFORE_BABY_OWNERSHIP.primary_owner` when present, otherwise template `owner`, otherwise **both**.

| Owner | Tasks |
|---|---|
| both | 107 |
| sam | 14 |
| michelle | 6 |
| unassigned | 0 |

## Flags

| Flag | Count |
|---|---|
| Hard deadline offset set | 1 |
| Provider confirmation (`confirm_with_provider`) | 25 |
| `timing_type === after_birth` | 1 |
| Tasks with a template dependency chain | 10 |

## Notes for the next (content) pass

- Do not treat the 169 timing-map keys as live checklist size; the live library is **127** template tasks.
- Most tasks default to owner **both** until the assign flow or suggestions are applied.
- This file is inventory only — no completeness judgment.
