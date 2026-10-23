import { describe, expect, it } from "vitest";
import { displayToKg, kgToDisplay, fmtWeight, displayToCm, cmToDisplay } from "./units";

describe("unit conversions", () => {
  it("round-trips kg <-> lb", () => {
    expect(displayToKg(kgToDisplay(80, "imperial"), "imperial")).toBeCloseTo(80, 6);
  });
  it("kg to lb", () => {
    expect(kgToDisplay(100, "imperial")).toBeCloseTo(220.46, 1);
  });
  it("round-trips cm <-> in", () => {
    expect(displayToCm(cmToDisplay(180, "imperial"), "imperial")).toBeCloseTo(180, 6);
  });
  it("formats weights", () => {
    expect(fmtWeight(80, "metric")).toBe("80.0 kg");
    expect(fmtWeight(null, "metric")).toBe("—");
  });
});
