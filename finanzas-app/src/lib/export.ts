"use client";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type Column<T> = { key: keyof T; label: string; format?: (v: T[keyof T]) => string };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cell<T>(row: T, col: Column<T>): string {
  const raw = row[col.key];
  return col.format ? col.format(raw) : String(raw ?? "");
}

export function exportXLSX<T>(rows: T[], columns: Column<T>[], filename: string, sheetName = "Datos") {
  const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, cell(r, c)])));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportCSV<T>(rows: T[], columns: Column<T>[], filename: string) {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((r) => columns.map((c) => escape(cell(r, c))).join(","));
  const csv = [header, ...lines].join("\n");
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
}

export function exportPDF<T>(title: string, rows: T[], columns: Column<T>[], filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(13);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  autoTable(doc, {
    startY: 20,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => cell(r, c))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 36, 31] },
  });
  doc.save(`${filename}.pdf`);
}
