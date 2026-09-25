"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Button, Card, Pill } from "@/components/ui/primitives";
import type { SaleRow, MovementRow } from "@/lib/finance";
import { exportXLSX, exportCSV, exportPDF, type Column } from "@/lib/export";

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const COLORS = ["#b8863c", "#2f5346", "#a3492f", "#6b8f7f", "#8c6a2f", "#4a6b5a"];

const TABS = ["ventas", "compras", "proveedores", "categorias", "graficas"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  ventas: "Ventas",
  compras: "Compras y gastos",
  proveedores: "Por proveedor",
  categorias: "Por categoría",
  graficas: "Gráficas",
};

export default function ReportTabs({
  sales,
  movements,
  byCategory,
  bySupplier,
  series,
  summary,
}: {
  sales: SaleRow[];
  movements: MovementRow[];
  byCategory: { name: string; amount: number }[];
  bySupplier: { name: string; amount: number; percent: number }[];
  series: { day: string; ventas: number; gastos: number }[];
  summary: { salesTotal: number; movementsTotal: number; cash: number; card: number; transfer: number };
}) {
  const [tab, setTab] = useState<Tab>("ventas");

  const salesColumns: Column<SaleRow>[] = [
    { key: "sale_date", label: "Fecha" },
    { key: "num_orders", label: "Tickets" },
    { key: "num_products", label: "Productos" },
    { key: "cash_amount", label: "Efectivo", format: (v) => Number(v).toFixed(2) },
    { key: "card_amount", label: "Tarjeta", format: (v) => Number(v).toFixed(2) },
    { key: "transfer_amount", label: "Transferencia", format: (v) => Number(v).toFixed(2) },
    { key: "total_amount", label: "Total", format: (v) => Number(v).toFixed(2) },
  ];

  const movementsColumns: Column<MovementRow>[] = [
    { key: "movement_date", label: "Fecha" },
    { key: "supplier", label: "Proveedor", format: (v) => (v as { name: string } | null)?.name ?? "" },
    { key: "category", label: "Categoría", format: (v) => (v as { name: string } | null)?.name ?? "" },
    { key: "payment_method", label: "Forma de pago", format: (v) => (v as { name: string } | null)?.name ?? "" },
    { key: "amount", label: "Monto", format: (v) => Number(v).toFixed(2) },
  ];

  const supplierColumns: Column<{ name: string; amount: number; percent: number }>[] = [
    { key: "name", label: "Proveedor" },
    { key: "amount", label: "Monto", format: (v) => Number(v).toFixed(2) },
    { key: "percent", label: "% del total", format: (v) => `${Number(v).toFixed(1)}%` },
  ];

  const categoryColumns: Column<{ name: string; amount: number }>[] = [
    { key: "name", label: "Categoría" },
    { key: "amount", label: "Monto", format: (v) => Number(v).toFixed(2) },
  ];

  function currentExport(): { rows: unknown[]; columns: Column<unknown>[]; title: string; filename: string } | null {
    if (tab === "ventas") return { rows: sales, columns: salesColumns as Column<unknown>[], title: "Reporte de ventas", filename: "ventas" };
    if (tab === "compras") return { rows: movements, columns: movementsColumns as Column<unknown>[], title: "Reporte de compras y gastos", filename: "compras-gastos" };
    if (tab === "proveedores") return { rows: bySupplier, columns: supplierColumns as Column<unknown>[], title: "Reporte por proveedor", filename: "por-proveedor" };
    if (tab === "categorias") return { rows: byCategory, columns: categoryColumns as Column<unknown>[], title: "Reporte por categoría", filename: "por-categoria" };
    return null;
  }

  const exportable = currentExport();

  const paymentSplit = [
    { name: "Efectivo", value: summary.cash },
    { name: "Tarjeta", value: summary.card },
    { name: "Transferencia", value: summary.transfer },
  ].filter((p) => p.value > 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-0">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-lg px-3 py-2 text-sm ${
                tab === t ? "border-b-2 border-ink text-ink" : "text-ink-soft hover:text-ink"
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        {exportable && (
          <div className="mb-1 flex gap-2">
            <Button variant="ghost" onClick={() => exportXLSX(exportable.rows, exportable.columns, exportable.filename)}>
              XLSX
            </Button>
            <Button variant="ghost" onClick={() => exportCSV(exportable.rows, exportable.columns, exportable.filename)}>
              CSV
            </Button>
            <Button variant="ghost" onClick={() => exportPDF(exportable.title, exportable.rows, exportable.columns, exportable.filename)}>
              PDF
            </Button>
          </div>
        )}
      </div>

      {tab === "ventas" && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tickets</th>
                <th className="px-4 py-3">Productos</th>
                <th className="px-4 py-3">Efectivo</th>
                <th className="px-4 py-3">Tarjeta</th>
                <th className="px-4 py-3">Transferencia</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-ink">{s.sale_date}</td>
                  <td className="px-4 py-2 text-ink-soft">{s.num_orders}</td>
                  <td className="px-4 py-2 text-ink-soft">{s.num_products}</td>
                  <td className="figure px-4 py-2 text-ink-soft">{money(s.cash_amount)}</td>
                  <td className="figure px-4 py-2 text-ink-soft">{money(s.card_amount)}</td>
                  <td className="figure px-4 py-2 text-ink-soft">{money(s.transfer_amount)}</td>
                  <td className="figure px-4 py-2 text-ink">{money(s.total_amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-paper font-medium">
                <td className="px-4 py-2 text-ink" colSpan={6}>Total</td>
                <td className="figure px-4 py-2 text-ink">{money(summary.salesTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === "compras" && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Forma de pago</th>
                <th className="px-4 py-3">Monto</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-ink">{m.movement_date}</td>
                  <td className="px-4 py-2 text-ink-soft">{m.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-soft">{m.category?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-soft">{m.payment_method?.name ?? "—"}</td>
                  <td className="figure px-4 py-2 text-ink">{money(m.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-paper font-medium">
                <td className="px-4 py-2 text-ink" colSpan={4}>Total</td>
                <td className="figure px-4 py-2 text-ink">{money(summary.movementsTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {tab === "proveedores" && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">% del gasto total</th>
              </tr>
            </thead>
            <tbody>
              {bySupplier.map((s) => (
                <tr key={s.name} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-ink">{s.name}</td>
                  <td className="figure px-4 py-2 text-ink">{money(s.amount)}</td>
                  <td className="px-4 py-2">
                    <Pill tone="gold">{s.percent.toFixed(1)}%</Pill>
                  </td>
                </tr>
              ))}
              {bySupplier.length === 0 && (
                <tr><td className="px-4 py-6 text-center text-ink-soft" colSpan={3}>Sin movimientos con proveedor en este periodo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "categorias" && (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-xs uppercase text-ink-soft">
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">% del gasto total</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.name} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-ink">{c.name}</td>
                  <td className="figure px-4 py-2 text-ink">{money(c.amount)}</td>
                  <td className="px-4 py-2">
                    <Pill tone="gold">{summary.movementsTotal > 0 ? ((c.amount / summary.movementsTotal) * 100).toFixed(1) : "0.0"}%</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "graficas" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <p className="mb-3 text-sm font-medium text-ink">Ventas vs. gastos por día</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="ventas" stroke="#2f5346" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="gastos" stroke="#a3492f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-sm font-medium text-ink">Ventas por forma de pago</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={paymentSplit} dataKey="value" nameKey="name" outerRadius={90} label>
                  {paymentSplit.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-sm font-medium text-ink">Gastos por categoría</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byCategory.slice(0, 8)} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Bar dataKey="amount" fill="#b8863c" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-sm font-medium text-ink">Top proveedores</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bySupplier.slice(0, 8)} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Bar dataKey="amount" fill="#2f5346" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  );
}
