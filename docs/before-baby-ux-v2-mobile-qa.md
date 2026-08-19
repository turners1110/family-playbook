# Before Baby UX V2 — phone QA

Use a phone-width viewport (or a real phone). Stay on `trip-online-mode`. Do not expect a full page reload after mutations.

## Scenario A — Default view

Open `/before-baby`.

Expected:

- “What needs attention” is the selected primary control.
- Summary at the top answers overdue / this week / coming next (or a setup prompt if there is no due date).
- You do not have to pick among 16 chips to know what to do.

## Scenario B — Scroll + edit

Scroll halfway down (for example under This week). Expand a task, edit the title, Save.

Expected:

- Saving → Saved.
- No full page reload.
- You stay at the same scroll position and filters.

## Scenario C — Complete

Complete a task.

Expected:

- Checkbox updates immediately.
- Saved confirmation.
- If another task was blocked by it, the blocker copy updates after reconcile (no reload).

## Scenario D — Quick add

Tap Add Task, enter a title, save.

Expected:

- New task appears in the list.
- No reload.
- Sheet can close; the page does not jump to the top.

## Scenario E — Owner

Change owner on an open task.

Expected:

- Owner badge updates.
- No reload.

## Scenario F — Advanced filters

Tap Filters.

Expected:

- Inbox, Recommended, Do now, Today, This week, Next week, Next 2 weeks, Final month, Final week, After birth, Overdue, Priority, By owner, By category, By week, By month, Completed, All remain available.

## Scenario G — Owner then Overdue

Tap Owner, then Filters → Overdue.

Expected:

- Tasks are overdue (not a leftover owner-only “board mode”).
- Grouping may still be by owner; filter is overdue. URL should look like `?view=timeline&group=owner&filter=overdue`.

## Scenario H — Slow connection

Throttle the network. Edit a task.

Expected:

- Saving / Still saving… (or Updating schedule… for settings).
- Title/notes stay in the form.

## Scenario I — Failure

Force a failed save (offline).

Expected:

- Retry.
- Typed title is still in the field.
- The rest of the checklist is still on screen.

## Scenario J — Relaunch

Complete/edit a task, close the tab, reopen `/before-baby`.

Expected:

- Same completion and text after the store loads.

## Scenario K — Second phone

With Sam and Michelle both signed in, complete a task on one device, then refresh the other.

Expected:

- Same checklist after reconcile.
- If both edit the same task at once, conflict/retry — no silent overwrite.

## Notes

Bootstrap import (empty checklist) uses `router.refresh()` so the server can send the new `checklistId`. That is not a `window.location.reload()`.
