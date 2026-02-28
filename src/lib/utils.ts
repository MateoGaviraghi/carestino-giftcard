/**
 * Genera un código de seguridad único con el formato CARE-XXXX-XXXX
 */
export function generateSecurityCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O, 0, I, 1 para evitar confusión
  const segment = (len: number) =>
    Array.from({ length: len }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
  return `CARE-${segment(4)}-${segment(4)}`;
}

/**
 * Formatea una fecha a DD/MM/YYYY
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}
