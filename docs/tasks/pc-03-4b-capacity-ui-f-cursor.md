# PC-03.4B — Capacity UI-F Frontend

## Контекст
Эта задача выполняется параллельно с Codex PC-03.4A.
Codex отвечает за backend/API/DB.
Cursor отвечает только за frontend UI-F.

## Цель
Реализовать экран:
**Производство → Очередь производства → Мощности**

на фиксированном capacity contract.

Если реальный API ещё не готов во время разработки:
- использовать локальный typed adapter/mock fixture;
- структура mock должна 1:1 соответствовать зафиксированному контракту;
- не придумывать альтернативный API.

## UI
Экран должен быть лёгким.

Показать:
- участки;
- ресурсы;
- базовую мощность;
- рабочие дни/часы;
- исключения по датам;
- простое редактирование.

Не превращать экран в ERP-справочник.

## Базовые ресурсы
Отобразить раздельно:
- Дизайнеры;
- Печатник / подготовка;
- Плоттер 1–4;
- Каландр;
- оператор каландра;
- общий пул раскройщиков;
- лазер;
- оператор лазера;
- пошив;
- бригада упаковки.

Закупка:
- показать как milestone/readiness;
- без hourly capacity.

## UX
Пользователь должен быстро:
1. увидеть текущую мощность;
2. изменить значение;
3. сохранить;
4. добавить исключение на дату;
5. удалить исключение.

Состояния:
- loading;
- error;
- empty;
- saved;
- invalid value.

## Не делать
- backend;
- migrations;
- API design;
- UI-A load indicators;
- Dashboard UI-G;
- Center UI-H;
- auto scheduling;
- conflict engine;
- redesign sidebar.

## Scope файлов
Только frontend:
- route/page UI-F;
- components;
- client/service adapter;
- frontend tests.

Не менять:
- backend;
- DB;
- weekly board;
- navigation, кроме исправления route import если текущий placeholder требует замены компонентом.

## Tests
- load settings;
- render resources;
- edit base capacity;
- create exception;
- delete exception;
- save success;
- API error;
- validation;
- responsive structure at code/component level.

## Проверки
- targeted frontend tests;
- full frontend tests;
- npm run lint;
- npx tsc --noEmit;
- production build;
- git diff --check.

## Acceptance
UI-F готов к интеграции, если:
- работает на typed fixed contract;
- не требует изменения backend payload;
- не затрагивает Production Queue UI-A;
- все frontend checks зелёные.

## Отчёт
Указать:
- components/routes;
- contract fields used;
- mock/adapter used or real API connected;
- tests/checks;
- подтвердить, что backend/DB/UI-A не менялись;
- отсутствие commit/push.
