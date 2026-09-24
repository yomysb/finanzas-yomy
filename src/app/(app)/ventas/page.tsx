import { EmptyState } from "@/components/ui/primitives";

export default function Page() {
  return (
    <div className="space-y-6">
      <p className="font-display text-3xl italic text-ink">Ventas</p>
      <EmptyState
        title="Llega en la Etapa 2"
        description="Este módulo se activa una vez que el catálogo (proveedores, categorías, formas de pago) esté listo."
      />
    </div>
  );
}
