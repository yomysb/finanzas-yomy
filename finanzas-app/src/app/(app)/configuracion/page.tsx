import { createClient } from "@/lib/supabase/server";
import SimpleCatalog from "./simple-catalog";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const [{ data: paymentMethods }, { data: businessTypes }] = await Promise.all([
    supabase.from("payment_methods").select("id, name, is_active").order("name"),
    supabase.from("business_types").select("id, name, is_active").order("name"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display font-semibold tracking-tight text-3xl text-ink">Configuración</p>
        <p className="text-sm text-ink-soft">Catálogos maestros que usan ventas, compras y gastos.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <SimpleCatalog
          table="payment_methods"
          title="Formas de pago"
          helpText="Efectivo, tarjeta, transferencia, crédito…"
          placeholder="Ej. Transferencia"
          items={paymentMethods ?? []}
        />
        <SimpleCatalog
          table="business_types"
          title="Giros de proveedor"
          helpText="Para clasificar a tus proveedores."
          placeholder="Ej. Cremería"
          items={businessTypes ?? []}
        />
      </div>
    </div>
  );
}
