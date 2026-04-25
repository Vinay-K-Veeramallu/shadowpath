import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why This Matters — HeatShield Planner",
  description:
    "How HeatShield Planner maps to the hackathon judging rubric: Potential Value, Implementation, and Quality & Design.",
};

export default function WhyThisMattersPage() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Why This Matters</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        HeatShield Planner was built for the Kiro Spark Challenge. This page maps
        the feature set to the three judging rubric categories so evaluators can
        quickly see how each capability contributes to the overall project.
      </p>

      {/* Potential Value */}
      <section
        aria-labelledby="potential-value-heading"
        className="mb-10"
      >
        <h2
          id="potential-value-heading"
          className="text-2xl font-semibold mb-4 border-b border-gray-200 dark:border-gray-700 pb-2"
        >
          Potential Value
        </h2>
        <p className="mb-4">
          Heat-related illness is a real risk on the ASU Tempe campus, where
          summer temperatures regularly exceed 110&nbsp;°F. HeatShield Planner
          addresses this by turning a single-route comparison tool into a
          full-day heat-risk planner.
        </p>

        <h3 className="text-lg font-semibold mb-2">Full-Day Planner</h3>
        <p className="mb-3">
          Users enter 2–5 campus commitments and receive per-transition
          heat-risk analysis for every walking segment in their day. Instead of
          checking one route at a time, the planner evaluates the entire
          schedule and highlights the riskiest segment automatically.
        </p>

        <h3 className="text-lg font-semibold mb-2">Heat Budget Dashboard</h3>
        <p className="mb-3">
          A visual heat budget shows how much of a daily exposure budget each
          walking segment consumes. Shaded routes, cooling stops, and shuttle
          alternatives reduce consumed budget — giving users a concrete way to
          see the cumulative benefit of heat-aware planning.
        </p>

        <h3 className="text-lg font-semibold mb-2">Shuttle Alternatives</h3>
        <p className="mb-4">
          When a walking segment is classified as &quot;higher-risk&quot; or
          &quot;not recommended,&quot; the planner recommends the nearest campus
          shuttle stop as an alternative. This provides a practical fallback
          that goes beyond &quot;avoid the heat&quot; advice and offers a
          concrete action.
        </p>
      </section>

      {/* Implementation */}
      <section
        aria-labelledby="implementation-heading"
        className="mb-10"
      >
        <h2
          id="implementation-heading"
          className="text-2xl font-semibold mb-4 border-b border-gray-200 dark:border-gray-700 pb-2"
        >
          Implementation
        </h2>
        <p className="mb-4">
          The planner is built as an additive module layer on top of the
          existing ShadowPath Route_Engine. No existing files were modified
          (except navigation links and the GeoJSON dataset). All new logic
          lives in <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">lib/planner/</code> and{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">components/planner/</code>.
        </p>

        <h3 className="text-lg font-semibold mb-2">Pure Utility Functions</h3>
        <p className="mb-3">
          Every planner computation — schedule transitions, segment risk,
          daily exposure, heat budget, safety evaluation, and recommendations —
          is implemented as a pure function with explicit inputs and outputs.
          No side effects, no hidden state. This makes the entire computation
          layer deterministic and independently testable.
        </p>

        <h3 className="text-lg font-semibold mb-2">TypeScript Types</h3>
        <p className="mb-3">
          All new data structures are defined in a single{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">lib/planner/types.ts</code>{" "}
          file: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">CampusCommitment</code>,{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">ScheduleTransition</code>,{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">HeatBudget</code>,{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">DailySafetyEvaluation</code>,
          and more. The type system enforces that risk levels are always one of
          &quot;lower-risk,&quot; &quot;higher-risk,&quot; or &quot;not
          recommended&quot; — the word &quot;safe&quot; cannot appear.
        </p>

        <h3 className="text-lg font-semibold mb-2">Property-Based Tests</h3>
        <p className="mb-4">
          The planner includes 16 correctness properties verified with
          Vitest and fast-check. These properties cover invariants like
          &quot;N commitments produce exactly N−1 transitions,&quot;
          &quot;consumed budget plus remaining budget always equals 100,&quot;
          and &quot;higher shade always reduces heat budget consumption.&quot;
          Each property runs a minimum of 100 iterations across randomly
          generated inputs, catching edge cases that example-based tests miss.
        </p>
      </section>

      {/* Quality & Design */}
      <section
        aria-labelledby="quality-design-heading"
        className="mb-10"
      >
        <h2
          id="quality-design-heading"
          className="text-2xl font-semibold mb-4 border-b border-gray-200 dark:border-gray-700 pb-2"
        >
          Quality &amp; Design
        </h2>
        <p className="mb-4">
          Quality is not just about code — it is about how the app communicates
          with users, who it includes, and how transparent it is about its
          limitations.
        </p>

        <h3 className="text-lg font-semibold mb-2">Responsible Language</h3>
        <p className="mb-3">
          The app never uses the word &quot;safe.&quot; All risk communication
          uses three carefully chosen labels: &quot;lower-risk,&quot;
          &quot;higher-risk,&quot; and &quot;not recommended.&quot;
          Recommendations are framed as options (&quot;consider leaving
          earlier&quot;) rather than directives (&quot;you must leave
          earlier&quot;). A prototype disclaimer on the Day Planner page
          reminds users that the planner uses demo data and estimated
          calculations for educational and planning purposes only.
        </p>

        <h3 className="text-lg font-semibold mb-2">Accessibility</h3>
        <p className="mb-3">
          Every new component is keyboard-navigable and screen-reader
          compatible. Form inputs have associated{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">&lt;label&gt;</code>{" "}
          elements. Toggle switches use{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">role=&quot;checkbox&quot;</code>{" "}
          with{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">aria-checked</code>.
          Risk badges use{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">role=&quot;status&quot;</code>{" "}
          with descriptive{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">aria-label</code>{" "}
          attributes. Color-coded indicators always include text labels so
          colour is never the sole means of conveying information.
        </p>

        <h3 className="text-lg font-semibold mb-2">Methodology Transparency</h3>
        <p className="mb-4">
          The Methodology page documents the Exposure_Score formula, all input
          variables and weights, data sources, known limitations, and
          responsible design decisions. The Kiro Process page shows the full
          spec-driven development artefacts — requirements, design, tasks, test
          plan, and experiment log — so evaluators can trace every feature back
          to a requirement and every test back to a correctness property.
        </p>
      </section>
    </article>
  );
}
