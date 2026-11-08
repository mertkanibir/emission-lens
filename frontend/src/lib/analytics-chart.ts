/** Integer count axes start at zero and round upward without changing any observation. */
export function crossingAxis(values: readonly (number | null)[]) {
  const maximum = Math.max(0, ...values.filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0));
  const target = Math.max(1, maximum / 4);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= target)!;
  const ceiling = Math.max(step, Math.ceil(maximum / step) * step);
  return { maximum, ceiling, ticks: Array.from({ length: Math.round(ceiling / step) + 1 }, (_, index) => index * step) };
}

/** Keep a small number of exact temporal anchors, including both visible endpoints. */
export function timeTickIndexes(length: number): number[] {
  if (!Number.isSafeInteger(length) || length <= 0) return [];
  return [...new Set([0, Math.round((length - 1) / 3), Math.round(2 * (length - 1) / 3), length - 1])];
}
