# UX reliability audit (`trip-online-mode`)

HEAD at audit: `4c7086cd6f1b1e2fd74b135a1e0179b9f092b078`

Working product already has durable save UI for Conversations and Essentials. This pass fills navigation, route transitions, errors, and remaining save surfaces. Do not treat this as a redesign.

## Route loading / error (before)

| Kind | Count |
|---|---|
| `loading.tsx` | 0 |
| `error.tsx` | 0 |
| `not-found.tsx` | 0 (Next default) |
| `Suspense` | 0 |

Major pages call `AppShell` → `requireFamilyContext()` then `readStore()`. The full chrome waits on family resolution. Do **not** move auth client-side. Use `loading.tsx` skeletons that include header + nav chrome.

## Save-status components already present

| Component | Role |
|---|---|
| `useSaveFeedback` | idle / saving / verifying / saved / failed / conflict / retry / slow tiers / leave guard |
| `SaveButton` | Busy label + spinner |
| `SaveStatusBanner` | Persistent inline status, `aria-live` |
| `RetrySavePanel` | `role="alert"` + Retry |
| `SlowSaveNotice` | 1.5s / 4s copy |
| `PendingNavigationGuard` | Unsaved/in-flight leave warning |
| `CardSkeleton` | Next-question pulse |
| `InlineSpinner` / `SavedIndicator` | Button adornments |

**Already wired:** `ConversationCard`, `EssentialsScreen`, `TaskSuggestionPreview`, QA Test Lab.

**Inconsistent (pending/Saving… only):** `AnswerEditor`, `DecisionForm`, `QuestionInterview`, Before Baby custom task, settings, research add, discuss notes.

## Navigation (before)

`AppShell` maps `NAV_ITEMS` with **no** `usePathname`, **no** `aria-current`, **no** active styles. Mobile nav is `overflow-x-auto`. Nested routes never highlight the section.

## Metadata (before)

Only root `app/layout.tsx`: title `Turner Family Principles`. No per-section titles.

## Forms / validation (before)

Server Zod remains authoritative. Client:

- Before Baby custom task: HTML `required` on title
- Structured ranking: unique list via move-up (duplicates not selectable)
- Matrix/policy/priority_pick: no pre-save client check
- AnswerEditor: server errors with Retry, but no shared `SaveStatus`

## Family-context pages

`AppShell` plus many pages (`/research`, `/settings`, question/research routes) call `requireFamilyContext()`. Duplicate reads are acceptable; do not weaken isolation.

## Duplicated feedback patterns

- `pending ? "Saving…"` on many buttons
- Local `saveStatus` in `QuestionInterview`
- `setSaved(true)` on settings/session notes

## AppShell streaming decision

Keep `requireFamilyContext()` in `AppShell`. Extract a client `PrimaryNav` only. Route `loading.tsx` covers the blank-navigation gap.

## Security files (out of scope)

Pending RLS work (`0012_secure_reference_tables.sql`, audit docs, `lib/security/`, live RLS tests) must remain untouched by this UX commit.
