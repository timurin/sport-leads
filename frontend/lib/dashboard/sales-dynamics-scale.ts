/** Round a raw max up to 1 / 2 / 5 × 10^n so Y ticks stay readable. */
export function niceAxisMax(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const n = raw / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * exp;
}

export function dynamicsSeriesTotals(
  points: ReadonlyArray<{
    leads: number;
    deals: number;
    orders: number;
    orderAmount: number;
  }>,
) {
  return points.reduce(
    (acc, point) => ({
      leads: acc.leads + point.leads,
      deals: acc.deals + point.deals,
      orders: acc.orders + point.orders,
      orderAmount: acc.orderAmount + point.orderAmount,
    }),
    { leads: 0, deals: 0, orders: 0, orderAmount: 0 },
  );
}
