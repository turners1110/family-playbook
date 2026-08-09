# Question Experience V2 — Manual QA

Use the Turner Family live environment (or a copy). Do not fabricate research.

## TEST A — Ranking

1. Open a shared-first ranking question (e.g. traits / birth preferences).
2. Rank options; add a note; save.
3. Review the Family decision block — numbered list, not JSON.
4. Edit order; save again.
5. Relaunch the page — ranking and notes restore.
6. Confirm history shows a new version.

## TEST B — Matrix

1. Complete an overnight / household responsibilities matrix.
2. Save shared answer.
3. Open the related Decision hub.
4. Verify human-readable `Row: Owner` lines in Current position.
5. Confirm raw matrix data still exists in the answer payload (history/debug).

## TEST C — Policy Builder

1. Build a visitor policy (fields filled).
2. Save.
3. Create a follow-up task manually from the UI (preview before save).
4. Verify task links back to the topic / Decision.

## TEST D — Research

1. Open an evidence-linked high-priority question.
2. Confirm Research & guidance shows source count (no fake synthesis if empty).
3. Open a source; return.
4. Save a family decision.
5. Confirm evidence stays visually separate from “what we decided.”

## TEST E — Separate First

1. Open childhood reflection (separate-first).
2. Answer as Sam.
3. Verify Michelle’s answer is unavailable in HTML / network payload.
4. Answer as Michelle; reveal; merge to shared if prompted.

## TEST F — Babymoon

1. Start a 30-minute Conversations / Babymoon path.
2. Verify response variety (quick pick / either-or / short text / deeper prompts).
3. Confirm estimated session duration feels sensible (“About N minutes”).
4. Pause/resume; complete; review answers.

## TEST G — Essentials

1. Open three planning screens with structured controls.
2. Verify shared-first default (except childhood reflection).
3. Verify Decision / context links where present.
4. Start a 15-minute Essentials session — screens packed by time, not fixed count.

## TEST H — Old Answer Compatibility

1. Open a question that had open text and now has a guided format.
2. Verify “Previous response” banner and preserved text.
3. Complete guided version.
4. Verify prior version remains in history.

## Release checklist

- [ ] Ranking / matrix / policy save-load-edit
- [ ] Human-readable Decision display
- [ ] Research panel empty-state (no fake evidence)
- [ ] Partner redaction on separate-first
- [ ] Babymoon variety + sensible duration
- [ ] Essentials time packing
- [ ] Metadata sync idempotent; answers/IDs unchanged
