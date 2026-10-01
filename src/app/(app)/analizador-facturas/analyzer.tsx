"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Button, Card, Input, Pill } from "@/components/ui/primitives";
import { parseCfdiXml, type ParsedCfdi } from "@/lib/cfdi";
import { applyMonthlyIsrTariff, ISR_TABLE_YEAR } from "@/lib/isr-table";

const money = (n: number) => (n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};
const baseName = (s: string) => (s || "").split("/").pop()!.replace(/\.[^.]+$/, "").toUpperCase();

type Factura = ParsedCfdi & { id: string; pdfUrl: string | null };

async function readZip(file: File, pdfMap: Record<string, string>, urlAccumulator: string[]): Promise<Factura[]> {
  const zip = await JSZip.loadAsync(file);
  const results: Factura[] = [];
  const entries = Object.entries(zip.files);

  for (const [name, entry] of entries) {
    if (entry.dir) continue;
    const lower = name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      const buf = await entry.async("arraybuffer");
      const url = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
      urlAccumulator.push(url);
      pdfMap[baseName(name)] = url;
    }
  }

  for (const [name, entry] of entries) {
    if (entry.dir || !name.toLowerCase().endsWith(".xml")) continue;
    try {
      const text = await entry.async("text");
      const parsed = parseCfdiXml(text, name);
      results.push({ ...parsed, id: `${name}-${parsed.uuid ?? Math.random()}`, pdfUrl: null });
    } catch {
      // XML inválido dentro del ZIP — se omite, no se detiene todo el lote
    }
  }

  return results.map((f) => ({
    ...f,
    pdfUrl: (f.uuid && pdfMap[f.uuid.toUpperCase()]) || pdfMap[baseName(f.filename)] || null,
  }));
}

