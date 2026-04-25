---
inclusion: auto
---

# HeatShield Planner — Product Context

HeatShield Planner is an add-on feature for the ShadowPath campus routing app. While ShadowPath handles single-route comparison between two campus locations, HeatShield Planner extends the app into a full-day heat-risk planner with the tagline: "Plan your school day around heat, not just time."

## Core Concept

Users enter 2–5 campus commitments for their day. The planner calculates route segments between each consecutive pair, produces per-transition heat-risk analysis, aggregates a daily heat exposure budget, identifies the highest-risk segment, and recommends cooling breaks, water refills, and shuttle alternatives.

## Architecture Boundaries

- All new planner logic lives in `lib/planner/` and `components/planner/`.
- The existing Route_Engine is called but never modified.
- Shuttle stops are read directly from the GeoJSON dataset — they are NOT added to the routing graph.
- All planner utility functions are pure (explicit inputs, explicit outputs, no side effects).

## Data Context

- All campus data is manually seeded demo data for the hackathon and does not reflect real-time conditions.
- Weather data uses a demo fallback (105°F) when the API is unavailable.
- The planner is intended for planning and awareness purposes only — not a substitute for official heat safety guidance.
