# ShadowPath — 2-Minute Demo Script

A guided walkthrough of the core ShadowPath experience. Estimated time: ~2 minutes.

---

## 1. Load the App

Open [http://localhost:3000](http://localhost:3000).

> The home page loads with the route input form, a MapLibre campus map, and an empty result panel. The navigation bar shows links to **Methodology** and **Kiro Process**, plus a **High Contrast** toggle.

---

## 2. Enter a Route

In the **Origin** field, type:
```
Memorial Union
```

In the **Destination** field, type:
```
Hayden Library
```

Leave **Accessibility Mode** off. Click **Find Routes**.

> The result panel populates with three route cards: **Shortest**, **Shade-Aware**, and **Cooling-Stop**. Each card shows shade %, sun exposure minutes, Exposure_Score (0–100), a Confidence_Label, and a **Heat_Safety_Gate** badge.

---

## 3. Move the Shade_Slider

### 10 AM → 2 PM

Drag the Shade_Slider (or press **ArrowRight**) to **2 PM**.

> Routes recompute instantly — no page reload. Exposure_Scores increase as midday heat rises. Watch the Heat_Safety_Gate badges — routes may flip from **Safe** to **Unsafe**.

### 2 PM → 6 PM

Move the slider to **6 PM**.

> Shade coverage improves as the sun angle drops. Exposure_Scores decrease. The map shade overlay updates its colour ramp (dark green = high shade, red = low shade).

---

## 4. Compare the Three Routes

| Route | What to notice |
|---|---|
| **Shortest** | Lowest distance, often highest Exposure_Score — cuts across open plazas |
| **Shade-Aware** | Slightly longer, meaningfully lower Exposure_Score when shade is high |
| **Cooling-Stop** | May be longest, but includes air-conditioned buildings or misting stations |

> The text summary below the map mirrors all three results in plain text for screen reader users.

---

## 5. Observe the Heat_Safety_Gate Badge

Switch the slider back to **2 PM** (peak heat).

> If any route's Exposure_Score exceeds **75**, its badge turns red: **"⚠️ Not Recommended"**. If all three routes are unsafe, the panel recommends waiting, taking a campus shuttle, or visiting the nearest cooling point. No route is ever labelled "safe" when the gate fires.

---

## 6. Toggle High Contrast Mode

Click **High Contrast** in the navigation bar.

> The colour scheme switches to a high-contrast palette (minimum 7:1 contrast ratio). The map shade overlay switches from green–yellow–red to blue–white–orange. Toggle off to return to the default theme.

---

## 7. Navigate to the Methodology Page

Click **Methodology** in the navigation bar.

> Explains the Exposure_Score formula, data sources (campus.geojson, NWS API), known limitations (hackathon data, no real-time sensors), and responsible design decisions (Heat_Safety_Gate threshold rationale, Confidence_Label system, demo-data fallback, accessibility-first routing).

---

## 8. Navigate to the Kiro Process Page

Click **Kiro Process** in the navigation bar.

> Surfaces the full spec-driven development artefacts: requirements, design, task list, test plan (14 correctness properties P1–P14), and experiment log. A sticky in-page table of contents lets you jump between sections with keyboard-accessible anchor links.

---

## Done

That's the full ShadowPath experience in under 2 minutes. The core loop — enter a route, move the slider, compare safety scores — is designed to be immediately understandable and actionable, even in the middle of a 110°F Tempe afternoon.


---

# HeatShield Planner — 2-Minute Demo Script

A guided walkthrough of the full-day HeatShield Planner experience. Estimated time: ~2 minutes.

---

## 1. Open the Day Planner (~10 seconds)

Click **Day Planner** in the navigation bar.

> The Day Planner page loads with an empty schedule form, a Personal Heat Mode settings panel, and a prototype disclaimer noting that the planner uses demo data and estimated calculations for educational and planning purposes only.

---

## 2. Load the Demo Schedule (~10 seconds)

Click the **Load Demo Schedule** button.

> Four campus commitments populate the form:
> - 10:30 AM — Coor Hall
> - 12:00 PM — W.P. Carey
> - 2:00 PM — Memorial Union
> - 4:30 PM — Hayden Library
>
> Each row shows the location, start time, flexibility toggle, and label.

---

## 3. Review Personal Heat Mode Settings (~15 seconds)

In the **Personal Heat Mode** panel, toggle on:
- **Prefer shaded paths**
- **Prefer shuttle alternatives during high-risk periods**

> The panel shows 8 toggleable preferences. Each toggle is a labeled checkbox, keyboard-navigable and screen-reader compatible. Selections persist for the session.

---

## 4. Submit and View Per-Transition Results (~20 seconds)

Click **Plan My Day**.

> The planner computes 3 route transitions (4 commitments → 3 segments). Each **Transition Card** shows:
> - Origin → Destination and time window
> - Walking time, sun exposure, shade %, cooling/water availability
> - Confidence Label and Risk Level badge
> - Cooling, water, and shuttle recommendations where applicable
>
> Cards are ordered by schedule time. The highest-risk segment is visually highlighted.

---

## 5. View the Heat Budget Dashboard (~15 seconds)

Scroll to the **Heat Budget** dashboard.

> A segmented progress bar shows daily heat exposure budget consumption, color-coded by risk level. The dashboard displays:
> - Remaining budget vs. consumed budget
> - Highest-risk time block (e.g., "2:00 PM – 4:30 PM")
> - Recommended cooling break timing
> - Estimated heat exposure reduction compared to shortest-route-only planning
>
> All visual indicators have ARIA labels for screen reader accessibility.

---

## 6. Review the Highest-Risk Segment Explanation (~20 seconds)

Scroll to the **Highest-Risk Segment** explanation card.

> The card identifies the worst transition (e.g., Memorial Union → Hayden Library at 2:00 PM) and explains why: low shade coverage, high midday heat exposure, long walking duration. The Risk Level badge shows the classification.
>
> At least 3 recommended actions are listed. Because **Prefer shuttle alternatives** is enabled and the segment is high-risk, the shuttle recommendation appears first:
> 1. Use the University Drive Shuttle Stop (8-min wait, wheelchair-accessible)
> 2. Stop at a cooling point for a 10-minute break
> 3. Refill water at the nearest water station
>
> Additional suggestions may include leaving earlier or waiting for a cooler period.

---

## 7. View Shuttle and Cooling Recommendations (~15 seconds)

Review the **Shuttle Recommendation** and **Cooling/Water Recommendation** sections on the high-risk transition card.

> The shuttle recommendation shows: stop name, estimated wait time, walking distance from the transition origin, and wheelchair accessibility status.
>
> The cooling recommendation shows: cooling point name, distance from route, suggested break duration (5–15 min), and reason. The water recommendation shows: refill point name and distance.

---

## 8. Close with Why This Matters (~15 seconds)

Click **Why This Matters** in the navigation bar.

> The page maps HeatShield Planner features to hackathon judging rubric categories:
> - **Potential Value**: Full-day planner, heat budget dashboard, and shuttle alternatives address real campus heat safety needs
> - **Implementation**: Pure utility functions, TypeScript types, and property-based tests demonstrate engineering rigour
> - **Quality & Design**: Responsible language (never "safe"), accessibility-first components, and methodology transparency
>
> This is the closing slide — it connects everything the judges just saw to the evaluation criteria.

---

## Done

That's the full HeatShield Planner experience in under 2 minutes. The flow — load a schedule, configure preferences, review per-transition risks, check the heat budget, understand the highest-risk segment, and see actionable recommendations — turns a campus walk into a heat-aware plan for the day.
