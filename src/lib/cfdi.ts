"use client";

export type CfdiConcept = {
  id: string;
  description: string;
  amount: number; // importe (antes de IVA) de este concepto
  ivaAmount: number; // IVA de este concepto (0 si es tasa 0% o exento)
};

export type ParsedCfdi = {
  uuid: string | null;
  issuerRfc: string | null;
  issuerName: string | null;
  receiverRfc: string | null;
  date: string | null; // YYYY-MM-DD
  subtotalDeclared: number;
  totalDeclared: number;
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

export function parseCfdiXml(xmlText: string): ParsedCfdi {
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
    return { id: `c${i}`, description, amount, ivaAmount };
  });

  if (concepts.length === 0) {
    throw new Error("No se encontraron conceptos en el XML — ¿es realmente un CFDI?");
  }

  return {
    uuid: timbre?.getAttribute("UUID") ?? null,
    issuerRfc: emisor?.getAttribute("Rfc") ?? null,
    issuerName: emisor?.getAttribute("Nombre") ?? null,
    receiverRfc: receptor?.getAttribute("Rfc") ?? null,
    date,
    subtotalDeclared: num(comprobante.getAttribute("SubTotal")),
    totalDeclared: num(comprobante.getAttribute("Total")),
    concepts,
  };
}
