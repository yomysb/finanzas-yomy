import { todayISO } from "./date";

export type PeriodPreset =
  | "hoy"
  | "ayer"
  | "semana"
  | "semana_anterior"
  | "mes"
  | "mes_anterior"
  | "bimestre"
  | "trimestre"
  | "semestre"
  | "anio"
  | "personalizado";

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  semana: "Esta semana",
  semana_anterior: "Semana anterior",
  mes: "Este mes",
  mes_anterior: "Mes anterior",
  bimestre: "Bimestre",
  trimestre: "Trimestre",
  semestre: "Semestre",
  anio: "Año",
  personalizado: "Personalizado",
};

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  // Semana inicia en lunes
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const res = new Date(d);
  res.setUTCDate(d.getUTCDate() + diff);
  return res;
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d);
  res.setUTCDate(res.getUTCDate() + days);
  return res;
}

function addMonths(d: Date, months: number): Date {
  const res = new Date(d);
  res.setUTCMonth(res.getUTCMonth() + months);
  return res;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

export function resolvePeriod(
  preset: PeriodPreset,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const today = new Date(`${todayISO()}T00:00:00Z`);

  switch (preset) {
    case "hoy":
      return { from: toISO(today), to: toISO(today) };
    case "ayer": {
      const y = addDays(today, -1);
      return { from: toISO(y), to: toISO(y) };
    }
    case "semana": {
      const start = startOfWeek(today);
      return { from: toISO(start), to: toISO(addDays(start, 6)) };
    }
    case "semana_anterior": {
      const start = addDays(startOfWeek(today), -7);
      return { from: toISO(start), to: toISO(addDays(start, 6)) };
    }
    case "mes": {
      return { from: toISO(startOfMonth(today)), to: toISO(endOfMonth(today)) };
    }
    case "mes_anterior": {
      const prevMonth = addMonths(today, -1);
      return { from: toISO(startOfMonth(prevMonth)), to: toISO(endOfMonth(prevMonth)) };
    }
    case "bimestre": {
      const start = addMonths(today, -1);
      return { from: toISO(startOfMonth(start)), to: toISO(endOfMonth(today)) };
    }
    case "trimestre": {
      const start = addMonths(today, -2);
      return { from: toISO(startOfMonth(start)), to: toISO(endOfMonth(today)) };
    }
    case "semestre": {
      const start = addMonths(today, -5);
      return { from: toISO(startOfMonth(start)), to: toISO(endOfMonth(today)) };
    }
    case "anio": {
      return { from: `${today.getUTCFullYear()}-01-01`, to: `${today.getUTCFullYear()}-12-31` };
    }
    case "personalizado":
      return { from: customFrom || toISO(today), to: customTo || toISO(today) };
  }
}

/** Rango inmediatamente anterior, de la misma duración — para comparaciones. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return { from: toISO(prevStart), to: toISO(prevEnd) };
}
