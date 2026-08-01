export type PatternModelSalesRow = {
  product_model_id: number | null;
  product_model_article: string;
  product_model_name: string | null;
  order_count: number;
  units_ordered: number;
  units_manufactured: number;
  order_amount: number;
  sewing_cost_amount: number;
};

export type PatternModelSalesResult =
  | { ok: true; items: PatternModelSalesRow[] }
  | { ok: false; message: string; items: [] };
