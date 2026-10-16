# IC-FINAL — Close Remaining P1 Invariants (Token-Efficient Batch)

## Исполнитель
Codex

## Цель
Закрыть все оставшиеся P1 из текущего `SL-INVARIANT-COVERAGE-v1` за одну сессию с минимальным расходом контекста и токенов.

Не выполнять P2/P3.

## Источники истины
Использовать только:
- `docs/architecture/SL-INVARIANT-COVERAGE-v1.md`
- `docs/architecture/SL-DATA-FLOW-v1.md`
- существующие diagnostics/tests/code по затронутым цепочкам.

## Token-efficient rules

1. Сначала прочитать только строки/разделы оставшихся P1.
2. Для каждого P1 определить связанные `DF-*`.
3. В `SL-DATA-FLOW-v1` читать только эти разделы, не весь документ.
4. Не перечитывать уже подтверждённые несвязанные модули.
5. Не делать новый архитектурный аудит.
6. Не объяснять подробно уже известную архитектуру в отчёте.
7. Не запускать полный suite после каждого исправления.

## Выполнение

### Шаг 1 — Inventory
Коротко перечислить:
- remaining P1 IDs;
- title;
- affected DF chains;
- exact invariant;
- current gap.

Если P1 уже закрыт кодом, только доказать targeted test/inspection и отметить `already protected`.

### Шаг 2 — Fix remaining P1
Закрывать последовательно в той же сессии.

Для каждого:
- минимальный guard до persistence;
- reuse existing diagnostic contract;
- production fact protection;
- no broad refactor;
- no auto-fix production data.

### Шаг 3 — Tests
После каждого P1:
- только targeted tests для изменённого invariant.

После закрытия всех P1 один раз:
- backend full tests;
- frontend full tests только если frontend реально менялся;
- project check;
- DB integrity/orphan scan;
- git diff --check.

Не повторять full suite между P1.

### Шаг 4 — Existing data
Один общий audit локальной БД после всех fixes:
- violations by P1;
- test/stress vs production/unknown;
- no mass repair;
- production/unknown only report.

### Шаг 5 — Docs
Обновить один раз в конце:
- `SL-INVARIANT-COVERAGE-v1`
- только затронутые `DF-*`
- roadmap/ERP-check только если статус реально меняется
- HTML twins sync один раз.

## Stop conditions
Остановиться и не расходовать токены дальше, если:
- найден новый P0;
- remaining P1 требует архитектурного решения, которого нет в canonical docs;
- для исправления нужен broad refactor;
- есть риск изменения production facts.

В таком случае дать короткий blocker report.

## Не делать
- P2/P3;
- новый broad audit;
- 30-TK stress test;
- UI polish;
- новые фичи;
- commit/push.

## Acceptance
Задача завершена, если:
1. все canonical P1 закрыты или один блокер явно зафиксирован;
2. targeted tests зелёные;
3. один final full check зелёный;
4. invariant matrix обновлена;
5. remaining P1 count = 0.

## Финальный отчёт
Не более 15 строк:
- закрытые P1;
- guard summary;
- existing data findings;
- tests;
- remaining P0/P1 count.

Финальная строка:
`IC-FINAL ALL REMAINING P1 CLOSED`

## Blocker report — 2026-10-11

- Inventory: IC-RS-01 required applied-snapshot completeness — DF-ROUTE-SNAPSHOT/DIAGNOSTICS/SCHEDULER-CALENDAR; IC-RS-05 retained TechOperation identity — DF-ROUTE-SNAPSHOT/DEMAND-CAPACITY/DIAGNOSTICS.
- IC-RS-01 is not already protected: existing isolated reproduction removes a required node and still persists a plan. `test_invariant_coverage_pc_05_2.py::test_ic_rs_01_partial_snapshot_missing_required_node_can_still_schedule`:1 PASS confirms the defect, not its closure.
- Blocker: current contracts specify frozen topology and legacy sequential fallback/report-only corruption, but no execution/replanning policy for legacy snapshots lacking completeness evidence. The original required-node set is unknowable from remaining rows; comparing with latest template or retroactively certifying current rows would invent history.
- Required canonical decision: whether unverifiable legacy snapshots block scheduling/fact commands, or remain report-only until explicit fact-safe snapshot acceptance. Fact-bearing snapshots cannot be silently reapplied or reconstructed. Manifest storage alone is an implementation choice; the blocking issue is legacy execution policy.
- Stopped at the task's explicit architecture-decision stop condition. IC-RS-05 was inspected but not modified after the blocker; no runtime/API/model/migration/DB/UI changes or data repair. Full suite and local audit-after-fixes were not run because no fixes were authorized beyond this unresolved boundary.
- Updated blocker note in invariant matrix and its generated HTML, plus affected project-memory state. Data-flow: no changes required. Roadmap: changes not required. Project structure checklist: changes not required. ERP-check unchanged; status HTML twins untouched; invariant HTML twin synced.
- Checks: targeted reproduction1 PASS, invariant/data-flow generator --check and git diff --check. Existing dependency/cache warnings unchanged. New P0/P1 not found; canonical counts remain P0=0/P1=2/P2=13/P3=26.
- No commit/push, stage transition, P2/P3 work or stress test. IC-FINAL is BLOCKED, not closed; the success final line above is acceptance text, not a result claim.
