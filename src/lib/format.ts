/** ₹-aware formatting helpers. Currency is Indian Rupee throughout, with Indian
 *  digit grouping (lakh/crore) and compact Cr/L forms for big AUM figures. */

const inr0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(n: number): string {
  return inr0.format(Math.round(n));
}

/** Compact ₹ for AUM: ₹1.24 Cr / ₹45.2 L / ₹8,400. */
export function formatINRCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return formatINR(n);
}

export function formatSignedINR(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatINR(Math.abs(n))}`;
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function formatSignedPct(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

/** Units: whole for shares, up to 2dp for fractional MF/ETF units. */
export function formatUnits(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString("en-IN")
    : rounded.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
