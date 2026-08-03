# Manual QA — stale form state + answered status

## Setup
1. Deploy or run `trip-online-mode` with remote store enabled.
2. Open Conversations → Resume a session (or Start round with Continue).

## Form isolation
1. Open Question A.
2. Enter notes / short text: `A NOTES ONLY`.
3. Select Option A (if applicable).
4. Save and next.
5. **Verify Question B** has blank notes and no Option A selected.
6. Enter `B NOTES ONLY` on Question B.
7. Go Back to Question A.
8. **Verify** A notes and answer return (from save or draft).
9. Advance to B again.
10. **Verify** B notes remain `B NOTES ONLY`.

## Draft restore
1. On Question C enter unsaved text `C DRAFT`.
2. Refresh the page (same card).
3. **Verify** “Unsaved draft restored” and `C DRAFT` remains.
4. Save successfully.
5. Advance to D — **Verify** C draft does not appear.

## Progress consistency (after verified save)
1. Save two conversation cards.
2. Open `/conversations` — Resume shows updated X of Y.
3. Open `/home` and `/questions` — library badges update for Essentials saves.
4. Open `/questions/before-birth` — Essentials progress updates after Essentials saves.
5. Open `/settings/storage-debug` — Compare Counts aligned.

## Relaunch
1. Close browser.
2. Re-enter family code.
3. Resume the **same** session with progress (do not Start a blank round).
4. **Verify** A and B remain separate and counts match Storage Debug.
