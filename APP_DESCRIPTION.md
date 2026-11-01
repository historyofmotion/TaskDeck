# TaskDeck — Application Description

This describes how TaskDeck behaves as of Oct 31, 2026 (after commit `87b882d`, plus the hour estimate and Deal mode), taken from the source code. It's written as numbered statements so each one can be checked against a specification. **Must** means the app enforces the behaviour. A **Limit** is a known boundary of the current behaviour.

---

## 1. Purpose and platform

- **GEN-1** TaskDeck is a single-user personal task board (Kanban style) with one global priority ranking across all tasks.
- **GEN-2** It runs entirely in the browser as one self-contained HTML file (`TaskDeck.html`). No server, account or network connection is needed.
- **GEN-3** All data stays on the user's computer, in the browser's storage and optionally in a JSON file the user picks.
- **GEN-4** Built with React 19, TypeScript, Tailwind CSS v4 and Vite. `npm run build` produces `TaskDeck.html`.
- **GEN-5** File sync (section 9) needs a browser with the File System Access API (Chrome, Edge). Other browsers can still use Export and Import.

## 2. Data model

A board is one object containing:

| Part | Contents |
|---|---|
| `columns` | Ordered list of statuses. Each has an id, a name, an order and a **type** (`pending`, `active`, `blocked` or `done`). |
| `areas` | "Projects": id, name, colour. Each card belongs to at most one. |
| `cards` | Active tasks (fields below). |
| `archive` | Archived tasks: the same fields plus `archivedAt`. |
| `settings` | Auto-archive days, theme, app icon. |

Card fields: `id`, `title` (required), `description`, `areaId` (or none), `columnId`, `priority`, `starred`, `progress` (0–100), `dueDate` (YYYY-MM-DD or none), `createdAt`, `completedAt`, `archivedAt` (archive only), `estimateHours` (hours needed to finish; optional, greater than 0), `trackedSeconds` (working time recorded by the timer; optional).

- **DATA-1** A new board has the columns Pending, In Progress, Blocked and Done (types pending, active, blocked, done), the projects Work, Personal, Admin and Errands, and 3 sample cards.
- **DATA-2** A column's behaviour comes from its **type**, never its name. Renaming a column must not change auto-archive, completion dates, overdue checks, the Focus bar or renumbering.
- **DATA-3** Boards saved before column types existed get a type guessed once from each column's name ("done" → done, "blocked" → blocked, "pending" → pending, otherwise active). The type is then saved.
- **DATA-4** The **Done column** is the first column of type `done`. Most rules below refer to it.

## 3. Priority ranking

- **RANK-1** Every active card has a unique rank 1…N, counted across all columns, not per column.
- **RANK-2** Ranks are renumbered 1…N after every change, so there are no gaps or duplicates.
- **RANK-3** Starred cards always rank above unstarred cards after any star change or card save.
- **RANK-4** A card added with quick-add gets the lowest rank (N+1). A card created in the editor also starts last, then starred cards move to the top.
- **RANK-5** Within a column, cards are displayed in rank order.

## 4. Stars

- **STAR-1** At most 3 cards can be starred.
- **STAR-2** Starring a 4th card opens a dialog. Confirming unstars the lowest-ranked starred card and stars the new one; cancelling changes nothing.
- **STAR-3** Starred cards have an amber border and a filled star.
- **STAR-4** Starred cards that aren't in the Done column appear as chips in the Focus bar (section 7).

## 5. Board view

- **BOARD-1** Columns appear side by side in column order. Each header shows the name and the number of cards.
- **BOARD-2** Each card shows: title, rank (`#n`), project badge in the project's colour, a coloured bar on the left edge, due-date badge, star, link icons for each URL in the description, the hour estimate (when set, shown as minutes under 1 hour, e.g. `30m`, otherwise hours, e.g. `1.5h`), and a progress ring.
- **BOARD-3** Done-column cards show a struck-through title, show their completion date instead of the due date, and their progress counts as 100%.
- **BOARD-4** With "details" on, cards outside the Done column show 2 lines of description. Clicking it opens the full description in a pop-out panel.
- **BOARD-5** Every column except the Done column has a quick-add box at the bottom (type a title, press Enter).
- **BOARD-6** Clicking a card opens the card editor (section 8).
- **BOARD-7** If the mouse rests on a card for 15 seconds without moving, the card plays a short squash-and-wiggle animation, and again after each further 15 still seconds. Moving the mouse restarts the count. It doesn't happen while dragging, after clicking the card, while a dialog is open, when the tab is hidden, or when the reduced-motion setting is on.

