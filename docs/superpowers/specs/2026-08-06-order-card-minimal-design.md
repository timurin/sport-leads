# Design — Sales order card minimal densify

**Date:** 2026-08-06  
**Route:** `/sales/orders/[id]`  
**Host:** `frontend/components/sales/sales-order-page.tsx`  
**Approach:** A — Soft densify (approved)  
**Ruflo:** swarm `swarm-1786011199054-rpfxz6`, namespace `sport-leads`, task `task-1786011199692-jg2nvc`  
**Status:** Spec ready for owner review (no implementation until approved)

## Problem

The buyer order card is overloaded: large vertical stack of panels, duplicated finance/client facts, and CRM chrome (comms / notes / tasks) pushes line items below the fold. Empty need states and multi-layer finance rail waste space.

## Goals

1. Mixed first viewport: document work + access to CRM without a long stack.
2. One source of truth for money (right Finance tab only).
3. Dense Soft UI; preserve shell contracts and Stage 20 data contracts.
4. Keep recent line-item add/refresh fix.

## Non-goals

- New HTML etalon v2 (Stage 22 follow-up OK later)
- Shell (`DS-SHELL-01` / `DS-SHELL-02`) visual changes
- Backend / API / migrations
- Orders list, kanban, lead card
- Full UNF items toolbar redesign

## Owner decisions (locked)

| Decision | Choice |
|----------|--------|
| Scenario | Mixed |
| First viewport | Header, party, items, client need, finance, internal chat, notes/tasks |
| Not first viewport | Tech cards (and documents / full history) |
| Layout | Left document + right tabs |
| Approach | A Soft densify |

## Information architecture

### Left — document column

1. **Header** — number, status, stage rail, actions; single source-lead entry point (no repeated «открыть лид»).
2. **Party + need (one card)**  
   - Party: client, organization, responsible, source-lead link.  
   - **Remove from this card:** items subtotal, discount, amount net, VAT, currency, total.  
   - Need: sport, category, quantity, desired date, source, description; Pencil / Plus; compact empty state (no large dashed `py-6` block).
3. **Line items** — primary canvas (`SalesOrderItemsUnfDemo`); slightly denser toolbar/rows; do not restate document total as a second hero above the grid if Finance tab shows it.

### Right — sticky ~320–360px, `CompactTabs`

| Tab | Content |
|-----|---------|
| **Финансы** | Single vertical summary: total, net, VAT, discount %, payment. No 4 soft chips + metrics hero + production/sewing/margin/mini-stats on this tab. |
| **Переписка** | Internal collaboration only; drop embedded client card duplicate. |
| **Заметки** | Notes + short tasks list. |

### Behind filters / secondary modes

- Tech cards panel  
- Documents tree  
- Full history timeline  

Default view mode should present this Document layout (not the current «Все» mega-stack).

## Visual density

- Section padding ≈ `p-3`; vertical gap between left blocks ≈ `0.5–0.75rem`.
- Compact tab triggers (`h-8`); no long section descriptions in the right rail.
- Prefer Soft UI tokens already used on Stage 22 FE path; no purple/glow/new brand fonts.

## File plan

| File | Change |
|------|--------|
| `sales-order-page.tsx` | Restructure to left stack + right tab host; move finance / collab / notes-tasks into tabs |
| `order-client-need-details.tsx` | Strip money fields; denser need UI |
| `sales-order-metrics.tsx` (and page host) | Slim finance for Finance tab |
| `order-collaboration-panel.tsx` (usage) | Chat without client summary card on this page |
| `order-card-view-mode.ts` (+ tests) | Default Document layout; keep tech/docs modes |
| `globals.css` | Optional order-workspace density only |

## Verification

- 1280 / 1440: line items reachable without scrolling past a CRM stack.
- Filters still open Documents / Tech cards.
- Add order line appears without full page reload.
- Report: **DS-SHELL-01 visual contract preserved**, **DS-SHELL-02 visual contract preserved**.

## Out of iteration follow-ups

- Optional HTML etalon `order-card-reference-v2.html` under Stage 22 after live OK.
- Roadmap microtask checkbox only if owner asks to register under `22.*`.

## Self-review

- [x] No placeholders / TBD in locked decisions  
- [x] No contradiction with mixed + layout 2 + approach A  
- [x] Scope bounded to one route FE  
- [x] Shell / API explicitly out of scope  
