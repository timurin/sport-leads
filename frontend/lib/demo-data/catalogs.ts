import type {
  EntityRecord,
} from "@/types/entity/entity";

export const materialRecords: EntityRecord[] = [
  {
    id: "material-1",
    title: "Ложная сетка 135 г/м²",
    subtitle: "Ткань для спортивной формы",
    updatedAt: "Сегодня, 10:40",
    status: {
      id: "active",
      title: "Активен",
      colorClass:
        "bg-emerald-50 text-emerald-700",
    },
    fields: [
      {
        id: "article",
        label: "Артикул",
        value: "FAB-MESH-135",
      },
      {
        id: "category",
        label: "Категория",
        value: "Ткань",
      },
      {
        id: "unit",
        label: "Единица измерения",
        value: "м",
      },
      {
        id: "balance",
        label: "Остаток",
        value: 860,
      },
      {
        id: "minimum",
        label: "Минимальный остаток",
        value: 200,
      },
      {
        id: "warehouse",
        label: "Склад",
        value: "Основной склад",
      },
    ],
  },
  {
    id: "material-2",
    title: "Интерлок 160 г/м²",
    subtitle: "Ткань для футболок и формы",
    updatedAt: "Вчера, 16:20",
    status: {
      id: "active",
      title: "Активен",
      colorClass:
        "bg-emerald-50 text-emerald-700",
    },
    fields: [
      {
        id: "article",
        label: "Артикул",
        value: "FAB-INT-160",
      },
      {
        id: "category",
        label: "Категория",
        value: "Ткань",
      },
      {
        id: "unit",
        label: "Единица измерения",
        value: "м",
      },
      {
        id: "balance",
        label: "Остаток",
        value: 410,
      },
      {
        id: "minimum",
        label: "Минимальный остаток",
        value: 150,
      },
      {
        id: "warehouse",
        label: "Склад",
        value: "Основной склад",
      },
    ],
  },
  {
    id: "material-3",
    title: "Молния потайная 20 см",
    subtitle: "Фурнитура",
    updatedAt: "15 июля, 12:15",
    status: {
      id: "low-stock",
      title: "Мало на складе",
      colorClass:
        "bg-amber-50 text-amber-700",
    },
    fields: [
      {
        id: "article",
        label: "Артикул",
        value: "ZIP-HID-20",
      },
      {
        id: "category",
        label: "Категория",
        value: "Фурнитура",
      },
      {
        id: "unit",
        label: "Единица измерения",
        value: "шт.",
      },
      {
        id: "balance",
        label: "Остаток",
        value: 75,
      },
      {
        id: "minimum",
        label: "Минимальный остаток",
        value: 100,
      },
      {
        id: "warehouse",
        label: "Склад",
        value: "Склад фурнитуры",
      },
    ],
  },
];

export const organizationRecords: EntityRecord[] = [
  {
    id: "organization-1",
    title: "ООО «Кр»",
    subtitle: "Производственная организация",
    updatedAt: "Сегодня, 09:10",
    status: {
      id: "active",
      title: "Активна",
      colorClass:
        "bg-emerald-50 text-emerald-700",
    },
    fields: [
      {
        id: "legalForm",
        label: "Форма",
        value: "ООО",
      },
      {
        id: "inn",
        label: "ИНН",
        value: "7700000000",
      },
      {
        id: "kpp",
        label: "КПП",
        value: "770001001",
      },
      {
        id: "taxSystem",
        label: "Налогообложение",
        value: "УСН",
      },
      {
        id: "director",
        label: "Руководитель",
        value: "Тимур",
      },
      {
        id: "legalAddress",
        label: "Юридический адрес",
        value: "Москва",
      },
    ],
  },
  {
    id: "organization-2",
    title: "ИП",
    subtitle: "Организация продаж",
    updatedAt: "Вчера, 14:30",
    status: {
      id: "active",
      title: "Активна",
      colorClass:
        "bg-emerald-50 text-emerald-700",
    },
    fields: [
      {
        id: "legalForm",
        label: "Форма",
        value: "ИП",
      },
      {
        id: "inn",
        label: "ИНН",
        value: "000000000000",
      },
      {
        id: "kpp",
        label: "КПП",
        value: "—",
      },
      {
        id: "taxSystem",
        label: "Налогообложение",
        value: "УСН",
      },
      {
        id: "director",
        label: "Руководитель",
        value: "Тимур",
      },
      {
        id: "legalAddress",
        label: "Юридический адрес",
        value: "Москва",
      },
    ],
  },
];

export const employeeRecords: EntityRecord[] = [
  {
    id: "employee-1",
    title: "Мария Иванова",
    subtitle: "Менеджер отдела продаж",
    updatedAt: "Сегодня, 15:05",
    status: {
      id: "working",
      title: "Работает",
      colorClass:
        "bg-emerald-50 text-emerald-700",
    },
    fields: [
      {
        id: "position",
        label: "Должность",
        value: "Менеджер по продажам",
      },
      {
        id: "department",
        label: "Подразделение",
        value: "Отдел продаж",
      },
      {
        id: "organization",
        label: "Организация",
        value: "ИП",
      },
      {
        id: "phone",
        label: "Телефон",
        value: "+7 999 100-20-30",
      },
      {
        id: "email",
        label: "Email",
        value: "m.ivanova@mosmade.ru",
      },
      {
        id: "employmentDate",
        label: "Дата приёма",
        value: "10.02.2024",
      },
    ],
  },
  {
    id: "employee-2",
    title: "Алексей Смирнов",
    subtitle: "Менеджер отдела продаж",
    updatedAt: "Сегодня, 13:40",
    status: {
      id: "working",
      title: "Работает",
      colorClass:
        "bg-emerald-50 text-emerald-700",
    },
    fields: [
      {
        id: "position",
        label: "Должность",
        value: "Менеджер по продажам",
      },
      {
        id: "department",
        label: "Подразделение",
        value: "Отдел продаж",
      },
      {
        id: "organization",
        label: "Организация",
        value: "ИП",
      },
      {
        id: "phone",
        label: "Телефон",
        value: "+7 999 200-30-40",
      },
      {
        id: "email",
        label: "Email",
        value: "a.smirnov@mosmade.ru",
      },
      {
        id: "employmentDate",
        label: "Дата приёма",
        value: "18.04.2024",
      },
    ],
  },
  {
    id: "employee-3",
    title: "Дмитрий Петров",
    subtitle: "Дизайнер",
    updatedAt: "Вчера, 18:10",
    status: {
      id: "working",
      title: "Работает",
      colorClass:
        "bg-emerald-50 text-emerald-700",
    },
    fields: [
      {
        id: "position",
        label: "Должность",
        value: "Дизайнер",
      },
      {
        id: "department",
        label: "Подразделение",
        value: "Дизайн",
      },
      {
        id: "organization",
        label: "Организация",
        value: "ООО «Кр»",
      },
      {
        id: "phone",
        label: "Телефон",
        value: "+7 999 300-40-50",
      },
      {
        id: "email",
        label: "Email",
        value: "d.petrov@mosmade.ru",
      },
      {
        id: "employmentDate",
        label: "Дата приёма",
        value: "04.09.2023",
      },
    ],
  },
];