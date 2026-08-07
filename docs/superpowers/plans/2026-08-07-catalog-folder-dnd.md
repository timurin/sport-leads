# Catalog Folder DnD Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared drag-and-drop nesting/move for catalog folder trees and strengthen hierarchy visuals on sewing ops, product models, work-centers, and nomenclature categories.

**Architecture:** Pure helpers resolve drop targets and cycle checks; a small React wrapper around `@dnd-kit` provides draggable rows + droppable folders; each workspace wires existing server actions. Hierarchy CSS shared via a tiny class helper.

**Tech Stack:** Next.js client components, `@dnd-kit/core`, existing catalog server actions, `node:test` for helpers.

## Global Constraints

- No DS-SHELL visual changes  
- DnD disabled while search query is non-empty or inline edit is active  
- Folder→folder = nest only (not sibling reorder via DnD)  
- Work-centers: move equipment between stage folders only (stages stay flat)  
- Minimal diff; reuse move/PATCH APIs  
- No commit unless owner asks  

---

### Task 1: Pure DnD helpers + tests

**Files:**
- Create: `frontend/lib/catalog-folder-dnd.ts`
- Create: `frontend/lib/catalog-folder-dnd.test.mjs`
- Modify: `frontend/package.json` (add test path)

- [x] Write tests for `canNestFolder(folders, dragId, targetId)`, `resolveItemDropFolderId`, `isDescendantFolder` re-export/wrap if needed
- [x] Implement helpers (cycle guard, root sentinel, work-center unassigned id)
- [x] Run `node --test --experimental-strip-types lib/catalog-folder-dnd.test.mjs`

### Task 2: Shared hierarchy + DnD UI primitives

**Files:**
- Create: `frontend/components/settings/catalog-folder-tree-dnd.tsx`
- Create: `frontend/lib/catalog-folder-hierarchy.ts` (indent/guide class helpers) optional inline in component

- [x] `CatalogTreeDndProvider` wrapping `DndContext`
- [x] `CatalogTreeDragHandle` + `useCatalogTreeDraggable` / droppable folder row props
- [x] Hierarchy styles: depth padding, left guide, folder surface

### Task 3: Sewing operations workspace

**Files:**
- Modify: `frontend/components/settings/sewing-operations-workspace.tsx`

- [x] Hierarchy visuals on folder/op rows
- [x] Wire DnD: op→folder, folder→folder via existing actions
- [x] Disable when query/edit/saving

### Task 4: Product models workspace

**Files:**
- Modify: `frontend/components/settings/product-models-workspace.tsx`

- [x] Same as Task 3 for models + folders

### Task 5: Work-centers workspace

**Files:**
- Modify: `frontend/components/settings/work-centers-workspace.tsx`

- [x] Hierarchy visuals
- [x] DnD equipment onto stage / «Без цеха» → `updateWorkCenter`
- [x] Stage folder rows not nestable into each other

### Task 6: Nomenclature categories workspace

**Files:**
- Modify: `frontend/components/settings/nomenclature-categories-workspace.tsx`

- [x] Hierarchy visuals
- [x] DnD category onto category → update parent (nest); root drop if supported

### Task 7: Verify + ruflo

- [x] Run focused tests + lint on touched files
- [x] Store completion in ruflo memory; complete task `task-1786108385531-rqazms`
- [x] Report; stop (no auto roadmap close unless checklist item exists)
