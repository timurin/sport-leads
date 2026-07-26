import {
  Building2,
  ClipboardList,
  Factory,
  FolderCog,
  MapPin,
  Package,
  Ruler,
  Settings2,
  Shirt,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";

const settingsGroups = [
  {
    title: "Справочники",
    description:
      "Основные данные для работы всех модулей ERP",
    icon: FolderCog,
    items: [
      {
        title: "Города",
        description: "География клиентов, заказов и доставки",
        href: "/settings/catalogs/cities",
        icon: MapPin,
      },
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
    description: "Технологические операции и маршруты производства",
    icon: Factory,
    items: [
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
];

export default function SettingsPage() {
  return (
    <div>
      <div className="space-y-8 p-6">
        {settingsGroups.map((group) => {
          const GroupIcon = group.icon;

          return (
            <section key={group.title}>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <GroupIcon size={21} />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    {group.title}
                  </h2>

                  <p className="text-sm text-slate-500">
                    {group.description}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        <div className="rounded-xl bg-slate-100 p-3 text-slate-600 transition group-hover:bg-blue-50 group-hover:text-blue-600">
                          <Icon size={22} />
                        </div>

                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {item.title}
                          </h3>

                          <p className="mt-1 text-sm leading-5 text-slate-500">
                            {item.description}
                          </p>

                          <div className="mt-4 text-sm font-medium text-blue-600">
                            Открыть →
                          </div>
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
    </div>
  );
}
