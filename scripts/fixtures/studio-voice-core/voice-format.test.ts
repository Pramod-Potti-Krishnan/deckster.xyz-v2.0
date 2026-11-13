import { describe, expect, it } from "vitest";
import { CallCostMeter, formatCallCost, parseCostHeader } from "../../../lib/studio/voice/format";
describe("the running cost of a call (what the footer shows)", () => {
  it("adds the pieces up, shows fractions of a cent as '< $0.01', and adds a '+' when a piece had no price", () => {
    const m = new CallCostMeter();
    expect(m.label).toBe("≈ $0.00");
    m.add(0.0045); // hearing
    expect(m.label).toBe("< $0.01");
    m.add(0.032); // thinking
    m.add(0.0174); // speaking
    m.add(0.0004);
    expect(m.totalUsd).toBeCloseTo(0.0543, 6);
    expect(m.label).toBe("≈ $0.05");
    m.add(0.01);
    expect(m.label).toBe("≈ $0.06");
    m.add(null);
    expect(m.unknownCount).toBe(1);
    expect(m.label).toBe("≈ $0.06+");
    expect(formatCallCost(0.0031, 1)).toBe("< $0.01+");
    expect(formatCallCost(Number.NaN)).toBe("≈ $0.00");
  });

  it("reads the cost header (a plain decimal) and ignores anything else", () => {
    expect(parseCostHeader("0.00042000")).toBe(0.00042);
    expect(parseCostHeader("0.06")).toBe(0.06);
    for (const bad of [null, undefined, "", "abc", "1e-7", "-1", "0.1.2", "Infinity"]) expect(parseCostHeader(bad as string | null), String(bad)).toBeNull();
  });
});
