# TaskDeck – Suggestions

Concerns from a code review. Not yet verified against the code.

## Main issues

1. ✅ **Fixed** — columns now have a saved type (Pending/Active/Blocked/Done), editable in Options → Columns. ~~**Behaviour depends on column names.** Done, Blocked and the status order are found by matching names like `"done"` and `"blocked"`, and some places fall back to the id `'c4'`. Renaming the Done column quietly turns off auto-archive, completion dates and the overdue logic.~~
2. ✅ **Fixed** — on open (and on Connect), board.json is compared with the browser copy; if they differ you choose which to keep. ~~**The connected file isn't read back on open.** The app reconnects to `board.json` but loads the board from localStorage. If the file was edited elsewhere, the next change in the app overwrites those edits.~~
3. ✅ **Fixed** — imported and connected files are checked first: broken files are refused with the reason (board unchanged), small problems are repaired and listed, and loaded boards are saved to localStorage. ~~**Imported or connected JSON isn't checked.** It's loaded straight in and only renumbered, so a malformed file can break the board. Connecting a file also doesn't save its contents to localStorage.~~
4. ⏭️ **Won't fix** (it runs on the next change anyway). ~~**Auto-archive only runs after a change.** It doesn't run when the app opens.~~
5. ✅ **Fixed** — the drag/move helpers now copy the card. ~~**Reorder helpers change the dragged card directly.** They should copy it instead; changing it directly can cause subtle React state bugs.~~
6. ✅ **Fixed** — the handler now updates when columns change. ~~**The keyboard shortcut handler can use an out-of-date column list.** The columns are missing from its React dependency list.~~

## Smaller issues

7. ✅ **Fixed** — each renumber option shows its own message. ~~Renumbering always shows the "by Status" message, even when you pick "by Project Priority".~~
8. ✅ **Fixed** — starred cards (not yet done) now appear as chips in the Focus bar. ~~Help says starred cards are pinned to the Focus bar, but the Focus bar doesn't show them.~~
9. ⏭️ **Keeping as is.** ~~Top and bottom moves act only on the filtered cards. With a filter on, "top" means the top of what's visible, not of the whole board.~~

## Cleanup

10. ✅ **Fixed** — `dist/` is a git-ignored build folder refreshed on every build; the README now points only to `TaskDeck.html`. ~~`dist/index.html` is out of date (Jul 31). `TaskDeck.html` is the current build.~~
11. ✅ **Fixed** — removed `@google/genai`, `express`, `@types/express`, `dotenv`, `tsx`, `.env.example` and the Gemini flag in `metadata.json`. ~~Unused leftovers from the AI Studio template: `@google/genai`, `express`, `dotenv` and `GEMINI_API_KEY` in `.env.example`.~~

Issues 1–3 are the ones most likely to lose data or break the board.
