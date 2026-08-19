# UX reliability — mobile QA (`trip-online-mode`)

Phone width (iPhone Safari or Chrome device mode ~390px). Use a real device when possible.

## SCENARIO A — Home → Before Baby

Expected: Before Baby nav chip is underlined + filled; skeleton appears if the page is slow; no blank white screen.

## SCENARIO B — Before Baby → Conversations

Expected: Conversations chip scrolls into view on the horizontal nav; tap target stays large.

## SCENARIO C — Conversation save

Expected: Saving… then Saved on the card/footer; next card; verify-before-advance still holds.

## SCENARIO D — Slow connection

Chrome DevTools → Slow 3G. Navigate Home / Essentials / Research. Expected: header + tile/card skeletons, `Loading` announced once, no empty page.

## SCENARIO E — Save failure

Throttle or block the save action. Expected: answer text remains; Retry; `role="alert"` on failure.

## SCENARIO F — Invalid route

Open `/this-page-does-not-exist`. Expected: branded “Page not found” with Home, Conversations, Before Baby.

## SCENARIO G — Server error

Force a render throw on a section (or Next error overlay in dev). Expected: “Something went wrong”, Retry, Back to Home. No stack traces in the branded UI.

## SCENARIO H — Reduced motion

OS Reduce Motion on. Expected: no smooth nav scroll (`auto`); skeletons do not pulse noticeably.

## Major routes

| Route | Loading | Error | Active nav | Empty | Title suffix |
|---|---|---|---|---|---|
| `/home` | home skeleton | root `error.tsx` | Home | decisions empty state | Home \| … |
| `/before-baby` | timeline/cards | section error | Before Baby | existing empty filters | Before Baby \| … |
| `/questions` | list skeleton | section error | Questions | existing library empty | Questions \| … |
| `/questions/before-birth` | essentials skeleton | questions error | Essentials | n/a | Essentials \| … |
| `/conversations` | session skeletons | section error | Conversations | history empty state | Conversations \| … |
| `/conversations/history` | conversations loading | conversations error | Conversations | EmptyState | Conversations \| … |
| `/decisions` | cards | section error | Decisions | EmptyState | Decisions \| … |
| `/research` | source cards | section error | Research | EmptyState | Research & Books \| … |
| `/search` | none (fast) | root | none | existing | Search \| … |
| `/settings` | none | root | Settings | n/a | Settings \| … |
