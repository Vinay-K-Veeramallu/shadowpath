import * as turf from "@turf/turf";
import type { Feature, LineString, MultiPolygon, Polygon } from "geojson";
import * as SunCalc from "suncalc";
import type { CampusGraph, GraphEdge, BuildingFootprintSpec, TreeCanopySpec } from "../graph/types";
import { legacyShadePercent } from "../graph/types";
import type { TimeSlotHour } from "../timeSlots";

const CAMPUS_LAT = 33.4255;
const CAMPUS_LNG = -111.94;

/** SunCalc: azimuth 0 = south, clockwise in radians. */
function shadowBearingFromNorthDeg(azimuthSouth0Rad: number): number {
  const sunBearingDeg = (180 + (azimuthSouth0Rad * 180) / Math.PI + 360) % 360;
  return (sunBearingDeg + 180) % 360;
}

function buildingShadowFeature(
  building: BuildingFootprintSpec,
  altitudeRad: number,
  shadowBearingDeg: number
): Feature<Polygon | MultiPolygon> | null {
  if (altitudeRad <= 0) return null;
  const L = building.heightMeters / Math.tan(altitudeRad);
  if (!Number.isFinite(L) || L > 5000) return null;
  try {
    const fp = turf.polygon(building.polygon.coordinates);
    const shifted = turf.transformTranslate(fp, L, shadowBearingDeg, {
      units: "meters",
    });
    const coll = turf.featureCollection([fp, shifted]);
    const hull = turf.convex(coll);
    if (!hull) return shifted;
    return hull;
  } catch {
    return null;
  }
}

function treeShadowCircle(
  tree: TreeCanopySpec,
  altitudeRad: number,
  shadowBearingDeg: number
): Feature<Polygon> | null {
  if (altitudeRad <= 0) return null;
  const L = tree.heightMeters / Math.tan(altitudeRad);
  if (!Number.isFinite(L) || L > 3000) return null;
  const reachM = tree.canopyRadiusMeters + L * 0.35;
  const center = turf.point([tree.lng, tree.lat]);
  const shifted = turf.transformTranslate(center, L * 0.45, shadowBearingDeg, {
    units: "meters",
  });
  return turf.circle(shifted, reachM / 1000, { steps: 36, units: "kilometers" });
}

function sampleShadeAlongLineString(
  line: LineString,
  buildingShadows: Array<Feature<Polygon | MultiPolygon>>,
  treeCircles: Array<{ poly: Feature<Polygon>; density: number }>
): number {
  const lineFeat = turf.lineString(line.coordinates);
  const lenKm = turf.length(lineFeat, { units: "kilometers" });
  const lenM = lenKm * 1000;
  const steps = Math.min(120, Math.max(12, Math.ceil(lenM / 4)));
  let acc = 0;
  for (let i = 0; i <= steps; i++) {
    const distKm = (i / steps) * lenKm;
    const pt = turf.along(lineFeat, distKm, { units: "kilometers" });
    let b = 0;
    for (const poly of buildingShadows) {
      if (turf.booleanPointInPolygon(pt, poly)) {
        b = 1;
        break;
      }
    }
    let t = 0;
    for (const { poly, density } of treeCircles) {
      if (turf.booleanPointInPolygon(pt, poly)) {
        t = Math.max(t, density);
      }
    }
    const combined = Math.min(1, b + (1 - b) * t);
    acc += combined;
  }
  return acc / (steps + 1);
}

/**
 * Computes per-edge shade fraction [0,1] for the campus graph at `when`.
 * Mutates each edge's `shadeFraction` field.
 */
export function attachShadeForDatetime(
  graph: CampusGraph,
  when: Date,
  timeSlot: TimeSlotHour
): void {
  if (graph.buildings.length === 0 && graph.trees.length === 0) {
    for (const edge of graph.edges.values()) {
      edge.shadeFraction = legacyShadePercent(edge, timeSlot) / 100;
    }
    return;
  }

  const pos = SunCalc.getPosition(when, CAMPUS_LAT, CAMPUS_LNG);
  const alt = pos.altitude;

  if (alt <= 0) {
    for (const edge of graph.edges.values()) {
      edge.shadeFraction = 1;
    }
    return;
  }

  const shadowBearing = shadowBearingFromNorthDeg(pos.azimuth);

  const buildingShadows: Array<Feature<Polygon | MultiPolygon>> = [];
  for (const b of graph.buildings) {
    const sh = buildingShadowFeature(b, alt, shadowBearing);
    if (sh) buildingShadows.push(sh);
  }

  const treeCircles: Array<{ poly: Feature<Polygon>; density: number }> = [];
  for (const tr of graph.trees) {
    const c = treeShadowCircle(tr, alt, shadowBearing);
    if (c) treeCircles.push({ poly: c, density: tr.canopyDensity });
  }

  for (const edge of graph.edges.values()) {
    edge.shadeFraction = sampleShadeAlongLineString(edge.geometry, buildingShadows, treeCircles);
  }
}

/** Ground-plane shadow length (m) from vertical object; infinity when sun at/below horizon. */
export function shadowLengthMeters(heightM: number, altitudeRad: number): number {
  if (altitudeRad <= 0) return Number.POSITIVE_INFINITY;
  return heightM / Math.tan(altitudeRad);
}

export function estimateWindCanyonFactor(
  edge: GraphEdge,
  buildings: BuildingFootprintSpec[]
): number {
  const mid = turf.midpoint(
    turf.point(edge.geometry.coordinates[0]),
    turf.point(edge.geometry.coordinates[edge.geometry.coordinates.length - 1])
  );
  let weightedH = 0;
  let w = 0;
  for (const b of buildings) {
    try {
      const c = turf.centroid(turf.polygon(b.polygon.coordinates));
      const dKm = turf.distance(mid, c, { units: "kilometers" });
      if (dKm < 0.08) {
        const weight = 1 / (dKm * 1000 + 5);
        weightedH += b.heightMeters * weight;
        w += weight;
      }
    } catch {
      /* skip */
    }
  }
  if (w === 0) return 1.15;
  const h = weightedH / w;
  const canyon = Math.min(1, h / 45);
  const factor = 1 - 0.45 * canyon + 0.15 * (1 - canyon);
  return Math.max(0.2, Math.min(2, factor));
}