function Dropzone({
  label,
  description,
  file,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  file: File | null;
  onChange: (f: File) => void;
  disabled?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  if (disabled) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-paper p-8 opacity-40">
        <p className="text-xs text-ink-soft">Deshabilitado</p>
      </div>
    );
  }
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) onChange(f);
      }}
      className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        drag ? "border-gold bg-gold-soft/30" : file ? "border-pine bg-pine-soft/30" : "border-line bg-paper hover:border-gold"
      }`}
    >
      <input
        type="file"
        accept=".zip"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
        }}
      />
      <p className={`text-sm font-medium ${file ? "text-pine" : "text-ink"}`}>{file ? file.name : label}</p>
      {!file && <p className="text-xs text-ink-soft">{description} · arrastra aquí o haz clic</p>}
      {file && <Pill tone="pine">Listo</Pill>}
    </label>
  );
}

function FacturaModal({ factura, onClose, onVerPdf }: { factura: Factura | null; onClose: () => void; onVerPdf: (url: string) => void }) {
  if (!factura) return null;
  const rows = [
    { label: "Subtotal", value: factura.subtotalDeclared },
    { label: "IVA trasladado", value: factura.ivaTrasladado },
    ...(factura.ieps > 0 ? [{ label: "IEPS", value: factura.ieps }] : []),
    ...(factura.ivaRetenido > 0 ? [{ label: "IVA retenido", value: -factura.ivaRetenido }] : []),
    ...(factura.isrRetenido > 0 ? [{ label: "ISR retenido", value: -factura.isrRetenido }] : []),
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/40" />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-paper-raised shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-6 py-5">
          <p className="text-xs uppercase tracking-wide text-ink-soft">
            {{ I: "Ingreso", E: "Egreso", T: "Traslado", P: "Pago", N: "Nómina" }[factura.tipo ?? ""] ?? factura.tipo}
          </p>
          <p className="font-display text-lg font-semibold text-ink">{factura.issuerName ?? factura.issuerRfc}</p>
          <p className="text-sm text-ink-soft">{factura.issuerRfc}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-soft">
            {factura.serie && <span>Serie {factura.serie} Folio {factura.folio}</span>}
            <span>{fmtDate(factura.date)}</span>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="rounded-lg border border-line bg-paper p-4">
            <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Receptor</p>
            <p className="font-medium text-ink">{factura.receiverName ?? factura.receiverRfc}</p>
            <p className="text-sm text-ink-soft">{factura.receiverRfc}</p>
          </div>
          {factura.uuid && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Folio fiscal (UUID)</p>
              <p className="figure break-all rounded-lg border border-line bg-paper p-2 text-xs text-ink-soft">{factura.uuid}</p>
            </div>
          )}
          {factura.concepts.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-soft">Conceptos</p>
              <div className="space-y-2">
                {factura.concepts.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-4 rounded-lg border border-line bg-paper p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{c.description}</p>
                      <p className="text-xs text-ink-soft">{c.quantity} {c.unit} × {money(c.unitValue)}</p>
                    </div>
                    <p className="figure shrink-0 text-sm font-medium text-ink">{money(c.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="overflow-hidden rounded-lg border border-line">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between border-b border-line px-4 py-2 last:border-0">
                <span className="text-sm text-ink-soft">{r.label}</span>
                <span className="figure text-sm text-ink">{money(r.value)}</span>
              </div>
            ))}
            <div className="flex justify-between bg-ink px-4 py-3 text-paper">
              <span className="font-medium">Total</span>
              <span className="figure font-semibold">{money(factura.totalDeclared)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-ink-soft">
            {factura.metodoPago && <Pill>Método: {factura.metodoPago}</Pill>}
            {factura.formaPago && <Pill>Forma: {factura.formaPago}</Pill>}
            {factura.moneda && <Pill>Moneda: {factura.moneda}</Pill>}
          </div>
          {factura.pdfUrl && (
            <Button className="w-full" onClick={() => onVerPdf(factura.pdfUrl!)}>
              Ver PDF de esta factura
            </Button>
          )}
        </div>
        <div className="px-6 pb-6">
          <Button variant="ghost" className="w-full" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}

function PdfModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/50" />
      <div
        className="relative z-10 flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-paper-raised shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="text-sm font-medium text-ink">Visor de PDF</span>
          <div className="flex gap-2">
            <a href={url} download className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:bg-paper">Descargar</a>
            <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft hover:bg-paper">Cerrar</button>
          </div>
        </div>
        <object data={url} type="application/pdf" className="flex-1">
          <embed src={url} type="application/pdf" className="h-full w-full" />
        </object>
      </div>
    </div>
  );
}

function GastosTable({
  gastos,
  deducibles,
  onToggle,
  onVer,
}: {
  gastos: Factura[];
  deducibles: Record<string, boolean>;
  onToggle: (id: string) => void;
  onVer: (f: Factura, openPdf?: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return gastos;
    return gastos.filter(
      (g) =>
        g.issuerRfc?.toLowerCase().includes(q) ||
        g.issuerName?.toLowerCase().includes(q) ||
        g.date?.includes(q) ||
        g.concepts.some((c) => c.description.toLowerCase().includes(q))
    );
  }, [gastos, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const page_ = Math.min(page, totalPages);
  const paginated = filtered.slice((page_ - 1) * perPage, page_ * perPage);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-ink">Gastos / facturas recibidas</p>
          <p className="text-xs text-ink-soft">{filtered.length} registros</p>
        </div>
        <Input
          placeholder="RFC, proveedor, producto…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-paper text-xs uppercase text-ink-soft">
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Proveedor (RFC)</th>
              <th className="px-4 py-3">Subtotal</th>
              <th className="px-4 py-3">IVA</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3 text-center">¿Deducible?</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-ink-soft">
                  {search ? "Sin resultados." : "Sin gastos cargados."}
                </td>
              </tr>
            )}
            {paginated.map((g) => {
              const esDeducible = deducibles[g.id] !== false;
              return (
                <tr key={g.id} className={`border-b border-line last:border-0 ${!esDeducible ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:text-ink" onClick={() => onVer(g)}>
                        XML
                      </button>
                      {g.pdfUrl && (
                        <button className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:text-ink" onClick={() => onVer(g, true)}>
                          PDF
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{fmtDate(g.date)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-ink">{g.issuerRfc}</p>
                    {g.issuerName && <p className="max-w-[180px] truncate text-xs text-ink-soft">{g.issuerName}</p>}
                  </td>
                  <td className="figure px-4 py-3 text-ink-soft">{money(g.subtotalDeclared)}</td>
                  <td className="figure px-4 py-3 text-ink-soft">{money(g.ivaTrasladado)}</td>
                  <td className="figure px-4 py-3 font-medium text-ink">{money(g.totalDeclared)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <input type="checkbox" checked={esDeducible} onChange={() => onToggle(g.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <p className="text-xs text-ink-soft">Página {page_} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page_ === 1} onClick={() => setPage((p) => p - 1)}>← Anterior</Button>
            <Button variant="ghost" disabled={page_ === totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente →</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function IngresosTable({ ingresos, onVer }: { ingresos: Factura[]; onVer: (f: Factura, openPdf?: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="overflow-hidden">
      <button className="flex w-full items-center justify-between px-5 py-4 hover:bg-paper" onClick={() => setOpen((o) => !o)}>
        <div className="text-left">
          <p className="text-ink">Ingresos / facturas emitidas</p>
          <p className="text-xs text-ink-soft">{ingresos.length} registros</p>
        </div>
        <span className={`text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase text-ink-soft">
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Cliente (RFC)</th>
                <th className="px-4 py-3">Subtotal</th>
                <th className="px-4 py-3">IVA</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.map((g) => (
                <tr key={g.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:text-ink" onClick={() => onVer(g)}>
                        XML
                      </button>
                      {g.pdfUrl && (
                        <button className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft hover:text-ink" onClick={() => onVer(g, true)}>
                          PDF
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{fmtDate(g.date)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-ink">{g.receiverRfc}</p>
                    {g.receiverName && <p className="max-w-[180px] truncate text-xs text-ink-soft">{g.receiverName}</p>}
                  </td>
                  <td className="figure px-4 py-3 text-ink-soft">{money(g.subtotalDeclared)}</td>
                  <td className="figure px-4 py-3 text-ink-soft">{money(g.ivaTrasladado)}</td>
                  <td className="figure px-4 py-3 font-medium text-ink">{money(g.totalDeclared)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ResumenSAT({ ingresos, gastos, deducibles }: { ingresos: Factura[]; gastos: Factura[]; deducibles: Record<string, boolean> }) {
  const totalIngresos = ingresos.reduce((s, f) => s + f.totalDeclared, 0);
  const ivaTrasladado = ingresos.reduce((s, f) => s + f.ivaTrasladado, 0);
  const deduciblesArr = gastos.filter((g) => deducibles[g.id] !== false);
  const noDeduciblesArr = gastos.filter((g) => deducibles[g.id] === false);
  const totalGastos = gastos.reduce((s, g) => s + g.totalDeclared, 0);
  const totalNoDeducible = noDeduciblesArr.reduce((s, g) => s + g.totalDeclared, 0);
  const totalDeducibleReal = deduciblesArr.reduce((s, g) => s + g.totalDeclared, 0);
  const ivaAcreditableReal = deduciblesArr.reduce((s, g) => s + g.ivaTrasladado, 0);
  const diferenciaIva = ivaTrasladado - ivaAcreditableReal;
  const ingresosGravables = totalIngresos - ivaTrasladado;
  const deduccionesSinIva = deduciblesArr.reduce((s, g) => s + (g.totalDeclared - g.ivaTrasladado), 0);
  const baseISR = Math.max(0, ingresosGravables - deduccionesSinIva);
  const isrEstimado = applyMonthlyIsrTariff(baseISR);

  const rows: { label: string; value: number; bold?: boolean }[] = [
    { label: "Ingresos totales", value: totalIngresos, bold: true },
    { label: "Gastos totales", value: totalGastos },
    { label: "Gastos no deducibles", value: totalNoDeducible },
    { label: "Gastos deducibles reales", value: totalDeducibleReal },
  ];
  const rows2: { label: string; value: number; bold?: boolean }[] = [
    { label: "IVA trasladado (cobrado)", value: ivaTrasladado },
    { label: "IVA acreditable real", value: ivaAcreditableReal },
    { label: "Diferencia de IVA (a pagar si es positivo)", value: diferenciaIva, bold: true },
  ];

  return (
    <Card className="p-6">
      <p className="text-ink">Resumen fiscal estimado</p>
      <p className="mb-4 text-xs text-ink-soft">Referencia para tu declaración mensual — no sustituye asesoría contable.</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-line">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between border-b border-line px-4 py-2.5 last:border-0">
              <span className={`text-sm ${r.bold ? "font-medium text-ink" : "text-ink-soft"}`}>{r.label}</span>
              <span className="figure text-sm text-ink">{money(r.value)}</span>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-line">
          {rows2.map((r) => (
            <div key={r.label} className="flex justify-between border-b border-line px-4 py-2.5 last:border-0">
              <span className={`text-sm ${r.bold ? "font-medium text-ink" : "text-ink-soft"}`}>{r.label}</span>
              <span className={`figure text-sm ${r.bold && r.value > 0 ? "text-rust" : "text-ink"}`}>{money(r.value)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-line">
        <div className="flex justify-between bg-paper px-4 py-3">
          <span className="font-medium text-ink">Base estimada para ISR</span>
          <span className="figure font-semibold text-ink">{money(baseISR)}</span>
        </div>
        <div className="flex justify-between border-t border-line px-4 py-3">
          <span className="text-sm text-ink-soft">ISR estimado (tarifa progresiva Art. 96 LISR {ISR_TABLE_YEAR}, un mes)</span>
          <span className="figure text-sm text-ink">{money(isrEstimado)}</span>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-gold/40 bg-gold-soft/40 p-4">
        <p className="text-xs text-ink">
          Este resumen es una estimación con fines informativos sobre el lote de XML que subiste — no sustituye tu
          cálculo fiscal real ni la declaración ante el SAT. Confirma con tu contador.
        </p>
      </div>
    </Card>
  );
}

export default function Analyzer() {
  const [inclEmitidas, setInclEmitidas] = useState(true);
  const [inclRecibidas, setInclRecibidas] = useState(true);
  const [fileEmitidas, setFileEmitidas] = useState<File | null>(null);
  const [fileRecibidas, setFileRecibidas] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ ingresos: Factura[]; gastos: Factura[] } | null>(null);
  const [deducibles, setDeducibles] = useState<Record<string, boolean>>({});
  const [modalFactura, setModalFactura] = useState<Factura | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<"gastos" | "ingresos" | "resumen">("gastos");
  const blobUrls = useRef<string[]>([]);

  const toggleDeducible = useCallback((id: string) => {
    setDeducibles((prev) => ({ ...prev, [id]: prev[id] === false }));
  }, []);

  function handleVer(f: Factura, openPdf?: boolean) {
    if (openPdf && f.pdfUrl) setPdfUrl(f.pdfUrl);
    else setModalFactura(f);
  }

  const canProcesar =
    (inclEmitidas || inclRecibidas) && (!inclEmitidas || !!fileEmitidas) && (!inclRecibidas || !!fileRecibidas);

  async function handleProcesar() {
    setError(null);
    setLoading(true);
    setDeducibles({});
    blobUrls.current.forEach((u) => URL.revokeObjectURL(u));
    blobUrls.current = [];

    try {
      const pdfMap: Record<string, string> = {};
      const ingresos = inclEmitidas && fileEmitidas ? await readZip(fileEmitidas, pdfMap, blobUrls.current) : [];
      const gastos = inclRecibidas && fileRecibidas ? await readZip(fileRecibidas, pdfMap, blobUrls.current) : [];
      setData({ ingresos, gastos });
      setTab(gastos.length > 0 ? "gastos" : ingresos.length > 0 ? "ingresos" : "resumen");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar el archivo");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setData(null);
    setFileEmitidas(null);
    setFileRecibidas(null);
    setDeducibles({});
    setTab("gastos");
    blobUrls.current.forEach((u) => URL.revokeObjectURL(u));
    blobUrls.current = [];
  }

  const ingresos = data?.ingresos ?? [];
  const gastos = data?.gastos ?? [];
  const totalIngresos = ingresos.reduce((s, f) => s + f.totalDeclared, 0);
  const ivaTrasladado = ingresos.reduce((s, f) => s + f.ivaTrasladado, 0);
  const deduciblesArr = gastos.filter((g) => deducibles[g.id] !== false);
  const totalGastos = gastos.reduce((s, g) => s + g.totalDeclared, 0);
  const totalGastosDeducibles = deduciblesArr.reduce((s, g) => s + g.totalDeclared, 0);
  const ivaAcreditable = deduciblesArr.reduce((s, g) => s + g.ivaTrasladado, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-3xl font-semibold tracking-tight text-ink">Analizador de facturas</p>
        <p className="text-sm text-ink-soft">
          Sube un lote de CFDI (ZIP con varios XML) para analizarlo — independiente de lo ya registrado en Compras y
          gastos. Todo se procesa en tu navegador; los archivos no se suben a ningún servidor.
        </p>
      </div>

      {!data ? (
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Facturas emitidas", desc: "Ingresos — lo que cobraste", enabled: inclEmitidas, set: setInclEmitidas, clear: () => setFileEmitidas(null) },
              { label: "Facturas recibidas", desc: "Gastos — lo que pagaste", enabled: inclRecibidas, set: setInclRecibidas, clear: () => setFileRecibidas(null) },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  t.set(!t.enabled);
                  if (t.enabled) t.clear();
                }}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                  t.enabled ? "border-gold/50 bg-gold-soft/30" : "border-line bg-paper opacity-60"
                }`}
              >
                <div className="flex-1">
                  <p className={`text-sm font-medium ${t.enabled ? "text-ink" : "text-ink-soft"}`}>{t.label}</p>
                  <p className="text-xs text-ink-soft">{t.desc}</p>
                </div>
                <div className={`h-6 w-11 shrink-0 rounded-full ${t.enabled ? "bg-gold" : "bg-line"}`}>
                  <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-paper-raised shadow transition-transform ${t.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Dropzone label="ZIP facturas emitidas" description="ZIP con XML (y PDF opcionales)" file={fileEmitidas} onChange={setFileEmitidas} disabled={!inclEmitidas} />
            <Dropzone label="ZIP facturas recibidas" description="ZIP con XML (y PDF opcionales)" file={fileRecibidas} onChange={setFileRecibidas} disabled={!inclRecibidas} />
          </div>

          {error && <p className="text-sm text-rust">{error}</p>}

          <Button className="w-full justify-center" disabled={loading || !canProcesar} onClick={handleProcesar}>
            {loading ? "Procesando…" : "Procesar facturas"}
          </Button>
          <p className="text-center text-xs text-ink-soft">Todo se procesa localmente — tus archivos no salen de tu computadora.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {ingresos.length > 0 && (
              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-ink-soft">Ingresos del lote</p>
                <p className="figure mt-1 text-xl text-ink">{money(totalIngresos)}</p>
                <p className="text-xs text-ink-soft">{ingresos.length} facturas emitidas</p>
              </Card>
            )}
            {gastos.length > 0 && (
              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-ink-soft">Gastos deducibles</p>
                <p className="figure mt-1 text-xl text-ink">{money(totalGastosDeducibles)}</p>
                <p className="text-xs text-ink-soft">de {money(totalGastos)} totales</p>
              </Card>
            )}
            {ingresos.length > 0 && (
              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-ink-soft">IVA trasladado</p>
                <p className="figure mt-1 text-xl text-ink">{money(ivaTrasladado)}</p>
                <p className="text-xs text-ink-soft">Cobrado a clientes</p>
              </Card>
            )}
            {gastos.length > 0 && (
              <Card className="p-4">
                <p className="text-xs uppercase tracking-wide text-ink-soft">IVA acreditable</p>
                <p className="figure mt-1 text-xl text-ink">{money(ivaAcreditable)}</p>
                <p className="text-xs text-ink-soft">Solo gastos deducibles</p>
              </Card>
            )}
          </div>

          <div className="flex w-fit gap-1 rounded-lg bg-paper p-1">
            {[
              gastos.length > 0 && { id: "gastos" as const, label: `Gastos (${gastos.length})` },
              ingresos.length > 0 && { id: "ingresos" as const, label: `Ingresos (${ingresos.length})` },
              { id: "resumen" as const, label: "Resumen SAT" },
            ]
              .filter((t): t is { id: "gastos" | "ingresos" | "resumen"; label: string } => !!t)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t.id ? "bg-paper-raised text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
          </div>

          {tab === "gastos" && gastos.length > 0 && (
            <GastosTable gastos={gastos} deducibles={deducibles} onToggle={toggleDeducible} onVer={handleVer} />
          )}
          {tab === "ingresos" && ingresos.length > 0 && <IngresosTable ingresos={ingresos} onVer={handleVer} />}
          {tab === "resumen" && <ResumenSAT ingresos={ingresos} gastos={gastos} deducibles={deducibles} />}

          <div className="flex justify-end">
            <Button variant="ghost" onClick={reset}>← Cargar nuevos archivos</Button>
          </div>
        </>
      )}

      <FacturaModal factura={modalFactura} onClose={() => setModalFactura(null)} onVerPdf={(u) => { setPdfUrl(u); setModalFactura(null); }} />
      <PdfModal url={pdfUrl} onClose={() => setPdfUrl(null)} />
    </div>
  );
}
