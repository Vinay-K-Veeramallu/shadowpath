// Feature: shadow-path — UTCI-based heat safety gate

import { describe, it, expect } from "vitest";
import { test as testProp, fc } from "@fast-check/vitest";
import { evaluateSafetyFromUtci } from "../../lib/routing/heatSafetyGate";

testProp.prop([fc.double({ min: -5, max: 55, noNaN: true })], { numRuns: 100 })(
  "evaluateSafetyFromUtci matches UTCI thresholds",
  (utci) => {
    const v = evaluateSafetyFromUtci(utci);
    if (utci >= 38) return v === "not-recommended";
    if (utci >= 32) return v === "higher-risk";
    return v === "lower-risk";
  }
);

describe("evaluateSafetyFromUtci boundary conditions", () => {
  it("31.9 → lower-risk", () => {
    expect(evaluateSafetyFromUtci(31.9)).toBe("lower-risk");
  });

  it("32 → higher-risk", () => {
    expect(evaluateSafetyFromUtci(32)).toBe("higher-risk");
  });

  it("37.9 → higher-risk", () => {
    expect(evaluateSafetyFromUtci(37.9)).toBe("higher-risk");
  });

  it("38 → not-recommended", () => {
    expect(evaluateSafetyFromUtci(38)).toBe("not-recommended");
  });

  it("0 → lower-risk", () => {
    expect(evaluateSafetyFromUtci(0)).toBe("lower-risk");
  });
});