### 5.1 Moving cards

- **MOVE-1** Dragging a card onto another card places it directly before or after that card in the global ranking (the top or bottom half of the target card decides which). If the target is in another column, the card moves to that column.
- **MOVE-2** Dropping a card on an empty part of another column moves it to the end of that column.
- **MOVE-3** Dropping a card on an empty part of its own column, or on any column header, does nothing.
- **MOVE-4** Hovering a card shows quick-move buttons:
  - **Top / Bottom:** move to the top or bottom of its column.
  - **Left:** move to the top of the previous column.
  - **Right:** move to the bottom of the next column.
- **MOVE-5** Keyboard, when a card has focus: Alt+↑ / Alt+↓ change its rank by one, Alt+← / Alt+→ act like Left and Right, Enter or Space opens it.
- **MOVE-6** A card moved into the Done column gets a completion date if it had none. A card moved out of the Done column loses its completion date.
- **Limit MOVE-L1** Top and Bottom use only the cards visible under the current search or filter. This is intentional.

### 5.2 Column zoom

- **ZOOM-1** Each column header has a zoom button, and double-clicking the header also zooms. Zooming hides the other columns and the column fills the board width.
- **ZOOM-2** When zoomed, cards are laid out in a grid in rank order, left to right then top to bottom (minimum card width 240 px).
- **ZOOM-3** Dragging in the zoomed grid uses the left or right half of the target card to decide before or after.
- **ZOOM-4** To leave zoom: click the button again (it now shows inward arrows), double-click the header, or press Esc (ignored while a dialog is open or a text field has focus).
- **ZOOM-5** Zooming in and out is animated (the column grows, other columns fade, cards glide). The animation is skipped when the operating system's reduced-motion setting is on.
- **Limit ZOOM-L1** While zoomed, cards can only leave the column through the Left and Right buttons; other columns aren't visible as drop targets.

## 6. List view

- **LIST-1** All active cards in one table, in rank order, with Done-column cards grouped at the bottom under "Completed (n)".
- **LIST-2** Each row shows the rank, star, title (and description when details are on), a status dot with the column name, project, due or completion date, and progress.
- **LIST-3** Rows can be dragged to reorder, and have buttons for top, up one, down one and bottom.
- **LIST-4** The List menu offers two bulk renumbering options. Both put starred cards first.
  - **By status:** active and blocked cards (keeping their relative order), then pending, then done.
  - **By project:** project by project in the order set in Options; within each project active, then blocked, then pending. Cards with no project come last, and done cards go at the very bottom.
- **LIST-5** After renumbering, the confirmation message describes the option that was used.
- **LIST-6** A collapsible "Archived (n)" section at the bottom lists archived cards with Task, Project, Completed date and Archived date, newest archive first. Clicking a row opens it (ARCH-4).

## 7. Top bar and Focus bar

- **TOP-1** The top bar has: app icon and name (click to copy the board as text), Board/List switch, Deal button (section 7.1), details toggle, search, project filter, New card, Options and Help.
- **TOP-2** Search matches card title, description or project name, and is case-insensitive.
- **TOP-3** The project filter offers All, No project, or a single project.
- **TOP-4** Search and the filter apply to the board, the list, the archive lists and Deal.
- **TOP-6** If the filtered project stops existing (deleted, or missing from a loaded or imported board), the filter must reset to All.
- **TOP-5** The text copy lists every active card in rank order as `rank. title — column — progress%`, with the description indented underneath.
- **FOCUS-1** The Focus bar shows, left to right:
  - the overdue count ("All clear" if none), which opens the first overdue card when clicked;
  - a chip for each starred card not yet done;
  - the next card due;
  - "Next up": the highest-ranked card that isn't in the Done or Blocked column.
- **FOCUS-2** A card is overdue when its due date is before today and it isn't in the Done column. The Focus bar always counts all cards, regardless of search or filter.

### 7.1 Deal

