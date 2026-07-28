<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# TaskDeck

TaskDeck is a sleek, local-first personal task tracking board featuring global priority ranking, focus starred cards, area tagging, column reordering, and direct file persistence.

## Running Without a Server (Serverless / Standalone HTML)

You can run TaskDeck **completely offline without any web server or Node.js runtime**:

1. Simply double-click **`TaskDeck.html`** (or `dist/index.html`) in your browser (Chrome, Firefox, Safari, Edge).
2. The entire application (React runtime, Tailwind styles, SVG icons, and state management) is bundled into this single HTML file.
3. All board data persists locally via `localStorage`, IndexedDB, or direct JSON file save/export.

## Development & Rebuilding

If you edit the source code in `src/`, rebuild the single-file HTML bundle:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build single-file HTML:
   ```bash
   npm run build
   ```
   This generates `dist/index.html` and updates `TaskDeck.html`.

3. Dev server (optional for live development):
   ```bash
   npm run dev
   ```
