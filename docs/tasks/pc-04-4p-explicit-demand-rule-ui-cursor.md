# PC-04.4P — Explicit Demand Rule UI

## Исполнитель
Cursor

## Зависимость
Начинать после PC-04.4O.

## Цель
В `/settings/catalogs/tech-operations` сделать ошибку `Как рассчитывается потребность` реально исправляемой администратором.

## UI
Для режима `По заданной норме времени` показать редактируемый блок:

### Как рассчитывается потребность
`Основа расчёта`
- `Фиксированное время на техкарту`
- `Время на одно изделие`

`Норма времени`
- числовое поле;
- понятная единица `мин.` или текущая backend unit.

Пример-подсказка:
- fixed: `60 мин. → 1 чел.-ч на техкарту`
- per_item: `2 мин. × 100 шт. → 3 ч 20 мин.`

## Diagnostics
Стикер должен вести на этот блок и конкретное поле.
После сохранения валидной нормы:
- readiness обновляется;
- diagnostic исчезает;
- Routing/TechnicalCard после revalidate показывают тот же результат.

Не показывать internal code `missing_operator_norm` в основном UI.

## Не менять
- backend semantics;
- Scheduler;
- Capacity;
- WorkCenter;
- ONE OF;
- VIS-STRESS.

## Tests
- оба режима;
- empty value;
- save/reload;
- diagnostic focus;
- readiness refresh;
- frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

Финальная строка:
`PC-04.4P EXPLICIT DEMAND RULE UI READY FOR OWNER REVIEW`
