import type {
  EntityRecord,
} from "@/types/entity/entity";

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