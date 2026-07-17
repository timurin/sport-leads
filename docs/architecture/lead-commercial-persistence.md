# Коммерческие параметры лида

Итерация `v0.6.1-lead-commercial-frontend` подключает поддерживаемое моделью `Lead` ядро коммерческих параметров числовой detail-страницы к существующему `PATCH /leads/{lead_id}`.

## Источник истины

Для числовых лидов источником истины являются поля таблицы `leads`. Demo-маршруты `lead-1` и `lead-2` выбираются до API-запроса и сохраняют прежнее локальное поведение; ошибка backend не переключает числовой лид на demo-data.

## Постоянные поля

- `source` — источник лида;
- `sport` — вид спорта;
- `product_category` — категория продукции;
- `need_description` — описание потребности;
- `estimated_quantity` — предполагаемое количество;
- `estimated_amount` — предполагаемая сумма в `Numeric(14, 2)`;
- `desired_date` — желаемая дата готовности;
- `city` — город клиента/доставки в текущей модели лида.

Пустые значения отправляются как явный `null`, поэтому ранее сохранённое nullable-поле можно очистить. Ответ PATCH повторно преобразуется в frontend-модель и используется как подтверждённое состояние формы.

## Frontend-поток

1. `getLeadDetails` преобразует все поддерживаемые коммерческие поля ответа `LeadRead` через `fromApiLeadCommercial`.
2. Форма выполняет прежнюю клиентскую валидацию полного draft.
3. Для числового лида Server Action повторно проверяет недоверенные core-значения и вызывает существующий PATCH API.
4. При успехе `LeadPage` обновляет единое состояние и локальный timeline; при ошибке форма остаётся открытой и показывает ответ backend.
5. API URL и реализация запроса остаются в server-only data layer.

## Локальные расширенные поля

Текущая SQLAlchemy-модель не содержит direction, product type, kit quantity, sizes, preliminary budget, discount, probability, planned/event dates, delivery address/method/comment, campaign, UTM и priority. Форма сохраняет их только в состоянии текущей страницы и явно сообщает об этом. Они не выдаются за постоянные и не добавляются в модель скрыто в рамках этой итерации.

## Проверки

- `frontend/lib/sales/lead-commercial-api.test.mjs` проверяет API mapping, явное очищение и серверную валидацию mutation input;
- `backend/tests/test_lead_conversion.py::test_lead_commercial_fields_patch_persists_and_clears_values` проверяет PATCH, `Decimal`, дату, PostgreSQL-совместимые значения и очистку nullable-полей;
- typecheck, lint, production build, полный backend pytest и repository-wide project check подтверждают интеграцию.

## Ограничения

- полный профиль клиента и расширенные коммерческие поля пока локальны;
- список и Kanban лидов продолжают использовать demo-data;
- авторизация и проверка прав отсутствуют во всём текущем CRM API;
- создание и архивирование лидов не входят в эту итерацию.
