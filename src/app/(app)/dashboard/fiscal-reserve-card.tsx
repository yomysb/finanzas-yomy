"use client";

import { useState, useTransition } from "react";
import { Card, Pill } from "@/components/ui/primitives";
import { setFiscalReserveStatus } from "./fiscal-reserve-actions";

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function FiscalReserveCard({
  periodMonth,
  monthLabel,
  daysElapsed,
  reservaFiscalSugerida,
  apartadoDiarioRecomendado,
  utilidadNetaDisponible,
  ivaAPagar,
  isrEstimado,
  coberturaCFDI,
  dueDateLabel,
  initialIsReserved,
}: {
  periodMonth: string;
  monthLabel: string;
  daysElapsed: number;
  reservaFiscalSugerida: number;
  apartadoDiarioRecomendado: number;
  utilidadNetaDisponible: number;
  ivaAPagar: number;
  isrEstimado: number;
  coberturaCFDI: number;
  dueDateLabel: string;
  initialIsReserved: boolean;
}) {
  const [isReserved, setIsReserved] = useState(initialIsReserved);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !isReserved;
    setIsReserved(next);
    startTransition(() => {
      setFiscalReserveStatus(periodMonth, next).catch(() => setIsReserved(!next));
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-soft">Provisión de reserva fiscal y liquidez real — {monthLabel}</h2>
        <span className="text-xs text-ink-soft">Estimado sobre datos reales · confirma con tu contador</span>
      </div>
      <Card className="p-5">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">Reserva fiscal sugerida del mes</p>
            <p className="figure mt-2 text-2xl text-ink">{money(reservaFiscalSugerida)}</p>
            <p className="mt-1 text-xs text-ink-soft">IVA a pagar {money(ivaAPagar)} + ISR estimado {money(isrEstimado)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">Apartado diario recomendado</p>
            <p className="figure mt-2 text-2xl text-ink">{money(apartadoDiarioRecomendado)}</p>
            <p className="mt-1 text-xs text-ink-soft">Reserva acumulada ÷ {daysElapsed} día(s) transcurridos de {monthLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">Utilidad neta disponible (limpia)</p>
            <p className={`figure mt-2 text-2xl ${utilidadNetaDisponible >= 0 ? "text-ink" : "text-rust"}`}>
              {money(utilidadNetaDisponible)}
            </p>
            <p className="mt-1 text-xs text-ink-soft">Ventas − gastos reales − reserva fiscal sugerida</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="text-sm">
            <span className="text-ink-soft">Cobertura CFDI de gastos del mes: </span>
            <Pill tone={coberturaCFDI >= 70 ? "pine" : coberturaCFDI >= 40 ? "gold" : "rust"}>
              {coberturaCFDI.toFixed(0)}% facturado
            </Pill>
          </div>
          <div className="text-sm text-ink-soft">Vence: {dueDateLabel}</div>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
          <input type="checkbox" checked={isReserved} disabled={isPending} onChange={toggle} />
          <span className="text-ink">Monto de reserva aislado en cuenta / apartado bancario</span>
        </label>
      </Card>
    </section>
  );
}
