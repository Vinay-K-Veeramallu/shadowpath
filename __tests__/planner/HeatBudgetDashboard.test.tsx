/**
 * HeatBudgetDashboard component tests
 * Validates: Requirements 4.1, 4.4, 4.6
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HeatBudgetDashboard } from "../../components/planner/HeatBudgetDashboard";
import type { HeatBudget, ScheduleTransition } from "../../lib/planner/types";
import { makeRouteResult } from "../helpers/graphTestUtils";

function makeMockTransition(overrides: Partial<{
  originLabel: string;
  destLabel: string;
  walkingTimeMinutes: number;
  riskLevel: string;
  exposureScore: number;
}>): ScheduleTransition {
  const {
    originLabel = "Building A",
    destLabel = "Building B",
    walkingTimeMinutes = 10,
    riskLevel = "lower-risk",
    exposureScore = 30,
  } = overrides;

  return {
    origin: { location: "b1", startTime: "10:00", flexibility: "fixed", label: originLabel },
    destination: { location: "b2", startTime: "11:00", flexibility: "fixed", label: destLabel },
    routeResult: makeRouteResult({
      durationMinutes: walkingTimeMinutes,
      shadePercentage: 40,
      sunExposureMinutes: 6,
      coolingStopCount: 1,
      coolingZoneCount: 1,
      exposureScore,
    }),
    segmentRisk: {
      walkingTimeMinutes,
      sunExposureMinutes: 6,
      shadePercentage: 40,
      coolingAvailability: 1,
      waterAvailability: 1,
      accessibilityCompliant: true,
      confidenceLabel: "High",
      riskLevel: riskLevel as any,
    },
    coolingRecommendation: null,
    waterRecommendation: null,
    shuttleAlternative: null,
  };
}

const mockBudget: HeatBudget = {
  totalBudget: 100,
  consumedBudget: 45,
  remainingBudget: 55,
  highestRiskTimeBlock: "2:00 PM – 4:30 PM",
  recommendedCoolingBreak: "Take a 10-min break at MU Cooling Station around 1:45 PM",
  estimatedReductionPercentage: 18,
};

const mockTransitions: ScheduleTransition[] = [
  makeMockTransition({ originLabel: "Coor Hall", destLabel: "W.P. Carey", walkingTimeMinutes: 12, riskLevel: "lower-risk", exposureScore: 30 }),
  makeMockTransition({ originLabel: "W.P. Carey", destLabel: "Memorial Union", walkingTimeMinutes: 15, riskLevel: "higher-risk", exposureScore: 65 }),
];

describe("HeatBudgetDashboard", () => {
  /** Validates: Requirement 4.1, 4.4 — Dashboard renders all required fields */
  it("renders remaining budget, consumed budget, highest-risk time block, cooling break, and estimated reduction", () => {
    render(<HeatBudgetDashboard budget={mockBudget} transitions={mockTransitions} />);

    // Consumed budget
    expect(screen.getByText("45%")).toBeTruthy();
    expect(screen.getByText("Consumed Budget")).toBeTruthy();

    // Remaining budget
    expect(screen.getByText("55%")).toBeTruthy();
    expect(screen.getByText("Remaining Budget")).toBeTruthy();

    // Highest-risk time block
    expect(screen.getByText("2:00 PM – 4:30 PM")).toBeTruthy();
    expect(screen.getByText("Highest-Risk Time Block")).toBeTruthy();

    // Estimated reduction
    expect(screen.getByText("18% vs shortest-route")).toBeTruthy();
    expect(screen.getByText("Estimated Reduction")).toBeTruthy();

    // Recommended cooling break
    expect(screen.getByText(/Take a 10-min break at MU Cooling Station/)).toBeTruthy();
    expect(screen.getByText("Recommended Cooling Break")).toBeTruthy();
  });

  /** Validates: Requirement 4.6 — ARIA labels on progress bar */
  it("renders a progress bar with proper role and aria attributes", () => {
    render(<HeatBudgetDashboard budget={mockBudget} transitions={mockTransitions} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeTruthy();
    expect(progressBar.getAttribute("aria-valuenow")).toBe("45");
    expect(progressBar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressBar.getAttribute("aria-valuemax")).toBe("100");
    expect(progressBar.getAttribute("aria-label")).toContain("45% consumed");
    expect(progressBar.getAttribute("aria-label")).toContain("55% remaining");
  });

  /** Validates: Requirement 4.6 — ARIA labels on data values */
  it("has ARIA labels on all data value elements", () => {
    render(<HeatBudgetDashboard budget={mockBudget} transitions={mockTransitions} />);

    expect(screen.getByLabelText(/Consumed budget: 45%/)).toBeTruthy();
    expect(screen.getByLabelText(/Remaining budget: 55%/)).toBeTruthy();
    expect(screen.getByLabelText(/Highest-risk time block: 2:00 PM – 4:30 PM/)).toBeTruthy();
    expect(screen.getByLabelText(/Estimated reduction: 18%/)).toBeTruthy();
    expect(screen.getByLabelText(/Recommended cooling break/)).toBeTruthy();
  });

  /** Validates: Requirement 4.4 — Cooling break section hidden when null */
  it("does not render cooling break section when recommendedCoolingBreak is null", () => {
    const budgetNoCooling: HeatBudget = {
      ...mockBudget,
      recommendedCoolingBreak: null,
    };

    render(<HeatBudgetDashboard budget={budgetNoCooling} transitions={mockTransitions} />);

    expect(screen.queryByText("Recommended Cooling Break")).toBeNull();
    expect(screen.queryByLabelText(/Recommended cooling break/)).toBeNull();
  });

  /** Validates: Requirement 4.1 — Dashboard section has accessible label */
  it("has an aria-label on the dashboard section", () => {
    render(<HeatBudgetDashboard budget={mockBudget} transitions={mockTransitions} />);

    const section = screen.getByLabelText("Heat budget dashboard");
    expect(section).toBeTruthy();
    expect(section.tagName.toLowerCase()).toBe("section");
  });
});
