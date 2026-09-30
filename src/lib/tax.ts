/** Dado un monto TOTAL (con IVA incluido) a tasa 16%, regresa el IVA que contiene. */
export function calcIva16FromTotal(total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round(((total * 16) / 116) * 100) / 100;
}
