/** Formats a counter with thousands separators. */
export function formatCount(n: number): string {
  return n.toLocaleString()
}

/** Formats a per-second rate, rounded to a whole number. */
export function formatRate(n: number): string {
  return `${Math.round(n).toLocaleString()}/s`
}
