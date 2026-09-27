"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PERIOD_LABELS, type PeriodPreset } from "@/lib/period";
import { Input, Select } from "@/components/ui/primitives";

const OPTIONS: PeriodPreset[] = [
  "hoy",
  "ayer",
  "semana",
  "semana_anterior",
  "mes",
  "mes_anterior",
  "bimestre",
  "trimestre",
  "semestre",
  "anio",
  "personalizado",
];

export default function PeriodSelector({
  preset,
  from,
  to,
}: {
  preset: PeriodPreset;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([k, v]) => params.set(k, v));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Select
          value={preset}
          onChange={(e) => updateParams({ preset: e.target.value })}
          className="min-w-[10rem]"
        >
          {OPTIONS.map((o) => (
            <option key={o} value={o}>{PERIOD_LABELS[o]}</option>
          ))}
        </Select>
      </div>
      {preset === "personalizado" && (
        <>
          <div>
            <Input type="date" value={from} onChange={(e) => updateParams({ from: e.target.value })} />
          </div>
          <div>
            <Input type="date" value={to} onChange={(e) => updateParams({ to: e.target.value })} />
          </div>
        </>
      )}
    </div>
  );
}
