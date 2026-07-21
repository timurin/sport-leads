# Sport-Lead — Toast and Inline Feedback

**Code:** `SL-FEEDBACK-STD-v1`  
**Contract:** `DS-FEEDBACK-01`  
**Date:** `2026-07-21`  
**Roadmap:** `5.4.2.4`  
**Primitives:** `frontend/components/ui/toast.tsx`, `frontend/components/ui/inline-alert.tsx`  
**Host:** `ToastProvider` in `AppShell`

## Scope

| Surface | Use |
|---|---|
| Toast | Transient success/info after an action (auto-dismiss ~4.2s) |
| InlineAlert | Persistent in-page error/success that needs context or retry |

## Rules

1. Toast z-index: `--portal-z-toast` / `z-portal-toast`.
2. Tones: `neutral` | `success` | `warning` | `danger`.
3. Do not replace form field errors with toasts.
4. Do not use toast for blocking load failures — use `InlineAlert` / `EmptyState` / `PageErrorState`.

## Migrated consumers (this iteration)

- Lead create success → toast
- Lead workspace load/move/completion banners → `InlineAlert`
- Orders kanban move errors → `InlineAlert`

## Verification (owner)

1. Create lead successfully — bottom-right success toast.
2. Lead/order boards — error banners use shared alert chrome (not ad-hoc red boxes).

## Status

Owner confirmation: **`5.4.2 visual OK`** (`2026-07-21`).
