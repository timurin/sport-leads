# PC-06.4A — Capacities: live UI integration (Cursor)

## Context / sources
- Start from clean `main` >= `9d89663`; inspect `AGENTS.md`, `SL-PROJECT-MEMORY-v1` PM-CAPACITY, `SL-UI-CONTEXT-v1` UI-CALENDAR, `docs/design/production-calendar/screens/capacity-settings.md` (approved UI-F).
- Runtime contracts: `docs/architecture/production-calendar-shared-capacity-pc-03-7a.md`, `work-center-capacity-pc-04-4d.md`; current page `frontend/components/production/calendar-capacity-settings.tsx`, existing clients/actions. If design and live API differ, live backend contract is authoritative; document the exact gap, never fabricate data.

## Goal
Make `/production/calendar/capacity` useful as a live capacities workspace using **existing canonical** CapacityResource, WorkCenter, date exception and load APIs. Current page is primarily a read-only monitor; avoid a second capacity store, duplicated formulas or replacing approved shell/UI.

## Scope
1. Check current page/data/actions and existing operation/equipment settings UI to identify the smallest missing management flows. Reuse existing edit controls/navigation where complete; otherwise add narrowly scoped edit UI for resource base settings and dated exceptions to the capacity page, with saved/reload persistence, validation and error states. Do **not** rebuild settings already available in the tech-operation catalog.
2. Keep resource and physical equipment identities distinct; show configured/unconfigured, daily availability, saved allocations, remainder and utilization **only where canonical backend fields support it**. For labor without reliable occupancy, explicitly show unknown rather than fake 0 or percentage. Separate units; no aggregate mixed-unit load percent.
3. Support date selection and selected period, relevant filters, drilldown/edit affordances, pending/failed saves and stale load refresh. Preserve existing correct status/data and use backend for all calculations. Avoid N+1 requests.
4. Match approved UI-F where compatible with present APIs and portal design system; responsive 1440/1024/768/390/320. No horizontal page overflow (table-local scroll okay).
5. Add focused frontend tests for settings/exception persistence, unknown/zero/nonworking day, overload, unavailable machine, API errors/retry and date switching. Run affected frontend checks and `scripts/check_project.py` once if environment supports it.

## Limits
- No new DB/migration/backend Scheduler/Demand, route, calendar assignment or production fact changes; no test data writes to production.
- No invented design norms, operator occupancy, staff roster, color profiles, machine count or unit conversion. Existing guarded permissions and audit must remain intact.
- Do not change PC-06.1B status or close the entire PC-06 stage. If a required backend capability is absent, stop that portion, describe precise endpoint/field gap, and prepare next backend slice instead of implementing frontend arithmetic.
- No git commit/push/deploy during implementation unless the owner explicitly authorizes release. End-of-day release policy is commit → push main → deploy → live `sport-lead.ru` verification.

## Done / report
- Saved base settings and dated exceptions demonstrably reload from real API (or documented backend blocker); capacity monitoring correct for available API and explicit for unknown.
- Targeted tests + responsive verification; no regressions in existing operation/equipment settings.
- Update only affected canonical docs and HTML twins if behavior/status changed. Report changed files, checks, outstanding gaps, deployment readiness, and `Project memory: no changes required` if unchanged.
