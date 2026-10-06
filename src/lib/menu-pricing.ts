// Ingeniería de Menú: toda la matemática de precios vive aquí, en un solo lugar,
// para que la tabla, el modal (con recálculo en vivo) y cualquier reporte futuro
// usen exactamente la misma fórmula.

export const IVA_RATE = 0.16;

export type MenuPricingInput = {
  productionCost: number;
  salePrice: number;
  tpvCommissionPct: number; // ej. 2.2 = 2.2%
  targetMarginPct: number; // ej. 50 = 50%
};

export type MenuPricingResult = {
  /** Precio de venta sin IVA (el precio al público ya lo incluye). */
  priceBeforeTax: number;
  /** IVA contenido en el precio de venta. */
  ivaAmount: number;
  /** Comisión de la terminal (TPV), en pesos, sobre el precio antes de IVA. */
  tpvCommissionAmount: number;
  /** Utilidad neta en pesos, pagando con tarjeta (con comisión TPV). */
  netProfitCard: number;
  /** Utilidad neta en pesos, pagando en efectivo (sin comisión TPV). */
  netProfitCash: number;
  /** Margen % = utilidad / precio antes de IVA. Con tarjeta por default. */
  marginPctCard: number;
  marginPctCash: number;
  /** Markup % = utilidad / costo. */
  markupPctCard: number;
  markupPctCash: number;
  /** Precio de venta al público (con IVA) necesario para alcanzar el margen objetivo. */
  suggestedPriceCard: number;
  suggestedPriceCash: number;
  /** true si el margen actual (con tarjeta) está por debajo del objetivo. */
  belowTarget: boolean;
  /** true si está por debajo del objetivo pero dentro de 5 puntos — zona de alerta amarilla. */
  nearTarget: boolean;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * A partir de un precio de venta al público (con IVA) y un margen objetivo,
 * despeja el precio antes de IVA que se necesitaría para alcanzarlo:
 *   margen = (precioAntesIva - costo - comisión) / precioAntesIva
 *   comisión = precioAntesIva * comisiónPct
 *   => precioAntesIva = costo / (1 - margenObjetivo - comisiónPct)
 */
function suggestedPriceBeforeTax(productionCost: number, tpvCommissionPct: number, targetMarginPct: number): number {
  const commission = tpvCommissionPct / 100;
  const target = targetMarginPct / 100;
  const denominator = 1 - target - commission;
  if (denominator <= 0) return Infinity; // el objetivo es matemáticamente imposible con esa comisión
  return productionCost / denominator;
}

export function calcMenuPricing(input: MenuPricingInput): MenuPricingResult {
  const { productionCost, salePrice, tpvCommissionPct, targetMarginPct } = input;

  const priceBeforeTax = salePrice / (1 + IVA_RATE);
  const ivaAmount = salePrice - priceBeforeTax;
  const tpvCommissionAmount = priceBeforeTax * (tpvCommissionPct / 100);

  const netProfitCard = priceBeforeTax - productionCost - tpvCommissionAmount;
  const netProfitCash = priceBeforeTax - productionCost;

  const marginPctCard = priceBeforeTax > 0 ? (netProfitCard / priceBeforeTax) * 100 : 0;
  const marginPctCash = priceBeforeTax > 0 ? (netProfitCash / priceBeforeTax) * 100 : 0;

  const markupPctCard = productionCost > 0 ? (netProfitCard / productionCost) * 100 : 0;
  const markupPctCash = productionCost > 0 ? (netProfitCash / productionCost) * 100 : 0;

  const suggestedBeforeTaxCard = suggestedPriceBeforeTax(productionCost, tpvCommissionPct, targetMarginPct);
  const suggestedBeforeTaxCash = suggestedPriceBeforeTax(productionCost, 0, targetMarginPct);

  return {
    priceBeforeTax: round2(priceBeforeTax),
    ivaAmount: round2(ivaAmount),
    tpvCommissionAmount: round2(tpvCommissionAmount),
    netProfitCard: round2(netProfitCard),
    netProfitCash: round2(netProfitCash),
    marginPctCard: round2(marginPctCard),
    marginPctCash: round2(marginPctCash),
    markupPctCard: round2(markupPctCard),
    markupPctCash: round2(markupPctCash),
    suggestedPriceCard: Number.isFinite(suggestedBeforeTaxCard) ? round2(suggestedBeforeTaxCard * (1 + IVA_RATE)) : Infinity,
    suggestedPriceCash: Number.isFinite(suggestedBeforeTaxCash) ? round2(suggestedBeforeTaxCash * (1 + IVA_RATE)) : Infinity,
    belowTarget: marginPctCard < targetMarginPct,
    nearTarget: marginPctCard < targetMarginPct && marginPctCard >= targetMarginPct - 5,
  };
}
