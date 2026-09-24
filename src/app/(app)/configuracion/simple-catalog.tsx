"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Pill, EmptyState } from "@/components/ui/primitives";
import { createSimpleItem, toggleSimpleItemActive } from "./actions";

type Item = { id: string; name: string; is_active: boolean };

export default function SimpleCatalog({
  table,
  title,
  helpText,
  placeholder,
  items,
}: {
  table: "payment_methods" | "business_types";
  title: string;
  helpText: string;
  placeholder: string;
  items: Item[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createSimpleItem(table, formData);
        setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-ink">{title}</p>
          <p className="text-xs text-ink-soft">{helpText}</p>
        </div>
        <Button variant="ghost" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancelar" : "Agregar"}
        </Button>
      </div>

      {error && <p className="mb-2 text-sm text-rust">{error}</p>}

      {showForm && (
        <form action={handleCreate} className="mb-4 flex gap-2">
          <Input name="name" required placeholder={placeholder} />
          <Button type="submit" disabled={isPending}>Guardar</Button>
        </form>
      )}

      {items.length === 0 ? (
        <EmptyState title="Sin registros aún" />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">{item.name}</span>
              <div className="flex items-center gap-3">
                <Pill tone={item.is_active ? "pine" : "neutral"}>{item.is_active ? "Activo" : "Inactivo"}</Pill>
                <button
                  className="text-xs text-ink-soft underline underline-offset-2 hover:text-rust"
                  onClick={() => startTransition(() => toggleSimpleItemActive(table, item.id, !item.is_active))}
                >
                  {item.is_active ? "Desactivar" : "Reactivar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
