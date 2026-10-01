"use client";

export type CfdiConcept = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitValue: number;
  amount: number; // importe (antes de IVA) de este concepto
  ivaAmount: number; // IVA de este concepto (0 si es tasa 0% o exento)
};

export type ParsedCfdi = {
  uuid: string | null;
  filename: string;
  tipo: string | null; // I = ingreso, E = egreso, etc.
  serie: string | null;
  folio: string | null;
  fecha: string | null; // fecha-hora completa del XML
  date: string | null; // YYYY-MM-DD
  moneda: string | null;
  metodoPago: string | null;
  formaPago: string | null;
  usoCFDI: string | null;
  issuerRfc: string | null;
  issuerName: string | null;
  receiverRfc: string | null;
  receiverName: string | null;
  subtotalDeclared: number;
  totalDeclared: number;
  ivaTrasladado: number;
  ieps: number;
  ivaRetenido: number;
  isrRetenido: number;
  concepts: CfdiConcept[];
};

function byLocalName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter((el) => el.localName === name);
}

function firstByLocalName(root: Document | Element, name: string): Element | null {
  return byLocalName(root, name)[0] ?? null;
}

function num(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: string | null | undefined): string | null {
  return v && v.trim() ? v.trim() : null;
}

export function parseCfdiXml(xmlText: string, filename = ""): ParsedCfdi {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("El archivo no es un XML válido.");
  }

  const comprobante = firstByLocalName(doc, "Comprobante") ?? doc.documentElement;
  const emisor = firstByLocalName(doc, "Emisor");
  const receptor = firstByLocalName(doc, "Receptor");
  const timbre = firstByLocalName(doc, "TimbreFiscalDigital");

  const fechaRaw = comprobante.getAttribute("Fecha"); // 2026-09-24T13:05:00
  const date = fechaRaw ? fechaRaw.slice(0, 10) : null;

  const concepts: CfdiConcept[] = byLocalName(doc, "Concepto").map((el, i) => {
    const description = el.getAttribute("Descripcion") ?? `Concepto ${i + 1}`;
    const amount = num(el.getAttribute("Importe")) - num(el.getAttribute("Descuento"));
    const traslados = byLocalName(el, "Traslado").filter((t) => (t.getAttribute("Impuesto") ?? "002") === "002");
    const ivaAmount = traslados.reduce((s, t) => s + num(t.getAttribute("Importe")), 0);
    return {
      id: `c${i}`,
      description,
      quantity: num(el.getAttribute("Cantidad")),
      unit: el.getAttribute("Unidad") ?? "",
      unitValue: num(el.getAttribute("ValorUnitario")),
      amount,
      ivaAmount,
    };
  });

  if (concepts.length === 0) {
    throw new Error("No se encontraron conceptos en el XML — ¿es realmente un CFDI?");
  }

  // Impuestos a nivel comprobante (más confiable para IEPS/retenciones que sumar por concepto)
  let ivaTrasladado = 0;
  let ieps = 0;
  let ivaRetenido = 0;
  let isrRetenido = 0;
  const impuestos = firstByLocalName(doc, "Impuestos");
  if (impuestos) {
    const traslados = firstByLocalName(impuestos, "Traslados");
    if (traslados) {
      for (const t of byLocalName(traslados, "Traslado")) {
        const tipo = t.getAttribute("Impuesto") ?? "002";
        const importe = num(t.getAttribute("Importe"));
        if (tipo === "002") ivaTrasladado += importe;
        else if (tipo === "003") ieps += importe;
      }
    }
    const retenciones = firstByLocalName(impuestos, "Retenciones");
    if (retenciones) {
      for (const r of byLocalName(retenciones, "Retencion")) {
        const tipo = r.getAttribute("Impuesto") ?? "";
        const importe = num(r.getAttribute("Importe"));
        if (tipo === "002") ivaRetenido += importe;
        else if (tipo === "001") isrRetenido += importe;
      }
    }
  }
  // Si el comprobante no desglosa Impuestos a nivel raíz, usa la suma por concepto.
  if (ivaTrasladado === 0) ivaTrasladado = concepts.reduce((s, c) => s + c.ivaAmount, 0);

  return {
    uuid: timbre?.getAttribute("UUID") ?? null,
    filename,
    tipo: str(comprobante.getAttribute("TipoDeComprobante")),
    serie: str(comprobante.getAttribute("Serie")),
    folio: str(comprobante.getAttribute("Folio")),
    fecha: fechaRaw,
    date,
    moneda: str(comprobante.getAttribute("Moneda")),
    metodoPago: str(comprobante.getAttribute("MetodoPago")),
    formaPago: str(comprobante.getAttribute("FormaPago")),
    usoCFDI: str(receptor?.getAttribute("UsoCFDI") ?? null),
    issuerRfc: emisor?.getAttribute("Rfc") ?? null,
    issuerName: emisor?.getAttribute("Nombre") ?? null,
    receiverRfc: receptor?.getAttribute("Rfc") ?? null,
    receiverName: receptor?.getAttribute("Nombre") ?? null,
    subtotalDeclared: num(comprobante.getAttribute("SubTotal")),
    totalDeclared: num(comprobante.getAttribute("Total")),
    ivaTrasladado,
    ieps,
    ivaRetenido,
    isrRetenido,
    concepts,
  };
}
