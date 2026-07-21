# Sport-Lead — Motion Rules

**Code:** `SL-MOTION-TOKENS-v1`  
**Date:** `2026-07-21`  
**Roadmap:** `5.2.2.4`  
**Source:** `frontend/app/globals.css`  
**Related:** `interaction-tokens.md` (state colours)

## Timing tokens

| Token | Value | Use |
|---|---|---|
| `--portal-motion-fast` | `120ms` | Icon toggles, micro feedback |
| `--portal-motion-normal` | `180ms` | Color / border / surface (Button) |
| `--portal-motion-slow` | `280ms` | Panel open/close (future) |
| `--portal-motion-ease` | `ease` | Default |
| `--portal-motion-ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | Emphasized enters |

## Rules

1. Prefer `transition-colors` / `transition-opacity` on controls — avoid layout thrash (`width`/`height`/`top`).
2. Sidebar width transition may keep existing `duration-200` under DS-SHELL until a shell visual task.
3. No decorative looping animation in ERP chrome.
4. Loading: `animate-pulse` only for skeleton placeholders.
5. **`prefers-reduced-motion: reduce`** is enforced globally in `globals.css` (near-zero duration).

## Do not

- Add Framer Motion for routine chrome without a product task.
- Animate modal backdrop opacity with long delays that feel laggy.
- Use motion to hide missing data / errors.

## Smoke

- `Button` uses `duration-[var(--portal-motion-normal)]`.
- Global reduced-motion media query active.
