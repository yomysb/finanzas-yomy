/**
 * Tarifa mensual del Art. 96 de la LISR, vigente para 2026 (Anexo 8 de la
 * Resolución Miscelánea Fiscal, publicado en el DOF el 28/12/2025).
 *
 * El SAT actualiza esta tabla cada año por inflación (normalmente se
 * publica en diciembre para el año siguiente). Cuando cambie el año fiscal,
 * ACTUALIZAR ESTE ARCHIVO con la tabla nueva — el resto del código no
 * necesita cambios.
 *
 * Fuente de referencia: Art. 96, Ley del Impuesto Sobre la Renta.
 */
export const ISR_TABLE_YEAR = 2026;

export type IsrBracket = {
  lowerLimit: number;
  fixedFee: number;
  rate: number; // porcentaje sobre el excedente del límite inferior, como fracción (0.0192 = 1.92%)
};

export const ISR_MONTHLY_BRACKETS_2026: IsrBracket[] = [
  { lowerLimit: 0.01, fixedFee: 0.0, rate: 0.0192 },
  { lowerLimit: 844.6, fixedFee: 16.22, rate: 0.064 },
  { lowerLimit: 7168.52, fixedFee: 420.95, rate: 0.1088 },
  { lowerLimit: 12598.03, fixedFee: 1011.68, rate: 0.16 },
  { lowerLimit: 14644.65, fixedFee: 1339.14, rate: 0.1792 },
  { lowerLimit: 17533.65, fixedFee: 1856.84, rate: 0.2136 },
  { lowerLimit: 35362.84, fixedFee: 5665.16, rate: 0.2352 },
  { lowerLimit: 55736.69, fixedFee: 10457.09, rate: 0.3 },
  { lowerLimit: 106410.51, fixedFee: 25659.23, rate: 0.32 },
  { lowerLimit: 141880.67, fixedFee: 37009.69, rate: 0.34 },
  { lowerLimit: 425642.0, fixedFee: 133488.54, rate: 0.35 },
];

/**
 * Aplica la tarifa progresiva mensual del Art. 96 a una base gravable
 * mensual. No aplica subsidio al empleo (es para ingresos por actividad
 * empresarial, no salarios) ni ningún otro acreditamiento.
 */
export function applyMonthlyIsrTariff(monthlyBase: number): number {
  if (monthlyBase <= 0) return 0;
  const bracket = [...ISR_MONTHLY_BRACKETS_2026]
    .reverse()
    .find((b) => monthlyBase >= b.lowerLimit);
  if (!bracket) return 0;
  const excess = monthlyBase - bracket.lowerLimit;
  return bracket.fixedFee + excess * bracket.rate;
}
