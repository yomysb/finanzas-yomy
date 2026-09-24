const BUSINESS_TIMEZONE = "America/Mexico_City";

/**
 * Fecha de "hoy" en la zona horaria del negocio (no UTC), como YYYY-MM-DD.
 * Evita que cerca de medianoche el servidor (en UTC) o el navegador del
 * usuario calculen un día distinto al que realmente es en México.
 */
export function todayISO(timeZone: string = BUSINESS_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
