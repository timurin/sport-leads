import {
  Building2,
  ClipboardList,
  Factory,
  FileText,
  FolderCog,
  Layers,
  MapPin,
  Package,
  Ruler,
  Settings2,
  Shirt,
  SlidersHorizontal,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";

import { PageLayout } from "@/components/layout/page-layout";

const settingsGroups = [
  {
    title: "Справочники",
    description:
      "Основные данные для работы всех модулей ERP",
    icon: FolderCog,
    items: [
      {
        title: "Склады",
        description: "Места хранения материалов и продукции",
        href: "/settings/catalogs/warehouses",
        icon: Warehouse,
      },
      {
        title: "Контрагенты",
        description: "Клиенты, поставщики и партнёры",
        href: "/settings/catalogs/contractors",
        icon: Building2,
      },
      {
        title: "Ставки НДС",
        description: "Справочник ставок для заказов покупателя",
        href: "/settings/catalogs/vat-rates",
        icon: Settings2,
      },
    ],
  },
  {
    title: "Организации",
    description:
      "Юридическая и организационная структура компании",
    icon: Building2,
    items: [
      {
        title: "Организации",
        description: "ООО, ИП и другие юридические лица",
        href: "/settings/organizations",
        icon: Factory,
      },
      {
        title: "Сотрудники",
        description: "Сотрудники, должности и контакты",
        href: "/settings/organizations/employees",
        icon: Users,
      },
      {
        title: "Подразделения",
        description: "Отделы, участки и рабочие группы",
        href: "/settings/organizations/departments",
        icon: Building2,
      },
    ],
  },
  {
    title: "Номенклатура",
    description:
      "Единицы, типы и характеристики; каталог и категории — Склад → Номенклатура",
    icon: Package,
    items: [
      {
        title: "Номенклатура",
        description: "Каталог на складе: дерево категорий, список и создание",
        href: "/warehouse/stock",
        icon: Package,
      },
      {
        title: "Единицы измерения",
        description: "Штуки, комплекты, метры и килограммы",
        href: "/settings/catalogs/units-of-measure",
        icon: Ruler,
      },
      {
        title: "Характеристики номенклатуры",
        description: "Цвета, размеры и другие значения для карточек",
        href: "/settings/catalogs/product-characteristics",
        icon: Settings2,
      },
      {
        title: "Тип номенклатуры",
        description: "Системные типы: продукция, товары, материалы, услуги",
        href: "/settings/catalogs/nomenclature-types",
        icon: Settings2,
      },
    ],
  },
  {
    title: "База лекал",
    description: "Модели, виды изделий, размерные сетки и операции пошива",
    icon: Shirt,
    items: [
      {
        title: "Модели изделий",
        description: "Карточки моделей и варианты сборки",
        href: "/settings/catalogs/product-models",
        icon: Shirt,
      },
      {
        title: "Вид изделия",
        description: "Футболка, шорты и другие виды изделий",
        href: "/settings/catalogs/product-types",
        icon: Settings2,
      },
      {
        title: "Размерные сетки",
        description: "Сетки размеров для моделей",
        href: "/settings/catalogs/size-grids",
        icon: Ruler,
      },
      {
        title: "Операции пошива",
        description: "Справочник операций и стоимостей",
        href: "/settings/catalogs/sewing_operations",
        icon: Settings2,
      },
    ],
  },
  {
    title: "Производство",
    description: "Цеха, технологические операции и маршруты производства",
    icon: Factory,
    items: [
      {
        title: "Этапы",
        description: "Справочник цехов для маршрутов и технологических операций",
        href: "/settings/catalogs/production-stages",
        icon: Factory,
      },
      {
        title: "Тех операции",
        description: "Справочник операций для маршрутов и техкарт",
        href: "/settings/catalogs/tech-operations",
        icon: Settings2,
      },
      {
        title: "Маршруты",
        description: "Шаблоны маршрутов с этапами и рабочими центрами",
        href: "/settings/catalogs/routings",
        icon: Settings2,
      },
    ],
  },
  {
    title: "Техкарты",
    description:
      "Параметры технических карт производства (нумерация, поля поштучных строк, привязка участков)",
    icon: ClipboardList,
    items: [
      {
        title: "Техкарты",
        description: "Настройки раздела технических карт",
        href: "/settings/catalogs/tech-cards",
        icon: ClipboardList,
      },
    ],
  },
  {
    title: "Платформа",
    description:
      "Оболочка Администрирования Stage 18: системные параметры, платформенные справочники, печатные формы",
    icon: Layers,
    items: [
      {
        title: "Системные настройки",
        description: "Организация, часовой пояс, локаль и контакт поддержки",
        href: "/settings/system",
        icon: SlidersHorizontal,
      },
      {
        title: "Справочники платформы",
        description: "Реестр кросс-модульных справочников",
        href: "/settings/platform-directories",
        icon: FolderCog,
      },
      {
        title: "Города",
        description: "География клиентов, заказов и подсказок",
        href: "/settings/platform-directories/cities",
        icon: MapPin,
      },
      {
        title: "Печатные формы",
        description: "Реестр шаблонов печати (Stage 18.3)",
        href: "/settings/print-forms",
        icon: FileText,
      },
    ],
  },
  {
    title: "Доступ",
    description: "Учётные записи платформы и роли",
    icon: Users,
    items: [
      {
        title: "Пользователи",
        description: "PlatformUser и назначение ролей (ADR-024)",
        href: "/settings/users",
        icon: Users,
      },
    ],
  },
];

export default function SettingsPage() {
  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <div className="sl-design-v1 flex min-h-0 min-w-0 flex-1 flex-col gap-4 bg-portal-page p-portal-4 text-portal-text">
        <section className="sl-soft-panel flex flex-wrap items-start justify-between gap-3 p-portal-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                Настройки платформы
              </h1>
              <span className="rounded-full border border-portal-border px-2 py-0.5 text-portal-caption text-portal-muted">
                Hub
              </span>
            </div>
          </div>
          <Link
            href="/settings/users"
            className="portal-focus-ring inline-flex h-9 items-center justify-center rounded-lg border border-portal-border bg-portal-primary px-3 text-sm font-medium text-portal-primary-on"
          >
            Пользователи
          </Link>
        </section>

        {settingsGroups.map((group) => {
          const GroupIcon = group.icon;

          return (
            <section key={group.title} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-portal-lg border border-portal-border bg-portal-surface p-2.5 text-portal-primary">
                  <GroupIcon size={21} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{group.title}</h2>
                  <p className="text-sm text-portal-muted">{group.description}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="sl-soft-panel group flex items-start gap-4 p-portal-4 hover:bg-portal-state-hover"
                    >
                      <div className="rounded-portal-lg border border-portal-border bg-portal-page p-3 text-portal-muted">
                        <Icon size={22} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="mt-1 text-sm leading-5 text-portal-muted">
                          {item.description}
                        </p>
                        <div className="mt-3 text-sm font-medium text-portal-primary">
                          Открыть →
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </PageLayout>
  );
}
