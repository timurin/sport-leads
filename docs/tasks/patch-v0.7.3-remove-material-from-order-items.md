Исправить архитектурную ошибку v0.7.3: Material не является номенклатурой
позиции заказа.

Сохранить SalesOrderItem, CRUD, snapshot-поля, суммы и UI.

Удалить необязательную связь SalesOrderItem → Material из модели, схем,
API, frontend, миграции и тестов. Если миграция v0.7.3 ещё не применена
в общей среде и не закоммичена — исправить исходную миграцию. Если уже
зафиксирована или применена — создать отдельную обратимую миграцию.

Позиция заказа должна пока хранить:
- snapshot_name;
- unit;
- quantity;
- unit_price;
- line_amount.

Не создавать Product, Nomenclature, Specification и производственные
сущности в этом patch.

В roadmap и ERP-check зафиксировать архитектурное правило:
- номенклатура заказа не является Material;
- Specification содержит материалы и операции;
- Specification в будущем назначается на заказ целиком или на отдельную
SalesOrderItem;
- спецификация позиции имеет приоритет над общей спецификацией заказа.

Прогнать backend/frontend tests, TypeScript, lint, build, Alembic,
project check и git diff --check.

Commit и push не выполнять.