- **DEAL-1** Deal opens a full-screen card table, from the Deal button or the T key.
- **DEAL-2** The deck holds up to 16 cards: cards in Active-type columns first, then Pending-type columns, each in rank order, after the current search and project filter. Blocked and Done cards are never dealt.
- **DEAL-3** One card is face up at a time, showing its project, star, rank, column, title, description (up to 5 lines, with URLs taken out and shown instead as link icons with the site name, which open in a new tab; icon only in 4 up), progress bar (when above 0%), hour estimate and due date.
- **DEAL-4** Done (button, → key, or dragging/flicking the card right) must move the card to the Done column with a completion time, exactly like dropping it at the end of the Done column. Done is disabled when no column has type Done.
- **DEAL-5** Not now (button, ← key, or dragging/flicking left) sets the card aside for this deal only. It must not change the board.
- **DEAL-6** Undo (button, Z or Backspace) takes back the last card, one step at a time. Undoing Done must return the card to its earlier column, rank, progress and completion time.
- **DEAL-7** A card without an estimate offers quick picks (15m, 30m, 1h, 2h, 4h, 8h; 30m–4h in 4 up); picking one saves it to the card. Clicking a card's estimate shows the picks again (current one highlighted, × keeps it).
- **DEAL-8** The table shows: the Not now pile and its count, the next 3 cards after the ones in view with their estimates, and how many more are face down, the Done pile and its count, hours cleared (sum of estimates of cards done in this deal, plus how many had no estimate), hours still in the deck, and "n of m played".
- **DEAL-9** When the deck is empty, a summary shows the number done (with hours) and set aside. "Deal again" deals the next cards, skipping every card already played since Deal was opened; it only appears if any are left.
- **DEAL-10** Esc, T or the close button returns to the board. Board shortcuts are off while Deal is open.
- **DEAL-11** Large "← Not now" and "Done →" labels sit either side of the card(s) and light up as a card is dragged toward them (hidden on phone-width screens, and below extra-wide screens in 4 up). The Not now / Done buttons and a line of instructions sit under the cards in both modes; in 4 up they act on the outlined card.
- **DEAL-12** An ⓘ button next to the title opens "How the deal works" (on hover, keyboard focus or tap): which cards are dealt, that they come in priority rank with starred cards first, what left, right and Undo do, and how hours are counted.
- **DEAL-13** A "1 card / 4 up" switch (or the F key) changes the table. On wide screens it sits stacked vertically beside the right edge of the cards, near the bottom; on narrow screens it stays in the header. The choice is remembered in this browser.
- **DEAL-14** In 4 up, four cards of the deck are face up in a 2×2 grid (one column on narrow screens). Cards have no buttons of their own; each can be dragged left or right. Clicking a card, or pressing 1–4, selects it (outlined) for the ← / → keys and the bottom buttons. Until a card is selected, and again after the selected card is played, the bottom buttons are disabled and the arrow keys do nothing. Double-clicking a card switches to 1 card showing that card. When a card leaves, the next card from the deck fills the grid.
- **DEAL-15** Above the cards, an outline-only scrub bar (shown when the deck has more cards than are face up) has one outlined dot per card in its project colour and an outlined window over the face-up card(s). It has no caption.
- **DEAL-16** Pressing and dragging along the scrub bar swaps the card in view as you go (in 4 up, the four face-up cards move through the deck in order, each swapping in place in its own slot). Cards slide and tilt in from the side you're scrubbing toward and stay solid (the old card fades out underneath). It only changes which cards are in view, not the deck's order or the board's ranking. With keyboard focus, ← / → step one card instead of playing one. After a card is played, the next card fills the same position.
- **DEAL-17** Undo returns the card to the front of the deck and shows it.
- **DEAL-21** Each dealt card has a pencil button that opens the full card editor on top of Deal. Deal's keys are paused while the editor is open; Esc closes only the editor. A card edited into Blocked or Done leaves the deal.
- **DEAL-18** Each dealt card has a ▶ Start button for the timer (section 7.2); the card being worked on shows "Working" instead.
- **DEAL-19** A "Blocked" list in the left column shows up to 6 blocked cards (after search and filter) in rank order, with "+ n more" beyond that. Clicking one opens its details: project, rank, title, description, due date, estimate, tracked time, progress and created date.
- **DEAL-20** In the details, "Make active" must move the card to the end of the first Active-type column and deal it as the next card. "Keep blocked", clicking outside, or Esc closes the details and leaves it blocked. Make active is disabled if no column has type Active.
- **DEAL-22** Dealt cards look like playing cards. Active cards are red suits (♥ or ♦) and Pending cards black suits (♠ or ♣), with a matching thin frame, large soft-coloured corner indices (the bottom one upside down) and a faint suit in the middle. Active cards also have a faded red paint-stroke swoosh across the top. Which of the two suits a card gets is picked from its id, so it looks random but never changes.
- **DEAL-23** The first two cards of each deal are face cards, King and Queen, with a double gold frame and a faint crown and letter in the middle; they keep the face for the whole deal. Every other card shows its priority rank as its number. The "Still in the deck" list shows each card's suit too, and the tooltip explains the suits.
- **DEAL-24** Clicking a card in "Still in the deck" opens its details (same layout as a blocked card's, with its suit, column and rank). "Play it now" brings it into play (in 4 up, into view and selected) without changing the deck's order; "Close", clicking outside or Esc closes the details.
- **DEAL-25** The Not now and Done piles show their newest cards face up as small playing cards (rank, suit, Active / To do, title), stacked with each card offset and turned so several cards are visible. Clicking a pile spreads up to 5 of its newest cards out toward the middle of the table (Not now to the right, Done to the left; below the pile on narrow screens); any others stay stacked in the pile. One pile is open at a time. The top card of a closed pile can be dragged straight onto the table too, without opening the pile; a dropped card settles in place. A spread card can be dragged onto the card(s) in play to bring it back (the table shows a dashed outline and "Drop here to bring it back" while dragging; a short drag or a drop elsewhere springs it back to the spread). Hovering a spread card (or picking it) also shows an arrow pointing toward the table that sends it back into play at the front of the deck; from Done this must also return it to its earlier column, rank, progress and completion time. Clicking a spread card picks it: then → moves it to Done, ← to Not now, Enter brings it back, Esc lets go. Clicking the pile again or Esc puts the cards back.
- **Limit DEAL-L1** Not now isn't remembered: closing and reopening Deal deals those cards again.

### 7.2 Time tracking

- **WORK-1** There are three states: not tracking, working on one card, or off task. Only one card can be worked on at a time.
- **WORK-2** The state shows at the right end of the Focus bar and under the Deal header: a pulsing green "Working on <title>" with this stretch's clock and the card's total, an amber "Off task" with its clock, or a grey "Not tracking".
- **WORK-3** Start working from ▶ Start on a Deal card or "Start working" in the card editor. Only one card can be worked on: starting another card must first stop the previous one and record its time, with a message saying how much was recorded.
- **WORK-4** "Off task" records the working time on the card and starts an off-task clock. "Back to <title>" resumes the card. Off task can also be started with no card. Off-task time isn't recorded anywhere.
- **WORK-5** "Stop" records the working time on the card and shows how much was recorded.
- **WORK-6** Recorded time is added to the card's `trackedSeconds`. It saves with the board and appears on the board tile (`25m / 1h` with the estimate), on Deal cards and in the card editor.
- **WORK-7** When the card being worked on is moved to Done (or archived or deleted), the timer must stop and record its time. If off task, the off-task clock keeps running with no card to return to.
- **WORK-8** A running timer survives a page reload (kept in this browser only). Board tiles show a "Working" badge on that card. The "Working" / "Working on" text pulses (not with the reduced-motion setting).
- **WORK-9** Several TaskDeck tabs in the same browser share one timer: when one tab starts, switches or stops it, the others follow straight away.
- **Limit WORK-L1** The timer is per browser (tabs share it): another browser or device using the same board.json doesn't see it.

## 8. Card editor

- **EDIT-1** Also shows tracked time next to the estimate, and a Start working / Stop timer button for cards not in Done. Fields: Title (required), Project, Due date, Column/Status, Progress (slider 0–100), Estimate (hours, steps of 0.25, with quick picks 15m–8h; empty means not estimated), Description, Star.
- **EDIT-2** Closing the editor, by the close button or by clicking outside it, saves the changes. A new card with an empty title is discarded.
- **EDIT-3** Delete asks "Yes / No" before permanently removing the card.
- **EDIT-4** "Archive Now" appears only for cards in the Done column and archives the card straight away.

## 9. Saving and file sync

- **SAVE-1** Every change saves to the browser's local storage immediately, along with a "last saved" time.
- **SAVE-2** The user can connect a JSON file (Options), either by picking an existing file or by creating a new `board.json`. The connection is remembered across reloads.
- **SAVE-3** While a file is connected, each change is also written to it 0.5 s later. A pending write is flushed when the page closes.
- **SYNC-1** Before using a connected file, both when the app opens and when the user connects one, the app reads it and compares it with the browser copy. Nothing is written to the file until this check is done.
- **SYNC-2** If the two copies match (ignoring JSON key order), the file connects without a prompt.
- **SYNC-3** If they differ, a dialog shows:
  - each copy's save time, with the newer one marked;
  - the card and archived-card counts for each copy;
  - cards only in the file, cards only in the browser, and changed cards (up to 5 titles each);
  - whether the order, columns, projects or settings differ.
- **SYNC-4** The dialog offers three choices:
  - **Use file:** the file's board replaces the browser copy and is saved to browser storage.
  - **Keep browser copy:** the browser copy overwrites the file.
  - **Decide later:** the file isn't connected for this session, and the app asks again next time it opens.
- **SYNC-5** If the browser needs permission to read the remembered file, a yellow bar appears with "Check file" (asks for permission, then runs SYNC-1) and "Not now".
- **SAVE-4** Options also offers manual Export (downloads `kanban-board-YYYY-MM-DD.json`) and Import (replaces the whole board with the chosen file).

### 9.1 File checking (Import and connected files)

- **CHECK-1** The app refuses a file and leaves the board unchanged if:
  - it isn't valid JSON, or isn't a JSON object;
  - it has no `cards` list;
  - `columns` or `archive` is present but not a list;
  - any card or archived card has no id or title;
  - any column has no id or name;
  - two cards, or two columns, share an id.
- **CHECK-2** The message for a refused file gives the first problem and how many others there are.
- **CHECK-3** The app repairs these smaller problems, then lists what it fixed in a message:
  - a card in a column that doesn't exist is moved to the first column;
  - an unknown project on a card is cleared;
  - a due date not in YYYY-MM-DD format is cleared;
  - a progress value that isn't a number or is outside 0–100 is corrected;
  - an hour estimate that isn't a number above 0 is cleared (values above 1000 are capped);
  - tracked time that isn't a number of 0 or more is cleared;
  - stars beyond 3 are removed.
- **CHECK-4** Missing optional fields get defaults: empty description, no project, 0% progress, the current time for `createdAt`, the default columns or projects if those lists are missing, and the default settings.
- **CHECK-5** The file's own ranking is kept (cards are sorted by their `priority` value), then renumbered 1…N.
- **CHECK-6** A refused connected file is never connected or written to.

## 10. Archive

- **ARCH-1** Cards in the Done column whose completion date is at least N days old move to the archive automatically. N is set in Options (3–90, default 7). The archive time is recorded.
- **ARCH-2** Auto-archive runs whenever the board changes.
- **Limit ARCH-L1** Auto-archive doesn't run when the app opens, only at the next change. This is accepted.
- **ARCH-3** Archived cards are never deleted automatically. They're removed only by "Delete permanently".
- **ARCH-4** Clicking an archived card opens a view with **Restore** (puts it back in the Done column) and **Delete permanently**.
- **ARCH-5** The Done column has a collapsible "Archived (n)" list showing each card's title, completion date and archive date, newest first.

## 11. Options

- **OPT-1 General:** auto-archive days (3–90); theme (Light, Dark, System, where System follows the operating system live); file sync; Export; Import.
- **OPT-2 App icons:** a choice of 6 icons (kanban, deck, star, check, rocket, grid). The choice is also used as the browser-tab icon.
- **OPT-3 Columns:**
  - add, rename and reorder columns, and set each column's type;
  - deleting a column moves its cards to the column on its left (or on its right if it's the first);
  - at least one column must remain.
- **OPT-4 Projects:** add, rename and recolour projects. Deleting a project asks which project (or none) its cards move to; archived cards follow the same choice.

## 12. Keyboard and accessibility

| Key | Action |
|---|---|
| N | New card |
| V | Switch Board / List |
| D | Show or hide descriptions |
| T | Open Deal; in Deal, back to the board |
| ← / → / Z (in Deal) | Not now / Done / Undo |
| F / 1–4 (in Deal) | Switch 1 card / 4 up; select a card in 4 up |
| / | Focus search |
| Esc | Clear search (when search has focus), close the open dialog, or leave column zoom |
| ? | Help |
| Alt + ↑ / ↓ | Change the focused card's rank by one |
| Alt + ← / → | Move the focused card to the previous or next column |
| Enter / Space | Open the focused card |

- **KEY-1** Single-key shortcuts are ignored while typing in a field or while any dialog is open.
- **A11Y-1** Dialogs keep keyboard focus inside them and close with Esc. Columns, cards and controls have descriptive labels for screen readers.

## 13. Not included

- **NO-1** No accounts, sharing or multi-user editing.
- **NO-2** No automatic sync between devices or browsers, apart from the user pointing two browsers at the same JSON file.
- **NO-3** The connected file isn't re-read while the app is open; the comparison happens only on open or connect.
- **NO-4** No undo, other than restoring archived cards and Undo inside Deal.
- **NO-5** No recurring tasks, subtasks, reminders or notifications.
