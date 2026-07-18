# Документация Sport-Lead

## Архитектура

- [Каноническая структура платформы — SL-PROJECT-STRUCTURE-v1](architecture/project-structure.md)
- [Канонический ERP-check — SL-ERP-CHECK-v1](architecture/erp-check.md)
- [Архитектурные решения — ADR](architecture/decisions/)

## План развития

- [Канонический roadmap — SL-ROADMAP-v1](roadmap/roadmap.md)

Исторические roadmap и ERP-check сохранены в `docs/archive/`.

## Процесс

- [Development workflow](process/development-workflow.md)
- [Стиль задач Codex](process/codex-task-style.md)
- [Release checklist](process/release-checklist.md)

## Контрольные точки

- [Последняя функциональная контрольная точка — v0.5.0](releases/v0.5.0.md)
- [v0.3.0-demo checkpoint](checkpoints/v0.3.0-demo.md)

## Инструкции Codex

- [Корневые правила Codex](../AGENTS.md)

## Development seed

Explicit local seed for backend sales leads:

```powershell
$env:SPORT_LEADS_ALLOW_DEV_SEED='1'
.\.venv\Scripts\python.exe scripts\seed_sales_dev.py
```

The command is idempotent and updates fixed development records instead of creating duplicates. It is guarded by `SPORT_LEADS_ALLOW_DEV_SEED=1` and refuses to run when `APP_ENV` or `ENVIRONMENT` is `production`.
