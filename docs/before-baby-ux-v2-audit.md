# Before Baby UX V2 — pre-change audit

HEAD: `ce15e4c73a5e244e6a201db0588c01e635a8253a` (includes UX `1cd072a` and security `ce15e4c`).

## Surface

Live page `app/before-baby/page.tsx` renders `BeforeBabyScheduler` (not `BeforeBabyBoard`). `BeforeBabyBoard` is unused in routes; only referenced by a UX source test.

## Scheduling engine (keep)

`lib/checklists/scheduling.ts`, `default-timing.ts`, `dependencies.ts`, `ownership.ts` already implement offsets, hard deadlines, preferred days, max tasks/week, weekend-heavy, travel avoidance, post-birth, manual dates, timeline groups/badges.

`filterTasksByView` + `getTimelineGroup` already express overdue / this week / next week / final month / final week / after birth.

## Views today

**Board modes (4):** Milestones, Timeline, Owner, Category.

**Timeline chips (16):** Inbox, Recommended, Do now, Today, This week, Next week, Next 2 weeks, Final month, Final week, After birth, Overdue, Priority, By category, By owner, Completed, All.

**Coupling bug:** Owner board sets `view=by_owner`; Category sets `by_category`; Timeline sets `recommended`. Tapping another chip does not reset `boardMode`, so Owner + Overdue can disagree.

Default: `boardMode=milestones`, `view=recommended` — not “what needs attention.”

## Reloads (`window.location.reload`)

| File | When |
|---|---|
| `BeforeBabyScheduler` | generate schedule; import missing; CompactTaskRow save; custom delete |
| `BeforeBabyBoard` | custom add `onAdded`; import missing if added > 0 |
| `AfterBirthBoard` | First Month import |

Empty first import uses `window.location.href = "/before-baby"` (full navigation after bootstrap).

Quick Add already appends locally (`onCreated`) without reload.

## Mutations

Optimistic complete toggle exists (`useOptimistic`) but failures do not revert the optimistic map cleanly (still uses `useTransition` + local `tasks`).

Saves use ad-hoc `message`/`error` strings, not `useSaveFeedback` / `SaveStatus` (except custom add on Board).

Server actions `revalidatePath` several routes but clients still reload the document.

`generateBeforeBabySchedule` already returns `{ tasksUpdated, tasks }`. Import does not return the task list. Update/toggle return little for reconciliation.

## Home

“What to do next” is discussion/babymoon/questions. Before Baby is only a button — no attention counts.

## Save / loading already shipped

Route `loading.tsx` / `error.tsx` exist. Do not duplicate skeletons. This pass is mutation UX + default view.
