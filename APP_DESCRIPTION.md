# TaskDeck — Application Description

This describes how TaskDeck behaves as of commit `a1be2c0` (Oct 31, 2026), taken from the source code. It's written as numbered statements so each one can be checked against a specification. **Must** means the app enforces the behaviour. A **Limit** is a known boundary of the current behaviour.

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

Card fields: `id`, `title` (required), `description`, `areaId` (or none), `columnId`, `priority`, `starred`, `progress` (0–100), `dueDate` (YYYY-MM-DD or none), `createdAt`, `completedAt`, `archivedAt` (archive only).

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
- **BOARD-2** Each card shows: title, rank (`#n`), project badge in the project's colour, a coloured bar on the left edge, due-date badge, star, link icons for each URL in the description, and a progress ring.
- **BOARD-3** Done-column cards show a struck-through title, show their completion date instead of the due date, and their progress counts as 100%.
- **BOARD-4** With "details" on, cards outside the Done column show 2 lines of description. Clicking it opens the full description in a pop-out panel.
- **BOARD-5** Every column except the Done column has a quick-add box at the bottom (type a title, press Enter).
- **BOARD-6** Clicking a card opens the card editor (section 8).

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

- **TOP-1** The top bar has: app icon and name (click to copy the board as text), Board/List switch, details toggle, search, project filter, New card, Options and Help.
- **TOP-2** Search matches card title, description or project name, and is case-insensitive.
- **TOP-3** The project filter offers All, No project, or a single project.
- **TOP-4** Search and the filter apply to the board, the list, and the archive lists.
- **TOP-5** The text copy lists every active card in rank order as `rank. title — column — progress%`, with the description indented underneath.
- **FOCUS-1** The Focus bar shows, left to right:
  - the overdue count ("All clear" if none), which opens the first overdue card when clicked;
  - a chip for each starred card not yet done;
  - the next card due;
  - "Next up": the highest-ranked card that isn't in the Done or Blocked column.
- **FOCUS-2** A card is overdue when its due date is before today and it isn't in the Done column. The Focus bar always counts all cards, regardless of search or filter.

## 8. Card editor

- **EDIT-1** Fields: Title (required), Project, Due date, Column/Status, Progress (slider 0–100), Description, Star.
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
- **OPT-4 Projects:** add, rename and recolour projects. Deleting a project asks which project (or none) its cards move to.

## 12. Keyboard and accessibility

| Key | Action |
|---|---|
| N | New card |
| V | Switch Board / List |
| D | Show or hide descriptions |
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
- **NO-4** No undo, other than restoring archived cards.
- **NO-5** No recurring tasks, subtasks, reminders or notifications.
