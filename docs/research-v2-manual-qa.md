# Research & Knowledge V2 — Manual QA

Hard rule: never accept fabricated evidence. Every claim must resolve to a source.

## QA A — Processed book

1. Open Research library → a book source.
2. Verify processing status is honest (uploaded ≠ processed).
3. If chapters/findings exist, open them and confirm provenance.
4. Open a linked question if present; return.

## QA B — Evidence question

1. Open a CRITICAL/HIGH question (e.g. safe sleep / feeding).
2. Confirm compact Research & guidance panel:
   - empty → “Research would help here” (no fake takeaway)
   - with links → findings + evidence picture + sources
3. Answer jointly; open related Decision.
4. Confirm family position remains separate from evidence.

## QA C — Mixed evidence

1. When two linked findings disagree, verify “Evidence is mixed” / “Sources differ”.
2. Confirm disagreement is not collapsed into false consensus.

## QA D — No evidence (values)

1. Open a values question (traditions / childhood reflection).
2. Confirm no empty research chrome and no fake panel.

## QA E — Research gap / queue

1. Open `docs/research-v2-queue.json`.
2. Pick a CRITICAL/HIGH missing item.
3. From question panel, use Search library / Add source / queue CTA.

## QA F — Provider

1. From evidence panel / Decision, create a provider question manually if UI allows.
2. Verify backlink to question/Decision where supported.

## QA G — Task

1. Create suggested task from Decision/checklist UI (preview before save).
2. Confirm it does not auto-create.

## QA H — Expecting Better

1. If present in library, verify book → finding → question → Decision chain.
2. If only metadata: status must not claim “processed findings ready.”

## QA I — Relaunch

1. Hard refresh / logout-login.
2. Verify answers unchanged and research links persist.

## QA J — Privacy

1. Separate-first question with only one partner answered.
2. Confirm partner text absent from Decision evidence, research synthesis, search, exports.

## Release checklist

- [ ] Audit docs present
- [ ] No fake evidence on values questions
- [ ] Mixed evidence visible when linked
- [ ] Decision separates position vs evidence
- [ ] Prebirth buckets / Why now on Home
- [ ] Live answers/IDs unchanged
- [ ] Tests pass
