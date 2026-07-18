# ADR-002 — SalesOrder → Organization

**Статус:** принято  
**Контекст:** заказ должен сохранять организацию клиента независимо от frontend demo-справочников.

## Решение

Использовать persistent `Organization` и nullable `SalesOrder.organization_id` для совместимости с историческими заказами. При конвертации организация создаётся или переиспользуется по доступным реквизитам; назначение проверяется service-слоем.

## Последствия

Заказ имеет устойчивую связь с организацией, а старые записи могут быть дополнены без destructive migration.

## Ограничения

Полноценные настройки организаций и административный контур пока не завершены.

**Связанные модули:** `backend/app/models/sales.py`, `backend/app/services/lead_conversion.py`, `backend/app/services/sales_order_organization.py`.
