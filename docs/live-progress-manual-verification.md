# Live progress manual verification

Branch: `trip-online-mode`  
Prereq: `USE_REMOTE_JSON_STORE=true` in `.env.local` (and Preview/Production).

## Baseline

1. Open `/settings/storage-debug`.
2. Confirm storage mode is `remote` and backup is not LOCAL ONLY.
3. Record the five Home metrics from `/home` and Storage Debug Compare counts:

| Metric | Home | Storage Debug |
|--------|------|---------------|
| Deep discussions | | |
| Conversation prompts | | |
| Essentials X of 33 | | |
| Shared decisions | | |
| Open follow-ups | | |

Expected: both columns match. Compare counts shows **Counts match**.

## Babymoon session

1. Open `/conversations`.
2. Confirm `csess_9ouyjygd59hk` (or its Resume card) shows saved progress if still the progress session.
3. Start Round 1 should **Continue** an unfinished session with progress — not hide the completed one.
4. Open the completed Babymoon session from history and confirm cards still show answers.

## Quick-to-deep (prefer QA Test Lab)

1. Record the five metrics.
2. Start or resume a conversation / QA session.
3. Answer one Quick Pick → Conversation prompts +1; Deep discussions unchanged.
4. Open deeper question → route resolves (no 404).
5. Save deep answer → Deep discussions +1 when completion rule met.
6. If Essentials-linked → Essentials may +1.
7. Return to conversation → same session, correct next card.
8. Clean up QA records via Test Lab when done.

## Relaunch + family code

1. Record the five metrics.
2. Close the browser completely.
3. Reopen the app.
4. Enter the family code.
5. Open Home — metrics identical.
6. Open Conversations — Resume progress identical.
7. Open Essentials and Questions — progress identical.
8. Confirm no blank replacement session is primary Resume.

## Remote disabled diagnostic (local only)

1. Temporarily set `USE_REMOTE_JSON_STORE=false` and restart.
2. Trip Mode must show **LOCAL ONLY**, not Online Backup.
3. Trip writes must be blocked.
4. Restore `USE_REMOTE_JSON_STORE=true` and restart before normal use.

## Do not

- Delete zero-answer sessions without reviewing `docs/zero-answer-session-cleanup-preview.json`.
- Mutate live answers without a new dry-run and explicit approval.
