"use client";

import { useTransition } from "react";
import { Button, Card, Pill } from "@/components/ui/primitives";
import { advanceDayStatus, reopenDay } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  capturado: "Capturado",
  conciliado: "Conciliado",
  cerrado: "Cerrado",
};

const NEXT_ACTION_LABEL: Record<string, string> = {
  pendiente: "Marcar como capturado",
  capturado: "Marcar como conciliado",
  conciliado: "Cerrar el día",
};

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function DayPanel({
  date,
  status,
  salesTotal,
  movementsTotal,
  movementsCount,
  movementsWithoutSale,
}: {
  date: string;
  status: string;
  salesTotal: number;
  movementsTotal: number;
  movementsCount: number;
  movementsWithoutSale: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const netFlow = salesTotal - movementsTotal;

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold tracking-tight text-2xl text-ink">{date}</p>
          <Pill tone={status === "cerrado" ? "pine" : status === "pendiente" ? "neutral" : "gold"}>
            {STATUS_LABEL[status]}
          </Pill>
        </div>
        <div className="flex gap-2">
          {status !== "cerrado" && (
            <Button disabled={isPending} onClick={() => startTransition(() => advanceDayStatus(date, status))}>
              {isPending ? "Guardando…" : NEXT_ACTION_LABEL[status]}
            </Button>
          )}
          {status === "cerrado" && (
            <Button variant="ghost" disabled={isPending} onClick={() => startTransition(() => reopenDay(date))}>
              Reabrir
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-ink-soft">Ventas del día</p>
          <p className="figure text-xl text-ink">{money(salesTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">Movimientos del día ({movementsCount})</p>
          <p className="figure text-xl text-ink">{money(movementsTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">Flujo neto registrado</p>
          <p className={`figure text-xl ${netFlow >= 0 ? "text-pine" : "text-rust"}`}>{money(netFlow)}</p>
        </div>
      </div>

      {movementsWithoutSale && (
        <p className="mt-4 text-xs text-gold">Hay movimientos registrados pero no hay venta capturada este día.</p>
      )}
    </Card>
  );
}
