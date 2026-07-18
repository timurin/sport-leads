# Документация Sport-Lead

## Архитектура

- [Актуальная структура платформы — SL-ERP-CHECK-v0.3.0](architecture/SL-ERP-CHECK-v0.3.0.md)

## План развития

- [Актуальный roadmap — SL-ROADMAP-v0.6.1](roadmap/SL-ROADMAP-v0.6.1.md)
- [Исторический roadmap — SL-ROADMAP-v0.3.0](roadmap/SL-ROADMAP-v0.3.0.md)

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
