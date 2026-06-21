# Chat Color Lab

Isolated side project for comparing and tuning chat page colors. Does **not** modify the main COE chat app.

## What it does

- **Left sidebar:** All ~57 color tokens in collapsible groups, plus JSON export at the bottom
- **Main area:** Full-size live preview of the chat UI with deep-purple default
- **Undo / Redo:** Step through color edits (`Ctrl+Z` / `Ctrl+Shift+Z`); reset is undoable too
- **Reset:** Restores the right panel to the full deep-purple preset
- **Export:** Copy JSON config to paste back when applying colors to the main app

## Run locally

From the repo root:

```bash
npx serve chat-color-lab
```

Then open the URL shown (usually `http://localhost:3000`).

Or open `chat-color-lab/index.html` directly in a browser (some features may vary with `file://`).

## Workflow

1. Open the lab — live preview fills the main area
2. Use the left sidebar to adjust any color group — preview updates instantly
3. Use **Undo** / **Redo** to step through changes
4. Click **Reset to Deep Purple** to restore the reference preset (undoable)
5. Click **Copy JSON Config** and paste the JSON when ready to apply to the main chat app

## Files

| File | Purpose |
|------|---------|
| `tokens.js` | `CURRENT`, `DEEP_PURPLE`, `TOKEN_GROUPS`, export helpers |
| `lab.css` | Lab layout + token-driven chat mock styles |
| `lab.js` | Controls, undo/redo, reset, JSON export, live preview |
| `index.html` | Split comparison UI |

## Isolation

This folder is intentionally separate from `public/`. The main Express app is unchanged. No imports from the production chat HTML or CSS.
