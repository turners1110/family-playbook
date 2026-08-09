# Question Experience V2 — Current-State Audit

**Branch:** `trip-online-mode`  
**HEAD:** `689ed9a04f734b2bf22cde8d3d18192ee6e45529`  
**Source of truth for this audit:** `data/seed/questions.json` + current Essentials/Babymoon/research code  
**Generated:** from live repo state after `git pull` (2026-08-09)

Machine-readable twin: [`question-experience-v2-audit.json`](./question-experience-v2-audit.json)

---

## Totals

| Surface | Count |
|---|---|
| Library questions (seed) | **430** |
| Before Birth Essentials primary screens | **33** |
| Essentials-linked pathway question IDs | **38** |
| Conversation prompts (quick + babymoon inline) | ~active bank |
| Unique conversation → deep follow-up IDs | **20** |
| Essentials workshop enrichments | **33/33** |
| Library workshop enrichments (non-Essentials) | **~22** curated IDs |

---

## Distributions (seed library)

### `question_type`

| Type | Count |
|---|---|
| `joint_discussion` | **381** |
| `values_clarification` | 21 |
| `practical_planning` | 18 |
| `ranking` | 2 |
| `reflection` | 2 |
| `tradeoff` | 2 |
| `scale` | 2 |
| `yes_or_no` | 2 |

### `response_schema.mode`

| Mode | Count |
|---|---|
| `open_or_policy` | **430 (100%)** |

### `discussion_mode` (shared-first model — post 3285c3d)

| Mode | Count | % |
|---|---|---|
| `shared_first` | **369** | 85.8% |
| `separate_first` | **56** | 13.0% |
| `either` | **5** | 1.2% |

Matches the target philosophy (~86 / ~13 / ~1).

### `priority`

| Priority | Count |
|---|---|
| `high` | 177 |
| `essential_before_birth` | 121 |
| `medium` | 108 |
| `low` | 12 |
| `future` | 12 |

### `estimated_minutes`

| Minutes | Count |
|---|---|
| **8** | **398** |
| other | 32 |

### Content flags

| Flag | Count |
|---|---|
| Non-empty `evidence_summary` | **2** |
| Non-empty `practical_tip` | **1** |
| `evidence_needed === true` | (see JSON) |
| `babymoon_priority` | 305 |
| `required_before_birth` | 113 |
| Generic seed `why_it_matters` marker | vast majority (same generator default) |

### Essentials screen `response_type` (already richer)

| Type | Screens |
|---|---|
| `multi_select` | 14 |
| `policy_builder` | 6 |
| `open_with_prompts` | 5 |
| `single_choice` | 3 |
| `paired_text` | 2 |
| `responsibility_matrix` | 2 |
| `scenario_plan` | 1 |

Declared but unused in pathway: `ranking`, `scale`, `named_people`, `separate_then_shared`.

---

## Critical product gap

**Library `AnswerEditor` ignores `question_type` / `response_schema`.**  
All 430 library questions render as open textareas (+ notes/status/confidence), regardless of type labels like `ranking` or `scale`.

Structured experience today exists mainly in:

1. **Essentials** (`EssentialsScreen` — multi-select, matrix, policy, etc.)
2. **Conversations** (`ConversationCard` — quick_pick, scale, short_text, etc.)

Research is linked via `getResearchForQuestion` on the question detail page, but seed-side evidence fields are almost empty, so most questions show an empty research section.

---

## Claude claim verification

| Claim | Verdict | Current observation |
|---|---|---|
| 381/430 are generic `joint_discussion` | **TRUE for `question_type`** | 381 have `question_type: joint_discussion`. **STALE if interpreted as discussion_mode** — discussion_mode is shared_first/separate_first/either (369/56/5). |
| Every `response_schema` is `{mode: open_or_policy}` | **TRUE** | 430/430 |
| 398/430 have `estimated_minutes = 8` | **TRUE** | 398 |
| Tiny `evidence_summary` / `practical_tip` | **TRUE** | 2 summaries, 1 tip |
| Research/Books weakly connected to Questions | **MOSTLY TRUE** | Link infrastructure exists (`ResearchSourceLink.question_id`); seed evidence fields empty; no rich inline synthesis panel |
| Multiple overlapping entry surfaces | **TRUE** | Questions / Conversations / Essentials / Decisions still parallel |
| Pre-birth stronger than post-birth | **TRUE** | Essentials + Babymoon + workshop context concentrated pre-birth |

---

## Implications for V2

1. Do **not** rewrite all 430 prompts. Curate a high-priority cohort and give it real `response_schema` + AnswerEditor renderers.
2. Reuse Essentials/Conversation control patterns; wire them into the library AnswerEditor.
3. Keep shared-first defaults; structured ≠ separate.
4. Realistic `estimated_minutes` only for the cohort (and Babymoon planning).
5. Research panel must use existing link services — no second linking system; no fabricated evidence.
6. Remote sync must cover response_schema + estimated_minutes + practical tips (metadata only), idempotent, answers untouched.

---

## Next artifacts

- `docs/high-priority-question-cohort.json` — curated V2 cohort with proposed formats
- Implementation: schema taxonomy, AnswerEditor structured modes, research panel, sync script, tests
