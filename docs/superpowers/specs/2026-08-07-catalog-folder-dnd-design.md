# Catalog folder DnD + hierarchy visuals — Design

**Code:** `SL-CATALOG-FOLDER-DND-v1`  
**Date:** `2026-08-07`  
**Status:** approved (owner: nest on folder drop = option 1; «далее»)  
**Ruflo:** `task-1786108385531-rqazms`

## Problem

Catalogs with a folder tree (sewing ops, product models, work centers by workshop, nomenclature categories) lack drag-and-drop to nest folders / move items, and the list hierarchy is hard to read (weak indent / no guides).

## Decision summary

| Topic | Choice |
|-------|--------|
| Approach | **A** — shared `@dnd-kit` catalog tree DnD helper + per-workspace API wiring |
| Folder → folder drop | **Nest** (`parent_id` / category parent); cycle-safe |
| Item → folder drop | Change `folder_id` / `production_stage_id` / N/A for categories |
| Sibling reorder via DnD | Out of this iteration (keep ↑↓ / existing reorder) |
| Search active | DnD disabled |
| Work-centers folders | Production stages as flat folders; DnD moves equipment only (not nest stages into stages) |
| Hierarchy UI | Depth indent + vertical nest guide + folder vs leaf contrast |

## Surfaces in scope

1. `/settings/catalogs/sewing_operations` — folders + operations  
2. `/settings/catalogs/product-models` — folders + models  
3. `/settings/catalogs/work-centers` — stage folders + equipment  
4. `/settings/catalogs/nomenclature` categories tree — categories only  

Out of scope: assembly-variant sewing ops drawer; production-stages flat list (already has reorder DnD).

## Shared UI contract

- Drag handle (grip) on folders and movable items  
- Droppable folder rows (+ optional root / «Без цеха» zone)  
- Overlay while dragging  
- Visual drop highlight on valid targets; invalid (self / descendant) rejected  
- Hierarchy: `paddingLeft` by depth, left border/guide for depth ≥ 1, folder row muted surface  

## Persistence

Reuse existing server actions / PATCH:

- Sewing: `moveSewingOperationsToFolder`, `updateSewingOperationFolder` (`parent_id`)  
- Product models: `moveProductModelsToFolder`, folder PATCH `parent_id`  
- Work centers: `updateWorkCenter` (`production_stage_id`)  
- Nomenclature categories: existing update / parent change + sibling reorder unchanged  

## Non-goals

- No new backend reorder-by-index API in this iteration  
- No replacing move-to-folder modal or ↑↓ buttons  
- No DS-SHELL changes  

## Acceptance

- User can nest a folder under another by DnD on all real-folder catalogs  
- User can drop an item onto a folder to re-parent it  
- Hierarchy readable at a glance (indent + guide)  
- Focused unit tests for cycle-guard / drop target resolution helpers  
