# Design references (Mobbin)

Light-mode, one-screen widget dashboard. Tokens: background `#fcfcfc`, text `#141414`, a neutral gray ramp, one accent `#1084fe`, soft layered shadows, iMessage-like calm. Every decision below names the reference that inspired it.

## 1. Grid and widget sizes

Inspired by native iOS widget families as shipped by [Strava](https://mobbin.com/screens/1c996718-ab94-4247-85b3-80885bab44c9), [Microsoft Outlook](https://mobbin.com/screens/25ccb821-186c-4f31-bbed-f434469e987c) and [Tiimo](https://mobbin.com/screens/0bc1fe18-7ae2-4ab8-a67d-f394ce273687): S is a square, M is two squares wide at the same height, L is two by two. All three apps keep identical outer radius and padding across sizes and just reveal more rows as the box grows.

- Unit: square cell. S = 1x1, M = 2x1, L = 2x2.
- Columns: 4 below 640px (two S per row, M spans full width), 6 at 640 to 1023px, 8 at 1024px and up. Cap the grid at ~1120px and center it.
- Gutter: 16px mobile, 20px tablet, 24px desktop. Outer page padding 16px on mobile.
- Radius: 22px on widgets (the continuous-corner look in Strava and Outlook), 12px on inner chips, 999px on pills.
- Widget padding: 16px (S), 18px (M, L).
- Shadow: two layers, e.g. `0 1px 2px rgba(20,20,20,.04), 0 8px 24px rgba(20,20,20,.06)`. No borders.

## 2. Typography scale

Outlook and Tiimo widgets use a small uppercase or accent-colored weekday label over a large light numeral, then tight 15px rows. Things 3 uses a bold large title over plain rows.

| Role | Size / weight |
|---|---|
| Widget label (eyebrow) | 12px / 600, gray-500, sentence case |
| Hero numeral (date, ring count) | 34px / 300 |
| Row primary | 15px / 500 |
| Row secondary (time, project) | 13px / 400, gray-500 |
| Detail view title | 28px / 700 |

## 3. Fixed widgets

**Today (tasks).** Modeled on [Things 3 Today](https://mobbin.com/screens/2617f49d-0496-4134-8867-2b0b8327e995): hollow 18px rounded-square checkbox, title, then a muted second line for project. Things puts a compact tinted event strip above the tasks and a "This Evening" divider ([screen](https://mobbin.com/screens/97952802-d1f3-4324-8a5b-fab1bc02c29e)); in the L size reuse that sectioning. S shows count left plus the next task. M shows 3 rows. L shows ~7 rows plus an "N more" footer, borrowed from Tiimo's "3 more" line.

**Calendar agenda.** From [Outlook widgets](https://mobbin.com/screens/25ccb821-186c-4f31-bbed-f434469e987c): weekday in accent blue, big date numeral, rows of `time | 3px color bar | title + duration`, with a small triangle marking the current event. M places the date block left and 3 events right. L adds a round accent "+" top-right (also Outlook). S shows date plus "Now" and one event.

**Habits (rings).** [Strava's widgets](https://mobbin.com/screens/1c996718-ab94-4247-85b3-80885bab44c9) show one bold ring with a centered count (S) and ring plus weekly bars (M). [Me+](https://mobbin.com/screens/0cdeb663-a2b8-421b-8f91-9923ec5776e5) pairs a large percentage ring with checked habit chips. Use: S = one aggregate ring (stroke 10px, gray-100 track, accent fill, round caps). M = aggregate ring left, 3 to 4 mini rings (28px) with labels right. L = grid of mini rings plus a 7-day dot row (Strava's M T W strip).

**Quick Capture.** [Craft's floating "What's on your mind?"](https://mobbin.com/screens/ce226d3d-544f-4742-b15e-1138fbdf37f9) card with an inline "Create" button, plus [Granola's](https://mobbin.com/screens/978cd9f4-a931-4b41-8088-cbb7a5b2bf22) quiet recent list with time stamps. Layout: a pill input (gray-50 fill, 44px tall, send arrow turns accent when non-empty) on top, then 2 (M) or 5 (L) recent items as `title · relative time`. S is a single tappable "Capture" prompt that expands straight into the input.

**Kiwi (bot status).** Status row on top: shape avatar with eyes (40px), name, live dot (green idle, accent pulsing working). Below, the latest 2 to 4 actions in timeline-row form (section 6), truncated to one line. Card density follows the [Relevance AI agent timeline](https://mobbin.com/screens/db919f38-24cb-4151-b995-2781392d7db2), where "1 step performed in the background" collapses detail.

## 4. Pages and edit mode

- Pages: horizontal scroll-snap with dots centered under the grid (Amie shows the same 3-dot pager above its pill bar, [screen](https://mobbin.com/screens/5330247b-2fcd-497e-9dfe-8355835bfb14)). Dots 6px, gray-300, active 6x16 pill in gray-700.
- Entering edit: long-press 500ms, or an "Edit" pill. Widgets wiggle (±1.2deg, 280ms alternating, staggered phase).
- Each widget gets a 22px gray-700 circular minus badge at top-left, as in [Aboard](https://mobbin.com/screens/094a5bcb-b809-4fd3-95ae-daa155fdb7c8) and [Xero](https://mobbin.com/screens/4e8528b4-dcab-4a06-a22c-b415b0a8e4da) dashboard edit modes.
- A floating bottom pill bar with "Add widget" and an accent "Done", taken directly from Aboard.
- Size switching uses an S / M / L segmented control in a widget settings sheet, as in [MD Vinyl](https://mobbin.com/screens/cf96a7c3-8875-4577-bcaf-34a4fc6f1b6d) and [Evernote Home's](https://mobbin.com/screens/c75dbd76-b644-4b55-9a6b-6329c5b38dee) "Widget Size" picker.
- While dragging: lift (scale 1.04, deeper shadow), neighbors reflow with a 220ms spring, dashed gray-200 placeholder in the drop slot.

## 5. Expand transition

From the [App Store Today story flow](https://mobbin.com/flows/3478b947-1202-4add-a131-8d1e881cfcdf): the card grows in place into a full-screen sheet, the header content stays anchored, the body scrolls below, and a round gray close button sits top-right.

- Shared-element morph of the card container (position, size, radius 22 to 0 on mobile, 28 on desktop modal) over ~380ms with a spring (no overshoot on radius).
- Widget eyebrow and hero content morph as shared elements; detail-only content fades in 120ms after the morph.
- Backdrop: `#fcfcfc` at 80% plus 12px blur. Close via button, Esc, or swipe down; reverse the same morph.

## 6. Activity & Teammates sheet

**Bot tree.** Card list feel from [Gumloop Agents](https://mobbin.com/screens/bffa14e0-9e37-44c4-805f-2a2837a99b82) (avatar, name, one-line purpose, "last run" meta) but rendered as an indented tree: coordinator at root, sub-bots indented 24px with a 1px gray-200 elbow connector. [Lindy's](https://mobbin.com/screens/019e8f99-6ab5-46d6-b180-992dd08f33ae) "Last run: 2 hours ago" column becomes right-aligned meta on each node.

**Timeline row anatomy** (adapted from [Browserbase's step list](https://mobbin.com/screens/4c0e5829-5b9f-467e-810b-91bdeb76069a) and [Manus version history](https://mobbin.com/screens/4142fbf7-14e2-4841-aad7-70e51ddf2dfe)):

1. Left rail: 24px bot avatar on a 1px vertical line.
2. Body: action summary 15px/500, then target and relative time 13px gray-500.
3. Optional chip row (tool used, item count), Browserbase-style tags.
4. Right: ghost "Revert" button (icon plus label, gray-700, hover gray-100), as in Manus's "Rollback" chips.

**Revert confirmation.** Inline confirm card, not a modal, copying [Lovable's "Revert to this version?"](https://mobbin.com/screens/94b4bb69-45ad-4ca0-934b-a03e1e33a880) block: one sentence of consequence, Cancel plus a dark "Revert" button. After reverting, show a bottom toast with "Undo", like [Rocket Money's](https://mobbin.com/screens/6a30f4ff-59fe-4dae-b402-4edd71ff5516) "2 transactions updated · Undo". Reverted rows stay visible with strikethrough summary and a "Reverted" gray pill.

## Notes

- Avoid the colorful gradient treatments seen in Me+, Liven and Structured; keep color to the single accent plus event bars.
- Dashboard-style references (Xero, Twenty) are for edit affordances only; their density is too high for this grid.
