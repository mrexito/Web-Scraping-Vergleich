export function formatCHF(value: number | null | undefined): string {
  if (value == null) return "—";
  const s = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${s}`;
}
