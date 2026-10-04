/** Formatea pesos colombianos enteros con punto de miles: 9000 -> "$9.000". */
export function formatCop(amount: number): string {
  const n = Math.round(amount);
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
