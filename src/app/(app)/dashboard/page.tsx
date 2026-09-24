import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Pill } from "@/components/ui/primitives";
import PeriodSelector from "@/components/finance/period-selector";
import { resolvePeriod, previousPeriod, type PeriodPreset } from "@/lib/period";
import { fetchSales, fetchMovements, summarize } from "@/lib/finance";

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const preset = (typeof sp.preset === "string" ? sp.preset : "mes") as PeriodPreset;
  const customFrom = typeof sp.from === "string" ? sp.from : undefined;
  const customTo = typeof sp.to === "string" ? sp.to : undefined;
  const { from, to } = resolvePeriod(preset, customFrom, customTo);
  const prev = previousPeriod(from, to);

  const supabase = await createClient();

  const [sales, movements, prevSales, prevMovements] = await Promise.all([
    fetchSales(supabase, from, to),
    fetchMovements(supabase, from, to),
    fetchSales(supabase, prev.from, prev.to),
    fetchMovements(supabase, prev.from, prev.to),
  ]);

  const cur = summarize(sales, movements);
  const previous = summarize(prevSales, prevMovements);

  // Catálogo — checklist de arranque
  const [{ count: suppliers }, { count: categories }, { count: paymentMethods }] = await Promise.all([
    supabase.from("suppliers").select("*", { count: "exact", head: true }),
    supabase.from("expense_categories").select("*", { count: "exact", head: true }),
    supabase.from("payment_methods").select("*", { count: "exact", head: true }),
  ]);
  const catalogReady = (suppliers ?? 0) > 0 && (categories ?? 0) > 0 && (paymentMethods ?? 0) > 0;

  // Alertas basadas en datos
  const movementDates = new Set(movements.map((m) => m.movement_date));
  const salesDates = new Set(sales.map((s) => s.sale_date));
  const daysWithMovementsNoSale = [...movementDates].filter((d) => !salesDates.has(d)).sort();

  const dupKey = (m: (typeof movements)[number]) => `${m.movement_date}|${m.supplier_id}|${m.amount}`;
  const seen = new Map<string, number>();
  for (const m of movements) {
    if (!m.supplier_id) continue;
    const k = dupKey(m);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const possibleDuplicates = [...seen.values()].filter((n) => n > 1).length;

  const expensesGrowingFasterThanSales =
    previous.salesTotal > 0 &&
    delta(cur.salesTotal, previous.salesTotal) < delta(cur.movementsTotal, previous.movementsTotal) - 5;

  const alerts: string[] = [];
  if (daysWithMovementsNoSale.length > 0) {
    alerts.push(`${daysWithMovementsNoSale.length} día(s) con gastos registrados pero sin venta capturada.`);
  }
  if (possibleDuplicates > 0) {
    alerts.push(`${possibleDuplicates} posible(s) movimiento(s) duplicado(s) (misma fecha, proveedor y monto).`);
  }
  if (expensesGrowingFasterThanSales) {
    alerts.push("Los gastos están creciendo más rápido que las ventas respecto al periodo anterior.");
  }
  if (cur.margin < previous.margin - 5 && previous.salesTotal > 0) {
    alerts.push(`El margen bajó de ${previous.margin.toFixed(1)}% a ${cur.margin.toFixed(1)}%.`);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-3xl italic text-ink">Panel</p>
          <p className="text-sm text-ink-soft">
            {from} a {to} · comparado contra {prev.from} a {prev.to}
          </p>
        </div>
        <PeriodSelector preset={preset} from={from} to={to} />
      </div>

      {!catalogReady && (
        <Card className="flex items-center justify-between p-4">
          <p className="text-sm text-ink-soft">Termina de configurar tus catálogos para que los reportes tengan sentido.</p>
          <Link href="/configuracion" className="text-sm font-medium text-ink underline underline-offset-2">
            Ir a configuración
          </Link>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Ventas</p>
          <p className="figure mt-2 text-3xl text-ink">{money(cur.salesTotal)}</p>
          <p className={`mt-1 text-xs ${cur.salesTotal >= previous.salesTotal ? "text-pine" : "text-rust"}`}>
            {pct(delta(cur.salesTotal, previous.salesTotal))} vs. periodo anterior
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Resultado (estimado)</p>
          <p className="figure mt-2 text-3xl text-ink">{money(cur.resultEstimated)}</p>
          <p className="mt-1 text-xs text-ink-soft">Margen: {cur.margin.toFixed(1)}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-ink-soft">Flujo de efectivo</p>
          <p className={`figure mt-2 text-3xl ${cur.netCashFlow >= 0 ? "text-ink" : "text-rust"}`}>{money(cur.netCashFlow)}</p>
          <p className="mt-1 text-xs text-ink-soft">Entradas {money(cur.salesTotal)} − salidas {money(cur.movementsTotal)}</p>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        {[
          { label: "Tickets", value: cur.orders.toLocaleString("es-MX") },
          { label: "Productos vendidos", value: cur.products.toLocaleString("es-MX") },
          { label: "Ticket promedio", value: money(cur.avgTicket) },
          { label: "Gasto promedio diario", value: money(cur.avgDailyExpense) },
          { label: "Compras/gastos totales", value: money(cur.movementsTotal) },
        ].map((i) => (
          <Card key={i.label} className="p-4">
            <p className="text-xs text-ink-soft">{i.label}</p>
            <p className="figure mt-1 text-lg text-ink">{i.value}</p>
          </Card>
        ))}
      </section>

      {alerts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Alertas</h2>
          <Card className="divide-y divide-line">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Pill tone="gold">Aviso</Pill>
                <span className="text-ink">{a}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <Link href="/reportes" className="inline-block text-sm font-medium text-ink underline underline-offset-2">
        Ver reportes y gráficas de este periodo →
      </Link>
    </div>
  );
}
