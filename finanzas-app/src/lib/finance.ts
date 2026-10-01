import type { SupabaseClient } from "@supabase/supabase-js";
import { applyMonthlyIsrTariff, ISR_TABLE_YEAR } from "./isr-table";

export { ISR_TABLE_YEAR };

export type MovementRow = {
  id: string;
  movement_date: string;
  amount: number;
  movement_type_id: string;
  supplier_id: string | null;
  category_id: string | null;
  payment_method_id: string;
  tax_status: "no_invoice" | "pending_invoice" | "invoiced";
  tax_iva_amount: number;
  movement_type: { code: string; name: string; affects_cash_flow: boolean; affects_result: string } | null;
  supplier: { name: string } | null;
  category: { name: string } | null;
  payment_method: { name: string } | null;
};

export type SaleRow = {
  id: string;
  sale_date: string;
  num_orders: number;
  num_products: number;
  cash_amount: number;
  card_amount: number;
  transfer_amount: number;
  total_amount: number;
  sales_iva_amount: number;
};

export async function fetchSales(supabase: SupabaseClient, from: string, to: string) {
  const { data } = await supabase
    .from("sales")
    .select("id, sale_date, num_orders, num_products, cash_amount, card_amount, transfer_amount, total_amount, sales_iva_amount")
    .gte("sale_date", from)
    .lte("sale_date", to)
    .is("voided_at", null)
    .order("sale_date");
  return (data ?? []) as SaleRow[];
}

export async function fetchMovements(supabase: SupabaseClient, from: string, to: string) {
  const { data } = await supabase
    .from("financial_movements")
    .select(
      "id, movement_date, amount, movement_type_id, supplier_id, category_id, payment_method_id, tax_status, tax_iva_amount, movement_type:movement_types(code, name, affects_cash_flow, affects_result), supplier:suppliers(name), category:expense_categories(name), payment_method:payment_methods(name)"
    )
    .gte("movement_date", from)
    .lte("movement_date", to)
    .is("voided_at", null)
    .order("movement_date");
  return (data ?? []) as unknown as MovementRow[];
}

export function summarize(sales: SaleRow[], movements: MovementRow[]) {
  const salesTotal = sales.reduce((s, r) => s + Number(r.total_amount), 0);
  const cash = sales.reduce((s, r) => s + Number(r.cash_amount), 0);
  const card = sales.reduce((s, r) => s + Number(r.card_amount), 0);
  const transfer = sales.reduce((s, r) => s + Number(r.transfer_amount), 0);
  const orders = sales.reduce((s, r) => s + Number(r.num_orders), 0);
  const products = sales.reduce((s, r) => s + Number(r.num_products), 0);

  const movementsTotal = movements.reduce((s, m) => s + Number(m.amount), 0);
  const resultAffecting = movements
    .filter((m) => m.movement_type?.affects_result === "si" || m.movement_type?.affects_result === "diferido")
    .reduce((s, m) => s + Number(m.amount), 0);

  const resultEstimated = salesTotal - resultAffecting;
  const margin = salesTotal > 0 ? (resultEstimated / salesTotal) * 100 : 0;
  const netCashFlow = salesTotal - movementsTotal;
  const avgTicket = orders > 0 ? salesTotal / orders : 0;
  const dayCount = new Set(movements.map((m) => m.movement_date)).size;
  const avgDailyExpense = dayCount > 0 ? movementsTotal / dayCount : 0;

  return {
    salesTotal,
    cash,
    card,
    transfer,
    orders,
    products,
    avgTicket,
    movementsTotal,
    resultAffecting,
    resultEstimated,
    margin,
    netCashFlow,
    avgDailyExpense,
  };
}

export const AVG_DAYS_PER_MONTH = 30.4;

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function summarizeFiscal(sales: SaleRow[], movements: MovementRow[], from: string, to: string) {
  const salesTotal = sales.reduce((s, r) => s + Number(r.total_amount), 0);
  const ivaVentas = sales.reduce((s, r) => s + Number(r.sales_iva_amount), 0);

  const invoiced = movements.filter((m) => m.tax_status === "invoiced");
  const ivaAcreditable = invoiced.reduce((s, m) => s + Number(m.tax_iva_amount), 0);
  const deduccionesFacturadas = invoiced.reduce((s, m) => s + (Number(m.amount) - Number(m.tax_iva_amount)), 0);

  const ivaAPagarEstimado = Math.max(0, ivaVentas - ivaAcreditable);
  const saldoIvaAFavor = Math.max(0, ivaAcreditable - ivaVentas);

  const ingresosGravables = salesTotal - ivaVentas;
  const baseGravable = Math.max(0, ingresosGravables - deduccionesFacturadas);

  // La tarifa del Art. 96 es mensual: prorrateamos la base al equivalente
  // de un mes de 30.4 días, aplicamos la tarifa, y reescalamos al tamaño
  // real del periodo. Es una aproximación — el ISR real de un PFAE se
  // calcula acumulado desde enero, no por periodo aislado.
  const days = daysBetween(from, to);
  const monthlyEquivalentBase = baseGravable * (AVG_DAYS_PER_MONTH / days);
  const isrMonthlyEquivalent = applyMonthlyIsrTariff(monthlyEquivalentBase);
  const isrEstimado = isrMonthlyEquivalent * (days / AVG_DAYS_PER_MONTH);

  return {
    salesTotal,
    ivaVentas,
    ivaAcreditable,
    deduccionesFacturadas,
    ivaAPagarEstimado,
    saldoIvaAFavor,
    ingresosGravables,
    baseGravable,
    isrEstimado,
  };
}

export function groupByCategory(movements: MovementRow[]) {
  const map = new Map<string, number>();
  for (const m of movements) {
    const key = m.category?.name ?? "Sin categoría";
    map.set(key, (map.get(key) ?? 0) + Number(m.amount));
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

export function groupBySupplier(movements: MovementRow[]) {
  const map = new Map<string, number>();
  for (const m of movements) {
    if (!m.supplier?.name) continue;
    map.set(m.supplier.name, (map.get(m.supplier.name) ?? 0) + Number(m.amount));
  }
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount, percent: total > 0 ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function dailySeries(sales: SaleRow[], movements: MovementRow[], from: string, to: string) {
  const days: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  const salesByDay = new Map<string, number>();
  for (const s of sales) salesByDay.set(s.sale_date, (salesByDay.get(s.sale_date) ?? 0) + Number(s.total_amount));
  const movByDay = new Map<string, number>();
  for (const m of movements) movByDay.set(m.movement_date, (movByDay.get(m.movement_date) ?? 0) + Number(m.amount));

  return days.map((day) => ({
    day,
    ventas: salesByDay.get(day) ?? 0,
    gastos: movByDay.get(day) ?? 0,
  }));
}
