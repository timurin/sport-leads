# PC-03.6A — Operation date range contract

Implemented 2026-10-06. Backend only; PC-03 remains open.

## Persistence and migration

`CalendarAssignment.planned_date` remains the physical start column and the legacy API field. `planned_start_date` is its ORM synonym; no duplicate start state. New non-null `planned_end_date` has CHECK `planned_end_date >= planned_date`. Migration `x3y4z5a6b789` follows `w2x3y4z5a678`, backfills end=start and is reversible. Downgrade keeps assignments and their start dates, but discards end dates; re-upgrade restores single-day ranges.

## API

- POST `/production-calendar/assignments` unchanged: `technical_card_id`, `planned_date`, optional `note`. Server assigns launch preparation and tail position; start=end. Range fields on POST are rejected as extra fields.
- PUT `/production-calendar/assignments/{id}` keeps required `production_stage_id`, optional `position` (default 0) and `note` (default null). Supply `planned_start_date` or legacy `planned_date`, with optional `planned_end_date`. Missing end means end=start, including legacy moves of multi-day entries. This is a replacement contract, not PATCH; end-only edits are unsupported.
- If both start aliases are supplied, they must match. Explicit null dates, invalid dates, missing start and end<start return 422 before any mutation. Existing stage/reference validation, permissions and pair uniqueness stay in place.
- GET `/production-calendar/board?from=YYYY-MM-DD&to=YYYY-MM-DD&stage_id=ID` returns each matching assignment once when `planned_date <= to AND planned_end_date >= from`, inclusive. Optional stage filter remains effective. Existing sorting is start/stage/position/id.
- Assignment response keeps all previous fields and adds required ISO dates `planned_start_date` and `planned_end_date`; `planned_date == planned_start_date`. Quantity and technical-card/order references still come from the existing joined source read.

Example PUT:

```json
{"production_stage_id": 2, "planned_start_date": "2026-10-03", "planned_end_date": "2026-10-08", "position": 7, "note": "Span"}
```

This assignment is included in the board for 2026-10-05 through 2026-10-11 with its full original range. No clipping, duplicated daily records, automatic duration, capacity allocation, dependency engine or workflow changes. Frontend integration/visuals belong to PC-03.6B.

## Evidence

`backend/tests/test_production_calendar_date_range.py`: single-day create/legacy rows, multi-day edit, durable reload, inclusive overlaps/contained periods/week boundaries, stage filter, invalid dates/ranges without mutation, legacy moves. Migration verified on local PostgreSQL :5432 with upgrade/downgrade/upgrade and isolated transactional backfill of a legacy record. See task execution report for final suite results.
