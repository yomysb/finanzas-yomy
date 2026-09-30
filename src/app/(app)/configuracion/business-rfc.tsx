"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Label } from "@/components/ui/primitives";
import { updateBusinessRfc } from "./actions";

export default function BusinessRfc({ initialRfc }: { initialRfc: string | null }) {
  const [rfc, setRfc] = useState(initialRfc ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateBusinessRfc(rfc);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <Card className="p-5">
      <p className="text-ink">Datos fiscales del negocio</p>
      <p className="mb-3 text-xs text-ink-soft">
        Se usa para avisarte si subes por error una factura (CFDI) que no está a nombre de este negocio.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="business_rfc">RFC del negocio</Label>
          <Input
            id="business_rfc"
            value={rfc}
            onChange={(e) => {
              setRfc(e.target.value);
              setSaved(false);
            }}
            placeholder="XAXX010101000"
            className="uppercase"
          />
        </div>
        <Button type="submit" disabled={isPending}>{isPending ? "Guardando…" : "Guardar"}</Button>
        {saved && <span className="text-xs text-pine">Guardado</span>}
      </form>
      {error && <p className="mt-2 text-sm text-rust">{error}</p>}
    </Card>
  );
}
