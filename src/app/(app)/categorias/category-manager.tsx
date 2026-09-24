"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card, Input, Label, Pill, Select, Textarea, EmptyState } from "@/components/ui/primitives";
import { createCategory, toggleCategoryActive } from "./actions";

type Category = {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  is_active: boolean;
};

export default function CategoryManager({ categories }: { categories: Category[] }) {
  const [showForm, setShowForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parents = categories.filter((c) => !c.parent_category_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_category_id === id);
  const visible = useMemo(() => categories.filter((c) => showInactive || c.is_active), [categories, showInactive]);
  const visibleParents = parents.filter((p) => visible.includes(p) || childrenOf(p.id).some((c) => visible.includes(c)));

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createCategory(formData);
        setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-3xl italic text-ink">Categorías de gasto</p>
          <p className="text-sm text-ink-soft">Organiza por categoría y, opcionalmente, subcategoría.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar inactivas
          </label>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Nueva categoría"}</Button>
        </div>
      </div>

      {error && <p className="text-sm text-rust">{error}</p>}

      {showForm && (
        <Card className="p-5">
          <form action={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" name="name" required placeholder="Verduras" />
            </div>
            <div>
              <Label htmlFor="parent_category_id">Categoría padre (opcional)</Label>
              <Select id="parent_category_id" name="parent_category_id" defaultValue="">
                <option value="">Ninguna — es categoría principal</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isPending}>{isPending ? "Guardando…" : "Guardar categoría"}</Button>
            </div>
          </form>
        </Card>
      )}

      {visibleParents.length === 0 ? (
        <EmptyState title="Todavía no hay categorías" description="Agrega la primera con el botón de arriba." />
      ) : (
        <div className="space-y-3">
          {visibleParents.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink">{p.name}</p>
                  {p.description && <p className="text-xs text-ink-soft">{p.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <Pill tone={p.is_active ? "pine" : "neutral"}>{p.is_active ? "Activa" : "Inactiva"}</Pill>
                  <button
                    className="text-xs text-ink-soft underline underline-offset-2 hover:text-rust"
                    onClick={() => startTransition(() => toggleCategoryActive(p.id, !p.is_active))}
                  >
                    {p.is_active ? "Desactivar" : "Reactivar"}
                  </button>
                </div>
              </div>
              {childrenOf(p.id).filter((c) => showInactive || c.is_active).length > 0 && (
                <ul className="mt-3 space-y-2 border-l border-line pl-4">
                  {childrenOf(p.id)
                    .filter((c) => showInactive || c.is_active)
                    .map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-sm">
                        <span className="text-ink-soft">{c.name}</span>
                        <div className="flex items-center gap-3">
                          <Pill tone={c.is_active ? "pine" : "neutral"}>{c.is_active ? "Activa" : "Inactiva"}</Pill>
                          <button
                            className="text-xs text-ink-soft underline underline-offset-2 hover:text-rust"
                            onClick={() => startTransition(() => toggleCategoryActive(c.id, !c.is_active))}
                          >
                            {c.is_active ? "Desactivar" : "Reactivar"}
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
