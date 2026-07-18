export const leadFinalActions = Object.freeze([
  Object.freeze({ id: "convert", title: "Оформить заказ" }),
  Object.freeze({ id: "reject", title: "Закрыть с отказом" }),
] as const);

export type LeadFinalActionId = (typeof leadFinalActions)[number]["id"];
