import { createClient } from "@/lib/supabase/server";
import { Card, Pill } from "@/components/ui/primitives";
import Link from "next/link";

async function getSetupStatus() {
  const supabase = await createClient();
  const [{ count: suppliers }, { count: categories }, { count: paymentMethods }, { count: businessTypes }] =
    await Promise.all([
      supabase.from("suppliers").select("*", { count: "exact", head: true }),
      supabase.from("expense_categories").select("*", { count: "exact", head: true }),
      supabase.from("payment_methods").select("*", { count: "exact", head: true }),
      supabase.from("business_types").select("*", { count: "exact", head: true }),
    ]);
  return {
    suppliers: suppliers ?? 0,
    categories: categories ?? 0,
    paymentMethods: paymentMethods ?? 0,
    businessTypes: businessTypes ?? 0,
  };
}

export default async function DashboardPage() {
  const status = await getSetupStatus();
  const steps = [
    { label: "Proveedores registrados", count: status.suppliers, href: "/proveedores" },
    { label: "Categorías de gasto", count: status.categories, href: "/categorias" },
    { label: "Formas de pago", count: status.paymentMethods, href: "/configuracion" },
    { label: "Giros de proveedor", count: status.businessTypes, href: "/configuracion" },
  ];
  const ready = steps.filter((s) => s.count > 0).length;

  return (
    <div className="space-y-10">
      <div>
        <p className="font-display text-3xl italic text-ink">Panel</p>
        <p className="mt-1 text-sm text-ink-soft">
          Etapa 1: primero se arma el catálogo. La captura diaria y los indicadores llegan en la Etapa 2.
        </p>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-soft">Preparación del catálogo</h2>
          <Pill tone={ready === steps.length ? "pine" : "gold"}>
            {ready} de {steps.length} listos
          </Pill>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step) => (
            <Link key={step.href} href={step.href}>
              <Card className="flex items-center justify-between p-4 hover:border-ink transition-colors">
                <span className="text-sm text-ink">{step.label}</span>
                <span className="figure text-lg text-ink-soft">{step.count}</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Lo que verás aquí en la Etapa 2</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Ventas", desc: "Cuánto vendiste, tickets y forma de pago." },
            { title: "Resultado", desc: "Ventas menos costos y gastos del periodo — etiquetado como estimado hasta tener inventario." },
            { title: "Flujo de efectivo", desc: "Todo lo que entró contra todo lo que salió, sin excepción." },
          ].map((b) => (
            <Card key={b.title} className="p-5 opacity-60">
              <p className="font-display text-lg text-ink">{b.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{b.desc}</p>
              <p className="figure mt-4 text-2xl text-ink-soft">—</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
