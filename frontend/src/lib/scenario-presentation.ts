import type { Pollutant } from "@emission-lens/contracts";

/** UI values only; transport fields are mapped from documented backend types. */
export interface PollutantComparisonInput {
  pollutant: Pollutant;
  baseline: number | null;
  scenario: number | null;
  changeGrams: number | null;
  changePercent: number | null;
}

const finite = (value: number | null): number | null =>
  value !== null && Number.isFinite(value) ? value : null;

/** Preserve signed backend changes; never derive savings or fill a missing side. */
export function presentPollutantComparison(input: PollutantComparisonInput) {
  const baseline = finite(input.baseline);
  const scenario = finite(input.scenario);
  const comparable = baseline !== null && scenario !== null;
  return {
    pollutant: input.pollutant,
    label: input.pollutant === "co2" ? "Estimated CO₂" : "Estimated NOₓ",
    baseline,
    scenario,
    changeGrams: comparable ? finite(input.changeGrams) : null,
    changePercent:
      comparable && baseline !== 0 && finite(input.changeGrams) !== null
        ? finite(input.changePercent)
        : null,
  };
}

/** Enough precision for small NOx totals; positive changes remain increases. */
export function scenarioValue(value: number | null, unit: "g" | "%", signed = false): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const digits = unit === "g" ? 6 : 2;
  const magnitude = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    ...(value !== 0 && Math.abs(value) < 10 ** -digits
      ? { notation: "scientific" as const }
      : {}),
  }).format(Math.abs(value));
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  return `${sign}${magnitude}${unit === "g" ? " " : ""}${unit}`;
}

export const signedScenarioValue = (value: number | null, unit: "g" | "%") =>
  scenarioValue(value, unit, true);
