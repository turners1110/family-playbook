# Question Experience V2 — Final Report

**Branch:** `trip-online-mode`  
**Base HEAD before work:** `689ed9a`  
**Initiative:** High-Priority Question Experience V2 + Research Integration  

## CURRENT AUDIT (Phase 0)

Verified against current seed before upgrades (not blind trust of older Claude numbers):

| Claim | Verdict |
|---|---|
| 381/430 `joint_discussion` question_type | **TRUE** |
| Every `response_schema` = `{mode: open_or_policy}` | **TRUE** (pre-V2) |
| 398/430 `estimated_minutes = 8` | **TRUE** (pre-V2; now 276 remain at 8 outside/at edge of cohort) |
| Tiny evidence_summary / practical_tip | **TRUE** (2 summaries, 1 tip — still largely true; research linking is separate) |
| Discussion mode ~86/13/1 shared/separate/either | **TRUE** (discussion_mode ≠ response format) |

Critical gap confirmed: library `AnswerEditor` ignored structured schemas. Structured UI lived mainly in Essentials/Conversations.

Artifacts: `docs/question-experience-v2-audit.json`, `docs/question-experience-v2-audit.md`

### Response schema after V2 (seed)

| mode | count |
|---|---|
| open_or_policy (unchanged library) | 249 |
| open_discussion (cohort, intentional) | 120 |
| multi_select | 15 |
| separate_then_shared | 12 |
| matrix | 9 |
| policy_builder | 8 |
| single_choice | 8 |
| ranking | 5 |
| threshold | 2 |
| tradeoff | 1 |
| scenario | 1 |

**181** questions carry `response_schema.version = 2`.

### estimated_minutes after V2

Cohort average **~11 minutes**. Remaining `8` values are mostly non-cohort library questions (false uniformity reduced where curated).

## HIGH-PRIORITY COHORT

- **Total:** 181 (natural union > 150)
- **Why larger:** Essentials + Babymoon follow-ups + `essential_before_birth` + `required_before_birth` + high pre-birth + decision-topic seeds + evidence-relevant prompts, deduped by ID
- **Selection:** documented in `docs/high-priority-question-cohort.json` with rationale per question
- **Structured (non-open) in cohort:** 49 guided formats; many remain open_discussion where nuance beats fake options
- **Discussion modes:** unchanged (shared-first preserved; commit `3285c3d` behavior not undone)
- **Research-linked / Decision-linked:** per cohort file fields (no fabricated evidence)

Also: `docs/high-priority-question-duplicates.json`, `docs/high-priority-content-quality.json`

## BABYMOON

- Upgraded inline prompts: birth preferences → multi quick_pick; overnight plan → either_or with realistic options
- Round structure preserved (3 rounds)
- Variety: lightning / either-or / short text / coffee / structured picks
- Round time still based on prompt `estimated_time_seconds`

## ESSENTIALS

- 33 primary screens unchanged in count / shared-first philosophy
- Session planner now packs by cumulative minutes (`lib/essentials/session-plan.ts`) for 15/30/60
- Linked library questions receive Essentials options/matrix/policy into V2 schemas

## RESEARCH

- Compact `ResearchGuidancePanel` on question pages
- Empty state: “Research would help here” / search / add — **no fake synthesis**
- Distinct copy: what evidence says vs what family decides
- Uses existing `getResearchForQuestion` / source links (no second linking system)

## DATA SAFETY

Remote metadata sync (`scripts/sync-question-experience-v2-remote.ts`):

| Check | Result |
|---|---|
| Live questions updated | 181 (+ follow-up 11 + 3 for ensure-options clash) |
| Answers before/after | 35 / 35 unchanged |
| Answer versions | unchanged |
| Decisions | unchanged |
| Question IDs changed | **0** |
| Second sync changes | **0** (after stable compare + ensure-options fix) |

`lib/conversations/ensure-options.ts` no longer overwrites V2 schemas on read (was breaking idempotency for traits/allowance).

## PRIVACY

- `filterAnswersForClient` already redacts ranking/matrix/choice/text for partner answers
- Regression test added in `tests/unit/question-experience-v2.test.ts`
- Shared-first still default; separate editors only when mode/UI requires

## FILES (major)

- `lib/questions/response-schema.ts`, `answer-display.ts`, `session-pack.ts`
- `lib/essentials/session-plan.ts`
- `lib/conversations/babymoon-set.ts`, `ensure-options.ts`
- `lib/knowledge/family-decisions.ts`, `lib/services/previously-answered.ts`, `lib/services/sessions.ts`
- `components/questions/AnswerEditor.tsx`, `StructuredAnswerFields.tsx`, `ResearchGuidancePanel.tsx`
- `app/questions/[slug]/page.tsx`, `app/home/page.tsx`, `app/questions/before-birth/session/page.tsx`
- `data/seed/questions.json` (metadata only)
- Scripts: `apply-question-experience-v2.ts`, `sync-question-experience-v2-remote.ts`
- Docs under `docs/question-experience-v2-*`, cohort/duplicates/quality/manual QA
- Tests: `tests/unit/question-experience-v2.test.ts`

## TESTS

- Full unit suite: **389 passed** / 38 files
- New coverage: formatting, packing, privacy redaction, AnswerEditor remount key
- Manual QA: `docs/question-experience-v2-manual-qa.md` (remaining human checks A–H)

## PERFORMANCE

- Research panel uses existing question research query (no N+1 added beyond prior page load)
- Schema parse is local/cheap
- Graph/Decision position formatting is string-level only

## KNOWN LIMITATIONS

- Evidence summaries / practical tips still sparsely populated (intentionally — no fabricated content)
- Full evidence relationship model (supports/contradicts tiers) not fully persisted as new DB fields; UI uses existing link types + ratings
- Provider-question / task auto-suggest flow not fully productized (manual create remains)
- ~120 cohort questions correctly remain open discussion
- Non-cohort 249 still `open_or_policy` until a later pass
- History diffs are human-readable snapshots, not field-level “A → B” patch UI yet

## NEXT RECOMMENDED PASS

1. Curate practical tips + real research links for weakest completeness scores
2. Field-level structured history diffs
3. Decision hub evidence aggregation counts (supports/contradicts/context)
4. Provider question + task preview CTAs after structured save
5. Expand structured formats only where options are real (not quotas)

## RELEASE GATES

- [x] Audit + cohort docs
- [x] Converted questions have rationale
- [x] Live metadata sync idempotent; answers/IDs untouched
- [x] Structured formatting in review/Decision position
- [x] Research panel without fake evidence
- [x] Privacy regression for structured payloads
- [x] Babymoon / Essentials variety + time packing
- [x] Automated tests pass
- [x] Typecheck clean for changed surfaces
- [ ] Manual QA A–H (operator)
