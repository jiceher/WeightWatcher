export type Units = "metric" | "imperial";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function kgToDisplay(kg: number, units: Units): number {
  return units === "imperial" ? kg / KG_PER_LB : kg;
}

export function displayToKg(v: number, units: Units): number {
  return units === "imperial" ? v * KG_PER_LB : v;
}

export function cmToDisplay(cm: number, units: Units): number {
  return units === "imperial" ? cm / CM_PER_IN : cm;
}

export function displayToCm(v: number, units: Units): number {
  return units === "imperial" ? v * CM_PER_IN : v;
}

export function weightUnit(units: Units): string {
  return units === "imperial" ? "lb" : "kg";
}

export function fmtWeight(kg: number | null | undefined, units: Units, digits = 1): string {
  if (kg == null || isNaN(kg)) return "—";
  return `${kgToDisplay(kg, units).toFixed(digits)} ${weightUnit(units)}`;
}

export function fmtSigned(kg: number | null | undefined, units: Units): string {
  if (kg == null || isNaN(kg)) return "—";
  const v = kgToDisplay(kg, units);
  return `${v > 0 ? "+" : ""}${v.toFixed(1)} ${weightUnit(units)}`;
}
