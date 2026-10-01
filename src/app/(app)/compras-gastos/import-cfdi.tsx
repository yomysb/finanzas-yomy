"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, Pill, Select, Textarea } from "@/components/ui/primitives";
import { parseCfdiXml, type ParsedCfdi } from "@/lib/cfdi";
import { createMovementFromCfdi, createSupplierInline, attachReceipt } from "./actions";

type MovementType = { id: string; code: string; name: string; requires_supplier: boolean; requires_category: boolean };
type Option = { id: string; name: string; tax_id?: string | null };

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function ImportCfdi({
  businessId,
  businessRfc,
  movementTypes,
  suppliers,
  categories,
  paymentMethods,
  onDone,
}: {
  businessId: string;
  businessRfc: string | null;
  movementTypes: MovementType[];
  suppliers: Option[];
  categories: Option[];
  paymentMethods: Option[];
  onDone: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedCfdi | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [movementDate, setMovementDate] = useState("");
  const [movementTypeId, setMovementTypeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  function handleFile(file: File) {
    setError(null);
    setXmlFile(file);
    file
      .text()
      .then((text) => {
        const result = parseCfdiXml(text);
        setParsed(result);
        setMovementDate(result.date ?? "");
        const initial: Record<string, boolean> = {};
        result.concepts.forEach((c) => (initial[c.id] = true));
        setSelected(initial);

        const matched = result.issuerRfc
          ? suppliers.find((s) => s.tax_id && s.tax_id.toUpperCase() === result.issuerRfc!.toUpperCase())
          : undefined;
        if (matched) {
          setSupplierId(matched.id);
        } else if (result.issuerName) {
          setNewSupplierName(result.issuerName);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo leer el XML"));
  }

  const selectedConcepts = useMemo(
    () => (parsed ? parsed.concepts.filter((c) => selected[c.id]) : []),
    [parsed, selected]
  );
  const selectedSubtotal = selectedConcepts.reduce((s, c) => s + c.amount, 0);
  const selectedIva = selectedConcepts.reduce((s, c) => s + c.ivaAmount, 0);
  const selectedTotal = selectedSubtotal + selectedIva;

  const rfcMismatch = businessRfc && parsed?.receiverRfc && businessRfc.toUpperCase() !== parsed.receiverRfc.toUpperCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed || !xmlFile) return;
    setError(null);
    setSaving(true);
    try {
      let finalSupplierId = supplierId;
      if (addingSupplier) {
        const created = await createSupplierInline(newSupplierName);
        finalSupplierId = created.id;
      }
      if (!finalSupplierId) throw new Error("Selecciona o crea el proveedor");
      if (!movementTypeId) throw new Error("Selecciona el tipo de movimiento");
      if (!paymentMethodId) throw new Error("Selecciona la forma de pago");

      const fd = new FormData();
      fd.set("movement_date", movementDate);
      fd.set("movement_type_id", movementTypeId);
      fd.set("payment_method_id", paymentMethodId);
      fd.set("supplier_id", finalSupplierId);
      fd.set("category_id", categoryId);
      fd.set("amount", String(selectedTotal));
      fd.set("tax_iva_amount", String(selectedIva));
      fd.set("cfdi_uuid", parsed.uuid ?? "");
      fd.set("cfdi_issuer_rfc", parsed.issuerRfc ?? "");
      fd.set("notes", notesRef.current?.value ?? "");

      const movementId = await createMovementFromCfdi(fd);

      const xmlPath = `${businessId}/${movementId}/${xmlFile.name}`;
      const { error: xmlErr } = await supabase.storage.from("receipts").upload(xmlPath, xmlFile);
      if (!xmlErr) await attachReceipt(movementId, xmlPath, "application/xml");

      if (pdfFile) {
        const pdfPath = `${businessId}/${movementId}/${pdfFile.name}`;
        const { error: pdfErr } = await supabase.storage.from("receipts").upload(pdfPath, pdfFile);
        if (!pdfErr) await attachReceipt(movementId, pdfPath, "application/pdf");
      }

      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-ink">Registrar gasto desde factura (XML)</p>
          <p className="text-xs text-ink-soft">
            El XML se procesa en tu navegador, no se envía a ningún servidor externo.
          </p>
        </div>
        <Button variant="ghost" onClick={onDone}>Cerrar</Button>
      </div>

      {error && <p className="mb-3 text-sm text-rust">{error}</p>}

      {!parsed ? (
        <div>
          <Label htmlFor="cfdi_xml">Archivo XML del CFDI</Label>
          <input
            id="cfdi_xml"
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-line bg-paper p-3 text-sm">
            <p className="text-ink">
              {parsed.issuerName ?? "Proveedor sin nombre"} <span className="text-ink-soft">({parsed.issuerRfc ?? "sin RFC"})</span>
            </p>
            <p className="text-xs text-ink-soft">Folio fiscal (UUID): {parsed.uuid ?? "no encontrado"}</p>
            {rfcMismatch && (
              <p className="mt-1 text-xs text-gold">
                Aviso: el receptor de esta factura ({parsed.receiverRfc}) no coincide con el RFC de tu negocio ({businessRfc}).
              </p>
            )}
          </div>

          <div className="max-h-64 overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-paper">
                <tr className="border-b border-line text-xs uppercase text-ink-soft">
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2">Concepto</th>
                  <th className="px-3 py-2">Importe</th>
                  <th className="px-3 py-2">IVA</th>
                </tr>
              </thead>
              <tbody>
                {parsed.concepts.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!selected[c.id]}
                        onChange={(e) => setSelected((s) => ({ ...s, [c.id]: e.target.checked }))}
                      />
                    </td>
                    <td className="px-3 py-2 text-ink">{c.description}</td>
                    <td className="figure px-3 py-2 text-ink-soft">{money(c.amount)}</td>
                    <td className="figure px-3 py-2 text-ink-soft">{money(c.ivaAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Pill tone="pine">Subtotal seleccionado: {money(selectedSubtotal)}</Pill>
            <Pill tone="gold">IVA seleccionado: {money(selectedIva)}</Pill>
            <Pill tone="neutral">Total a registrar: {money(selectedTotal)}</Pill>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cfdi_date">Fecha</Label>
              <Input id="cfdi_date" type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="cfdi_movement_type">Tipo de movimiento *</Label>
              <Select id="cfdi_movement_type" value={movementTypeId} onChange={(e) => setMovementTypeId(e.target.value)} required>
                <option value="">Selecciona…</option>
                {movementTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cfdi_category">Categoría</Label>
              <Select id="cfdi_category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cfdi_payment">Forma de pago *</Label>
              <Select id="cfdi_payment" value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} required>
                <option value="">Selecciona…</option>
                {paymentMethods.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="cfdi_supplier">Proveedor</Label>
              {addingSupplier ? (
                <div className="flex gap-2">
                  <Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Nombre del proveedor" />
                  <Button type="button" variant="ghost" onClick={() => setAddingSupplier(false)}>Cancelar</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select id="cfdi_supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">Selecciona…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                  <Button type="button" variant="ghost" onClick={() => setAddingSupplier(true)}>+ Nuevo</Button>
                </div>
              )}
              {!addingSupplier && !supplierId && parsed.issuerName && (
                <p className="mt-1 text-xs text-gold">No encontré un proveedor con ese RFC — selecciona uno o crea nuevo.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="cfdi_notes">Notas</Label>
              <Textarea ref={notesRef} id="cfdi_notes" rows={2} placeholder="Opcional" />
            </div>
            <div>
              <Label htmlFor="cfdi_pdf">PDF de la factura (opcional)</Label>
              <input
                id="cfdi_pdf"
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                className="block text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving || selectedConcepts.length === 0}>
              {saving ? "Guardando…" : `Registrar gasto (${money(selectedTotal)})`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setParsed(null)}>Elegir otro archivo</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
