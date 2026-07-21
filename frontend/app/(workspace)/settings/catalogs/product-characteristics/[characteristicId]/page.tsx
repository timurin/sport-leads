import Link from "next/link";

import {
  createCharacteristicOption,
  updateCharacteristic,
  updateCharacteristicOption,
} from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import {
  getCharacteristicDefinitions,
  getCharacteristicOptions,
} from "@/lib/nomenclature";

export default async function ProductCharacteristicPage({
  params,
}: {
  params: Promise<{ characteristicId: string }>;
}) {
  const { characteristicId } = await params;
  const id = Number(characteristicId);
  const [definitions, options] = await Promise.all([
    getCharacteristicDefinitions(),
    getCharacteristicOptions(id),
  ]);
  const definition = definitions.find((item) => item.id === id);

  if (!definition) {
    return (
      <div className="product-characteristics-page">
        <div className="product-characteristics-main">
          Характеристика не найдена.
        </div>
      </div>
    );
  }

  const kindLabel = definition.kind === "COLOR" ? "Цвет" : "Список";

  return (
    <div className="product-characteristics-page">
      <div className="product-characteristics-main">
        <div className="product-characteristics-breadcrumbs">
          <Link href="/settings/catalogs/product-characteristics">
            Характеристики номенклатуры
          </Link>
          <span>›</span>
          {definition.name}
        </div>
        <div className="product-characteristics-header">
          <div>
            <h1>{definition.name}</h1>
            <div className="product-characteristics-subtitle">
              Карточка характеристики номенклатуры
            </div>
          </div>
          <Link
            href="/settings/catalogs/product-characteristics"
            className="product-characteristics-btn"
          >
            ← К списку
          </Link>
        </div>

        <section className="product-characteristics-card product-characteristics-detail-card">
          <div className="product-characteristics-card-pad">
            <div className="product-characteristics-detail-heading">
              <div>
                <h2>Основная информация</h2>
                <p>Системные реквизиты и наименование характеристики.</p>
              </div>
              <span
                className={`product-characteristics-status ${definition.is_active ? "" : "off"}`}
              >
                {definition.is_active ? "Активна" : "Неактивна"}
              </span>
            </div>
            <form
              action={updateCharacteristic}
              className="product-characteristics-detail-form"
            >
              <input type="hidden" name="id" value={id} />
              <input
                type="hidden"
                name="is_active"
                value={String(definition.is_active)}
              />
              <label>
                Код
                <span className="product-characteristics-field-hint">
                  Системный код
                </span>
                <input
                  value={id}
                  readOnly
                  className="product-characteristics-input product-characteristics-readonly"
                />
              </label>
              <label>
                Тип
                <span className="product-characteristics-field-hint">
                  Тип значений характеристики
                </span>
                <input
                  value={kindLabel}
                  readOnly
                  className="product-characteristics-input product-characteristics-readonly"
                />
              </label>
              <label>
                Наименование
                <span className="product-characteristics-field-hint">
                  Отображаемое название
                </span>
                <input
                  name="name"
                  defaultValue={definition.name}
                  required
                  className="product-characteristics-input"
                />
              </label>
              <div className="product-characteristics-detail-actions">
                <button className="product-characteristics-btn primary" type="submit">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="product-characteristics-card product-characteristics-options-card">
          <div className="product-characteristics-card-pad">
            <div className="product-characteristics-detail-heading">
              <div>
                <h2>Значения характеристики</h2>
                <p>Значения, доступные для выбора в номенклатуре.</p>
              </div>
            </div>
            <form
              action={createCharacteristicOption}
              className="product-characteristics-create-form"
            >
              <input type="hidden" name="characteristic_id" value={id} />
              <input
                name="code"
                required
                placeholder="Код значения"
                pattern="[a-z0-9][a-z0-9_-]*"
                className="product-characteristics-input"
              />
              <input
                name="label"
                required
                placeholder="Отображаемое значение"
                className="product-characteristics-input"
              />
              {definition.kind === "COLOR" ? (
                <input
                  name="hex_value"
                  required
                  placeholder="#000000"
                  pattern="#[0-9A-Fa-f]{6}"
                  className="product-characteristics-input"
                />
              ) : null}
              <button className="product-characteristics-btn primary" type="submit">
                Добавить значение
              </button>
            </form>
          </div>
          <div className="product-characteristics-table-wrap">
            <table className="product-characteristics-table">
              <thead>
                <tr>
                  <th>Значение</th>
                  <th>HEX</th>
                  <th>Порядок</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {options.map((option) => (
                  <tr key={option.id}>
                    <td>
                      <div className="product-characteristics-row-name">
                        <span className="product-characteristics-type-icon">
                          {definition.kind === "COLOR" ? "◉" : "Aa"}
                        </span>
                        <span>
                          {option.label}
                          <small>{option.code}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {option.hex_value ? (
                        <span className="product-characteristics-color-value">
                          <i style={{ backgroundColor: option.hex_value }} />
                          {option.hex_value}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{option.sort_order}</td>
                    <td>
                      <span
                        className={`product-characteristics-status ${option.is_active ? "" : "off"}`}
                      >
                        {option.is_active ? "Активно" : "Отключено"}
                      </span>
                    </td>
                    <td>
                      <form action={updateCharacteristicOption}>
                        <input type="hidden" name="id" value={option.id} />
                        <input
                          type="hidden"
                          name="characteristic_id"
                          value={id}
                        />
                        <input type="hidden" name="label" value={option.label} />
                        <input
                          type="hidden"
                          name="sort_order"
                          value={option.sort_order}
                        />
                        <input
                          type="hidden"
                          name="hex_value"
                          value={option.hex_value ?? ""}
                        />
                        <input
                          type="hidden"
                          name="is_active"
                          value={String(!option.is_active)}
                        />
                        <button
                          className="product-characteristics-btn"
                          type="submit"
                        >
                          {option.is_active ? "Отключить" : "Активировать"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
