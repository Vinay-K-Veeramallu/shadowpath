/**
 * Accessibility audits using axe-core / jest-axe
 * Requirements: 1.4, 10.2, 10.3, 7.5, 8.5, 9.3
 */
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { expect, describe, it } from "vitest";
import { RouteResultPanel } from "../../components/RouteResultPanel";
import { HighContrastContext } from "../../contexts/HighContrastContext";
import type { RouteResult } from "../../lib/routing/types";
import { makeRouteResult } from "../helpers/graphTestUtils";

expect.extend(toHaveNoViolations);

const mockRoute: RouteResult = makeRouteResult({
  type: ["shortest"],
  path: ["node-1", "node-2"],
  distanceMeters: 500,
  durationMinutes: 6,
  shadePercentage: 60,
  sunExposureMinutes: 2,
  coolingStopCount: 0,
  exposureScore: 42,
  confidenceLabel: "High",
  safetyVerdict: "lower-risk",
  dataSources: ["campus.geojson", "NWS API"],
  assumptions: ["Average walking speed 5 km/h"],
});

const mockUnsafeRoute: RouteResult = {
  ...mockRoute,
  type: ["shade-aware"],
  exposureScore: 80,
  safetyVerdict: "not-recommended",
  averageUtciC: 40,
  confidenceLabel: "Low",
};

// Wrap with a direct context value to avoid localStorage dependency in tests
function withHighContrastContext(ui: React.ReactElement) {
  return (
    <HighContrastContext.Provider value={{ highContrast: false, toggleHighContrast: () => {} }}>
      {ui}
    </HighContrastContext.Provider>
  );
}

describe("Accessibility audits", () => {
  it("RouteResultPanel with results has no axe violations", async () => {
    const { container } = render(
      withHighContrastContext(
        <RouteResultPanel results={[mockRoute]} loading={false} />
      )
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("RouteResultPanel in loading state has no axe violations", async () => {
    const { container } = render(
      withHighContrastContext(
        <RouteResultPanel results={[]} loading={true} />
      )
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("RouteResultPanel with unsafe routes has no axe violations", async () => {
    const { container } = render(
      withHighContrastContext(
        <RouteResultPanel results={[mockUnsafeRoute]} loading={false} />
      )
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Methodology page content has no axe violations", async () => {
    const { container } = render(
      <main>
        <article>
          <h1>Methodology</h1>
          <section aria-labelledby="exposure-score-heading">
            <h2 id="exposure-score-heading">How Exposure_Score is Calculated</h2>
            <p>
              Each route is assigned an <strong>Exposure_Score</strong> between 0 and 100.
            </p>
            <pre aria-label="Exposure Score formula">
              {`Exposure_Score = clamp(W_duration * normDuration + W_shade * (1 - shade/100), 0, 100) * 100`}
            </pre>
          </section>
          <section aria-labelledby="data-sources-heading">
            <h2 id="data-sources-heading">Data Sources</h2>
            <p>Campus data is sourced from campus.geojson and the National Weather Service API.</p>
          </section>
          <section aria-labelledby="limitations-heading">
            <h2 id="limitations-heading">Known Limitations</h2>
            <ul>
              <li>Hackathon-quality data with manually seeded values.</li>
              <li>No real-time shade sensors.</li>
              <li>Three static time snapshots only.</li>
            </ul>
          </section>
          <section aria-labelledby="design-decisions-heading">
            <h2 id="design-decisions-heading">Responsible Design Decisions</h2>
            <p>The Heat_Safety_Gate threshold of 75 is based on OSHA heat stress guidelines.</p>
          </section>
        </article>
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
