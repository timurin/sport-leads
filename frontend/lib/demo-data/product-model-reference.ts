export type {
  ProductModelVersionState,
  ProductModelVersionView as ProductModelVersion,
} from "@/lib/product-models";

import type { ProductModelVersionView } from "@/lib/product-models";

export type ProductModelReference = {
  id: string;
  code: string;
  name: string;
  nomenclatureLabel: string;
  versions: ProductModelVersionView[];
};

/** Demo-only PT-08 reference payload (`DS-PT-08`). */
export const productModelReference: ProductModelReference = {
  id: "demo-reference",
  code: "MDL-DEMO-01",
  name: "Демо-модель спортивной формы",
  nomenclatureLabel: "Форма игровая · арт. DEMO-100",
  versions: [
    {
      id: "v3",
      label: "v3 — черновик",
      state: "draft",
      updatedAt: "2026-07-20T14:30:00+03:00",
      author: "Дизайнер П.",
      isActive: true,
      isPublishedBaseline: false,
    },
    {
      id: "v2",
      label: "v2 — опубликована",
      state: "published",
      updatedAt: "2026-07-15T11:00:00+03:00",
      author: "Технолог С.",
      isActive: false,
      isPublishedBaseline: true,
    },
    {
      id: "v1",
      label: "v1 — архив",
      state: "archived",
      updatedAt: "2026-06-01T09:15:00+03:00",
      author: "Технолог С.",
      isActive: false,
      isPublishedBaseline: false,
    },
  ],
};
