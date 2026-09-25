import { createClient } from "@/lib/supabase/server";
import PeriodSelector from "@/components/finance/period-selector";
import { resolvePeriod, type PeriodPreset } from "@/lib/period";
import { fetchSales, fetchMovements, groupByCategory, groupBySupplier, dailySeries, summarize } from "@/lib/finance";
import ReportTabs from "./report-tabs";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const preset = (typeof sp.preset === "string" ? sp.preset : "mes") as PeriodPreset;
  const customFrom = typeof sp.from === "string" ? sp.from : undefined;
  const customTo = typeof sp.to === "string" ? sp.to : undefined;
  const { from, to } = resolvePeriod(preset, customFrom, customTo);

  const supabase = await createClient();
  const [sales, movements] = await Promise.all([fetchSales(supabase, from, to), fetchMovements(supabase, from, to)]);

  const summary = summarize(sales, movements);
  const byCategory = groupByCategory(movements);
  const bySupplier = groupBySupplier(movements);
  const series = dailySeries(sales, movements, from, to);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display font-semibold tracking-tight text-3xl text-ink">Reportes</p>
          <p className="text-sm text-ink-soft">{from} a {to}</p>
        </div>
        <PeriodSelector preset={preset} from={from} to={to} />
      </div>

      <ReportTabs
        sales={sales}
        movements={movements}
        byCategory={byCategory}
        bySupplier={bySupplier}
        series={series}
        summary={summary}
      />
    </div>
  );
}
