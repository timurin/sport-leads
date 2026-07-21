"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  createCharacteristic,
  updateCharacteristic,
} from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import type { CharacteristicDefinition } from "@/lib/nomenclature";

const kindLabels = { COLOR: "Цвет", LIST: "Список (одно значение)" } as const;

export function ProductCharacteristicsWorkspace({
  definitions,
  optionCounts,
}: {
  definitions: CharacteristicDefinition[];
  optionCounts: Record<number, number>;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [active, setActive] = useState("");
  const filtered = useMemo(
    () =>
      definitions.filter((definition) => {
        const matchesQuery =
          !query.trim() ||
          `${definition.name} ${definition.code}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase());
        return (
          matchesQuery &&
          (!kind || definition.kind === kind) &&
          (!active ||
            (active === "active" ? definition.is_active : !definition.is_active))
        );
      }),
    [active, definitions, kind, query],
  );

  return (
    <div className="product-characteristics-page">
      <div className="product-characteristics-main">
        <div className="product-characteristics-breadcrumbs">
          Настройки <span>›</span> Характеристики номенклатуры
        </div>
        <div className="product-characteristics-header">
          <div>
            <h1>Характеристики номенклатуры</h1>
            <div className="product-characteristics-subtitle">
              Справочник характеристик, используемых в номенклатуре и вариантах.
            </div>
          </div>
        </div>
        <div className="product-characteristics-content">
          <section className="product-characteristics-card product-characteristics-list-card">
            <div className="product-characteristics-table-wrap">
              <table className="product-characteristics-table">
                <thead>
                  <tr>
                    <th>Наименование</th>
                    <th>Код</th>
                    <th>Тип значения</th>
                    <th>Значений</th>
                    <th>Активность</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((definition) => (
                    <tr key={definition.id}>
                      <td>
                        <div className="product-characteristics-row-name">
                          <span className="product-characteristics-type-icon">
                            {definition.kind === "COLOR" ? "◉" : "Aa"}
                          </span>
                          <span>{definition.name}</span>
                        </div>
                      </td>
                      <td>{definition.code}</td>
                      <td>{kindLabels[definition.kind]}</td>
                      <td>{optionCounts[definition.id] ?? 0}</td>
                      <td>
                        <span
                          className={`product-characteristics-status ${definition.is_active ? "" : "off"}`}
                        >
                          {definition.is_active ? "Активна" : "Неактивна"}
                        </span>
                      </td>
                      <td>
                        <div className="product-characteristics-actions">
                          <Link
                            href={`/settings/catalogs/product-characteristics/${definition.id}`}
                            className="product-characteristics-btn icon"
                            aria-label={`Открыть ${definition.name}`}
                          >
                            ↗
                          </Link>
                          <form action={updateCharacteristic}>
                            <input type="hidden" name="id" value={definition.id} />
                            <input
                              type="hidden"
                              name="name"
                              value={definition.name}
                            />
                            <input
                              type="hidden"
                              name="is_active"
                              value={String(!definition.is_active)}
                            />
                            <button
                              className="product-characteristics-btn icon"
                              type="submit"
                              aria-label={
                                definition.is_active
                                  ? `Отключить ${definition.name}`
                                  : `Активировать ${definition.name}`
                              }
                            >
                              ↯
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="product-characteristics-footer">
              <span>Всего: {filtered.length}</span>
            </div>
          </section>
          <aside className="product-characteristics-tools">
            <section className="product-characteristics-card product-characteristics-tool-card">
              <div className="product-characteristics-card-pad">
                <h2>Создание характеристики</h2>
                <form
                  action={createCharacteristic}
                  className="product-characteristics-create-form"
                >
                  <input
                    name="name"
                    required
                    placeholder="Название характеристики"
                    className="product-characteristics-input"
                  />
                  <input
                    name="code"
                    placeholder="Код (необязательно)"
                    pattern="[a-z0-9][a-z0-9_-]*"
                    className="product-characteristics-input"
                  />
                  <select
                    name="kind"
                    defaultValue="LIST"
                    className="product-characteristics-select"
                  >
                    <option value="LIST">Список</option>
                    <option value="COLOR">Цвет</option>
                  </select>
                  <button className="product-characteristics-btn primary" type="submit">
                    Создать
                  </button>
                </form>
              </div>
            </section>
            <section className="product-characteristics-card product-characteristics-tool-card">
              <div className="product-characteristics-card-pad">
                <h2>Поиск</h2>
                <div className="product-characteristics-filter-form">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="product-characteristics-input"
                    placeholder="Поиск по наименованию или коду"
                  />
                  <select
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                    className="product-characteristics-select"
                  >
                    <option value="">Все типы</option>
                    <option value="COLOR">Цвет</option>
                    <option value="LIST">Список</option>
                  </select>
                  <select
                    value={active}
                    onChange={(event) => setActive(event.target.value)}
                    className="product-characteristics-select"
                  >
                    <option value="">Все статусы</option>
                    <option value="active">Активные</option>
                    <option value="inactive">Неактивные</option>
                  </select>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
