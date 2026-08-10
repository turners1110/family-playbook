# Research & Knowledge V2 — Final Report

**Branch:** `trip-online-mode`  
**Starting HEAD:** `c7a9b20`  
**Invariant:** No fabricated evidence. Source-derived ≠ family decision ≠ practical suggestion.

## CURRENT AUDIT

Verified:

| Metric | Count |
|---|---|
| Total questions | 430 |
| High-priority cohort | 181 |
| Essential/required before birth | 129 |
| evidence_summary populated | 2 |
| practical_tip populated | 1 |
| evidence_needed | 5 |
| evidence_available | 2 |

Live Turner store (read during work): answers **35**, answer_versions **37**, decisions **2**. Unchanged by this pass (no answer mutations).

### Research library books

| Title | Status | Findings | DRM | Question links |
|---|---|---|---|---|
| Expecting Better | `awaiting_source_text` / partial | 0 | **true** | 0 |
| expecting better | `metadata_only` | 0 | false | 0 |

**Uploaded ≠ processed.** Expecting Better cannot yield grounded chapter findings until readable non-DRM text is available. No fake Oster findings were invented.

Artifacts:

- `docs/research-v2-audit.json` / `.md`
- `docs/research-v2-books-audit.json`
- `docs/research-v2-queue.json` (119 CRITICAL/HIGH gaps)
- `docs/prebirth-priority-v2.json`

## 181-QUESTION COHORT — RESEARCH VALUE

| Class | Count |
|---|---|
| CRITICAL | 7 |
| HIGH | 112 |
| MODERATE | 39 |
| LOW | 5 |
| NONE | 18 |

Evidence gap (cohort): missing 156 · partial 2 · unnecessary 23  
Critical/high still missing grounded evidence: **117** (queue tracks these).

## WHAT SHIPPED

### Evidence model + synthesis
- `lib/research/evidence-model.ts` — relationship, strength, source quality, evidence picture
- `lib/research/ground-findings.ts` — maps existing links → grounded findings (no invention)
- `lib/research/synthesis.ts` — provenance-retaining synthesis; empty → insufficient
- Mixed sources stay mixed (no false consensus)
- Family/evidence mismatch detection never rewrites answers

### Question UI
- Upgraded `ResearchGuidancePanel`: findings count, evidence picture, takeaway from sources only, disagreement block, empty-state rules (hide on NONE/LOW values questions)

### Decision UI
- `DecisionEvidencePanel` + `buildDecisionEvidence`
- Separates **Our current position** vs **What evidence says**
- Decision health components explained (discussion / shared / evidence / provider / tasks)

### Priority / Home
- Pre-birth buckets: must / worth / good if time / later
- Home “Why now?” on next discussion
- Research value classifier + gaps queue

### Privacy
- `lib/research/privacy.ts` + tests: hidden partner text excluded from research context

### Books honesty
- Audit documents DRM / awaiting text for Expecting Better
- Processing status stages already exist in EPUB runner; UI must not claim ready when findings=0

## PRE-BIRTH PRIORITY

| Bucket | Count (of 129 essential/required) |
|---|---|
| Must decide before birth | 37 |
| Worth discussing before birth | 82 |
| Later | 10 |

Top recommended now (see JSON for full list): safe sleep/swaddling, vaccines/follow-ups, pediatric illness, birth attendance, pediatrician call signs, birth preferences, visitor postpartum calm, etc.

## LIVE DATA SAFETY

| Check | Result |
|---|---|
| Answer count mutated | **No** (35) |
| Question IDs changed | **No** |
| Decision IDs changed | **No** |
| Fake evidence written into seed | **No** |
| Metadata sync needed this pass | **No** (architecture + classification only) |

## PRIVACY

Regression tests in `tests/unit/research-v2.test.ts` pass.

## PERFORMANCE

- Synthesis is in-memory over already-fetched question links
- Decision aggregation capped at 20 linked questions
- No new always-on model calls

## TESTS

- Full suite: **397** passed
- New: `tests/unit/research-v2.test.ts` (8)
- Lint: pre-existing warnings only
- Typecheck + build: pass

## MANUAL QA REMAINING

See `docs/research-v2-manual-qa.md` (A–J).

## KNOWN LIMITATIONS / NEXT PASS

1. **Pass A blocked on DRM:** Expecting Better needs non-DRM extractable text before chapter findings
2. Wire preliminary findings table into `getResearchForQuestion` when available
3. Link review queue UI for low-confidence auto-links
4. Public-source acquisition queue (AAP/CDC/etc.) — interface ready, no scraping invented
5. Deduped finding store + synthesis cache fingerprints
6. Content Review export Decision packages with evidence sections
7. Manual link correction UI (approve/reject)

## FILES

- `lib/research/evidence-model.ts`, `synthesis.ts`, `ground-findings.ts`, `research-value.ts`, `gaps.ts`, `prebirth-priority.ts`, `privacy.ts`
- `lib/knowledge/decision-evidence.ts`
- `components/questions/ResearchGuidancePanel.tsx`
- `components/decisions/DecisionEvidencePanel.tsx`
- `app/questions/[slug]/page.tsx`, `app/decisions/[id]/page.tsx`, `app/home/page.tsx`
- Scripts: `research-v2-audit.ts`, `audit-research-books.ts`, `generate-prebirth-priority-v2.ts`
- Docs under `docs/research-v2-*`, `docs/prebirth-priority-v2.json`

## PRODUCT TEST STATUS

Sam & Michelle can now see, on important questions:

1. What we’re deciding (existing)
2. What linked evidence says — **only if grounded**
3. Evidence picture (Strong/Moderate/Limited/Mixed/Insufficient)
4. Disagreement when sources conflict
5. Family position kept separate on Decision hubs
6. Why now on Home
7. Honest book processing (Expecting Better: awaiting text / DRM)

They will **not** yet see rich book findings until extractable source text exists — by design.
