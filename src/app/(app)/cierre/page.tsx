import { createClient } from "@/lib/supabase/server";
import { Card, Pill } from "@/components/ui/primitives";
import DayPanel from "./day-panel";
import { todayISO } from "@/lib/date";

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  capturado: "Capturado",
  conciliado: "Conciliado",
  cerrado: "Cerrado",
};

export default async function CierrePage() {
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: todaySales }, { data: todayMovements }, { data: operationDay }, { data: recentDays }] =
    await Promise.all([
      supabase.from("sales").select("total_amount").eq("sale_date", today).is("voided_at", null),
      supabase.from("financial_movements").select("amount").eq("movement_date", today).is("voided_at", null),
      supabase.from("operation_days").select("status").eq("operation_date", today).maybeSingle(),
      supabase.from("operation_days").select("operation_date, status").order("operation_date", { ascending: false }).limit(14),
    ]);

  const salesTotal = (todaySales ?? []).reduce((sum, s) => sum + Number(s.total_amount), 0);
  const movementsTotal = (todayMovements ?? []).reduce((sum, m) => sum + Number(m.amount), 0);
  const status = operationDay?.status ?? "pendiente";

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-3xl italic text-ink">Cierre diario</p>
        <p className="text-sm text-ink-soft">Revisa el día y avanza su estado cuando ya cuadre.</p>
      </div>

      <DayPanel
        date={today}
        status={status}
        salesTotal={salesTotal}
        movementsTotal={movementsTotal}
        movementsCount={(todayMovements ?? []).length}
        movementsWithoutSale={(todayMovements ?? []).length > 0 && (todaySales ?? []).length === 0}
      />

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Días recientes</h2>
        {(recentDays ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no hay historial de cierres.</p>
        ) : (
          <Card className="divide-y divide-line">
            {recentDays!.map((d) => (
              <div key={d.operation_date} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-ink">{d.operation_date}</span>
                <Pill tone={d.status === "cerrado" ? "pine" : d.status === "pendiente" ? "neutral" : "gold"}>
                  {STATUS_LABEL[d.status]}
                </Pill>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
