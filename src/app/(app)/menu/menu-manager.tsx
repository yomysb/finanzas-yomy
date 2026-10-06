"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card, EmptyState, Input, Label, Pill, Select } from "@/components/ui/primitives";
import { calcMenuPricing } from "@/lib/menu-pricing";
import {
  createMenuCategoryInline,
  createMenuProduct,
  toggleMenuProductActive,
  updateMenuProduct,
} from "./actions";

type Category = { id: string; name: string; is_active: boolean };
type Product = {
  id: string;
  name: string;
  category_id: string | null;
  production_cost: number;
  sale_price: number;
  tpv_commission_pct: number;
  target_margin_pct: number;
  is_active: boolean;
};

const money = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("es-MX", { style: "currency", currency: "MXN" }) : "—";
const pct = (n: number) => `${n.toFixed(1)}%`;

type PaymentMode = "card" | "cash";

export default function MenuManager({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [showInactive, setShowInactive] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("card");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeCategories = categories.filter((c) => c.is_active);
  const visible = products.filter((p) => showInactive || p.is_active);
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Sin categoría";

  const editingProduct = editingId ? products.find((p) => p.id === editingId) ?? null : null;

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createMenuProduct(formData);
        setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function handleUpdate(id: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateMenuProduct(id, formData);
        setEditingId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold tracking-tight text-3xl text-ink">Ingeniería de menú</p>
          <p className="text-sm text-ink-soft">
            Costo, precio y margen real de cada producto — antes de que la terminal y el SAT se lleven su parte.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-line p-0.5 text-xs">
            <button
              onClick={() => setPaymentMode("card")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                paymentMode === "card" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              Con tarjeta
            </button>
            <button
              onClick={() => setPaymentMode("cash")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                paymentMode === "cash" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              Efectivo
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar inactivos
          </label>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Nuevo producto"}</Button>
        </div>
      </div>

      <p className="text-xs text-ink-soft">
        {paymentMode === "card"
          ? "Mostrando utilidad y margen pagando con tarjeta (se descuenta la comisión TPV)."
          : "Mostrando utilidad y margen en efectivo (sin comisión TPV)."}
      </p>

      {error && <p className="text-sm text-rust">{error}</p>}

      {showForm && (
        <ProductForm
          categories={activeCategories}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          isPending={isPending}
          submitLabel="Guardar producto"
        />
      )}

      {editingProduct && (
        <ProductForm
          categories={activeCategories}
          product={editingProduct}
          onSubmit={(fd) => handleUpdate(editingProduct.id, fd)}
          onCancel={() => setEditingId(null)}
          isPending={isPending}
          submitLabel="Guardar cambios"
        />
      )}

      {visible.length === 0 ? (
        <EmptyState
          title="Todavía no hay productos en el menú"
          description="Agrega el primero con el botón de arriba para ver su margen real."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase tracking-normal text-ink-soft">
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Costo</th>
                <th className="px-4 py-3 font-medium">Precio venta</th>
                <th className="px-4 py-3 font-medium">Antes de IVA</th>
                <th className="px-4 py-3 font-medium">Comisión TPV</th>
                <th className="px-4 py-3 font-medium">Utilidad neta</th>
                <th className="px-4 py-3 font-medium">Margen</th>
                <th className="px-4 py-3 font-medium">Markup</th>
                <th className="px-4 py-3 font-medium">Precio sugerido</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const r = calcMenuPricing({
                  productionCost: p.production_cost,
                  salePrice: p.sale_price,
                  tpvCommissionPct: p.tpv_commission_pct,
                  targetMarginPct: p.target_margin_pct,
                });
                const margin = paymentMode === "card" ? r.marginPctCard : r.marginPctCash;
                const markup = paymentMode === "card" ? r.markupPctCard : r.markupPctCash;
                const profit = paymentMode === "card" ? r.netProfitCard : r.netProfitCash;
                const suggested = paymentMode === "card" ? r.suggestedPriceCard : r.suggestedPriceCash;
                const belowTarget = margin < p.target_margin_pct;
                const nearTarget = belowTarget && margin >= p.target_margin_pct - 5;

                const rowTone = !p.is_active
                  ? ""
                  : belowTarget && !nearTarget
                    ? "bg-rust-soft/40"
                    : nearTarget
                      ? "bg-gold-soft/40"
                      : "";

                return (
                  <tr key={p.id} className={`border-b border-line last:border-0 hover:bg-paper ${rowTone}`}>
                    <td className="px-4 py-3">
                      <p className={p.is_active ? "text-ink" : "text-ink-soft line-through"}>{p.name}</p>
                      <p className="text-xs text-ink-soft">{categoryName(p.category_id)}</p>
                    </td>
                    <td className="px-4 py-3 figure text-ink-soft">{money(p.production_cost)}</td>
                    <td className="px-4 py-3 figure text-ink">{money(p.sale_price)}</td>
                    <td className="px-4 py-3 figure text-ink-soft">{money(r.priceBeforeTax)}</td>
                    <td className="px-4 py-3 figure text-ink-soft">
                      {paymentMode === "card" ? money(r.tpvCommissionAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 figure font-medium text-ink">{money(profit)}</td>
                    <td className="px-4 py-3">
                      <Pill tone={belowTarget ? (nearTarget ? "gold" : "rust") : "pine"}>
                        {pct(margin)} (obj. {p.target_margin_pct}%)
                      </Pill>
                    </td>
                    <td className="px-4 py-3 figure text-ink-soft">{pct(markup)}</td>
                    <td className="px-4 py-3 figure text-ink-soft">
                      {Number.isFinite(suggested) ? money(suggested) : "No alcanzable"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3 text-xs">
                        <button
                          className="text-ink-soft underline underline-offset-2 hover:text-ink"
                          onClick={() => {
                            setShowForm(false);
                            setEditingId(p.id);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="text-ink-soft underline underline-offset-2 hover:text-rust"
                          onClick={() => startTransition(() => toggleMenuProductActive(p.id, !p.is_active))}
                        >
                          {p.is_active ? "Desactivar" : "Reactivar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductForm({
  product,
  categories,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  product?: Product;
  categories: Category[];
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [productionCost, setProductionCost] = useState(product?.production_cost ?? 0);
  const [salePrice, setSalePrice] = useState(product?.sale_price ?? 0);
  const [tpvCommissionPct, setTpvCommissionPct] = useState(product?.tpv_commission_pct ?? 2.2);
  const [targetMarginPct, setTargetMarginPct] = useState(product?.target_margin_pct ?? 50);
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [localCategories, setLocalCategories] = useState(categories);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [previewMode, setPreviewMode] = useState<PaymentMode>("card");

  const result = useMemo(
    () => calcMenuPricing({ productionCost, salePrice, tpvCommissionPct, targetMarginPct }),
    [productionCost, salePrice, tpvCommissionPct, targetMarginPct]
  );

  const margin = previewMode === "card" ? result.marginPctCard : result.marginPctCash;
  const markup = previewMode === "card" ? result.markupPctCard : result.markupPctCash;
  const profit = previewMode === "card" ? result.netProfitCard : result.netProfitCash;
  const suggested = previewMode === "card" ? result.suggestedPriceCard : result.suggestedPriceCash;
  const belowTarget = margin < targetMarginPct;
  const nearTarget = belowTarget && margin >= targetMarginPct - 5;

  async function handleAddCategory() {
    setCategoryError(null);
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    try {
      const created = await createMenuCategoryInline(trimmed);
      if (created) {
        setLocalCategories((prev) => [...prev, { id: created.id, name: created.name, is_active: true }]);
        setCategoryId(created.id);
        setNewCategoryName("");
        setAddingCategory(false);
      }
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : "No se pudo crear la categoría");
    }
  }

  return (
    <Card className="p-5">
      <form action={onSubmit} className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="name">Nombre del producto *</Label>
            <Input id="name" name="name" required defaultValue={product?.name} placeholder="Esquites chicos" />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="category_id">Categoría</Label>
            {!addingCategory ? (
              <div className="flex gap-2">
                <Select
                  id="category_id"
                  name="category_id"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex-1"
                >
                  <option value="">Sin categoría</option>
                  {localCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="ghost" onClick={() => setAddingCategory(true)}>
                  + Nueva
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ej. Esquites"
                  className="flex-1"
                />
                <Button type="button" onClick={handleAddCategory}>
                  Guardar
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAddingCategory(false)}>
                  Cancelar
                </Button>
              </div>
            )}
            {categoryError && <p className="mt-1 text-xs text-rust">{categoryError}</p>}
          </div>

          <div>
            <Label htmlFor="production_cost">Costo de producción *</Label>
            <Input
              id="production_cost"
              name="production_cost"
              type="number"
              step="0.01"
              min="0"
              required
              value={productionCost}
              onChange={(e) => setProductionCost(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="sale_price">Precio de venta al público *</Label>
            <Input
              id="sale_price"
              name="sale_price"
              type="number"
              step="0.01"
              min="0"
              required
              value={salePrice}
              onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="tpv_commission_pct">% Comisión TPV</Label>
            <Input
              id="tpv_commission_pct"
              name="tpv_commission_pct"
              type="number"
              step="0.01"
              min="0"
              value={tpvCommissionPct}
              onChange={(e) => setTpvCommissionPct(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="target_margin_pct">% Margen objetivo</Label>
            <Input
              id="target_margin_pct"
              name="target_margin_pct"
              type="number"
              step="0.01"
              min="0"
              max="99.9"
              value={targetMarginPct}
              onChange={(e) => setTargetMarginPct(Number(e.target.value) || 0)}
            />
          </div>

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : submitLabel}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-paper p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-normal text-ink-soft">Vista previa en vivo</p>
            <div className="flex items-center rounded-lg border border-line p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPreviewMode("card")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  previewMode === "card" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                }`}
              >
                Tarjeta
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("cash")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  previewMode === "cash" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                }`}
              >
                Efectivo
              </button>
            </div>
          </div>

          <dl className="space-y-2 text-sm">
            <Row label="Precio antes de IVA" value={money(result.priceBeforeTax)} />
            <Row label="IVA (16%)" value={money(result.ivaAmount)} />
            {previewMode === "card" && <Row label="Comisión TPV" value={`− ${money(result.tpvCommissionAmount)}`} />}
            <Row label="Utilidad neta" value={money(profit)} strong />
            <Row
              label="Margen %"
              value={
                <Pill tone={belowTarget ? (nearTarget ? "gold" : "rust") : "pine"}>
                  {pct(margin)} (obj. {targetMarginPct}%)
                </Pill>
              }
            />
            <Row label="Markup %" value={pct(markup)} />
            <Row
              label="Precio sugerido para el margen objetivo"
              value={Number.isFinite(suggested) ? money(suggested) : "No alcanzable con esta comisión"}
            />
          </dl>

          {belowTarget && (
            <p className="mt-3 text-xs text-ink-soft">
              {nearTarget
                ? "El margen está cerca del objetivo pero no lo alcanza todavía."
                : "El margen actual está por debajo del objetivo. Considera ajustar el precio o revisar el costo."}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}

function Row({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`figure text-right ${strong ? "font-semibold text-ink" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
