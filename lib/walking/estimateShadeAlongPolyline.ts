import * as turf from "@turf/turf";
import type { CampusGraph, GraphEdge } from "../graph/types";
import { edgeShadeFraction01 } from "../graph/types";
import type { TimeSlotHour } from "../timeSlots";

const SAMPLE_STEP_M = 28;
const MAX_MATCH_M = 85;

function pointToSegmentMeters(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-12) return turf.distance(turf.point([ax, ay]), turf.point([px, py]), { units: "kilometers" }) * 1000;
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * abx;
  const qy = ay + t * aby;
  return turf.distance(turf.point([px, py]), turf.point([qx, qy]), { units: "kilometers" }) * 1000;
}

function nearestEdgeShade(
  lng: number,
  lat: number,
  edges: GraphEdge[],
  timeSlot: TimeSlotHour
): { shade: number; matched: boolean } {
  let bestD = Infinity;
  let shade = 0.45;
  for (const e of edges) {
    const coords = e.geometry.coordinates as [number, number][];
    for (let i = 1; i < coords.length; i++) {
      const [ax, ay] = coords[i - 1];
      const [bx, by] = coords[i];
      const d = pointToSegmentMeters(lng, lat, ax, ay, bx, by);
      if (d < bestD) {
        bestD = d;
        shade = edgeShadeFraction01(e, timeSlot);
      }
    }
  }
  if (bestD > MAX_MATCH_M) return { shade: 0.45, matched: false };
  return { shade, matched: true };
}

export interface PolylineShadeStats {
  shadePercent: number;
  matchedSampleRatio: number;
}

/**
 * Estimates mean shade fraction [0,1] along an OSM/Google walking line by
 * sampling the campus path graph in the neighbourhood of each sample point.
 */
export function estimateMeanShadeAlongPolyline(
  line: GeoJSON.LineString,
  graph: CampusGraph,
  timeSlot: TimeSlotHour
): number {
  return estimateShadeStatsAlongPolyline(line, graph, timeSlot).shadePercent / 100;
}

export function estimateShadeStatsAlongPolyline(
  line: GeoJSON.LineString,
  graph: CampusGraph,
  timeSlot: TimeSlotHour
): PolylineShadeStats {
  const edges = [...graph.edges.values()];
  if (edges.length === 0 || line.coordinates.length < 2) {
    return { shadePercent: 45, matchedSampleRatio: 0 };
  }

  const lenM =
    turf.length({ type: "Feature", properties: {}, geometry: line }, { units: "kilometers" }) * 1000;
  if (!Number.isFinite(lenM) || lenM <= 0) {
    return { shadePercent: 45, matchedSampleRatio: 0 };
  }
  const steps = Math.max(2, Math.ceil(lenM / SAMPLE_STEP_M));
  let sum = 0;
  let n = 0;
  let matched = 0;
  for (let s = 0; s <= steps; s++) {
    const distKm = (lenM * (s / steps)) / 1000;
    const pt = turf.along({ type: "Feature", properties: {}, geometry: line }, distKm, {
      units: "kilometers",
    });
    const [lng, lat] = pt.geometry.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const sample = nearestEdgeShade(lng, lat, edges, timeSlot);
    sum += sample.shade;
    if (sample.matched) matched += 1;
    n += 1;
  }
  if (n === 0) return { shadePercent: 45, matchedSampleRatio: 0 };
  return {
    shadePercent: Math.round((sum / n) * 1000) / 10,
    matchedSampleRatio: matched / n,
  };
}

export function estimateShadePercentAlongPolyline(
  line: GeoJSON.LineString,
  graph: CampusGraph,
  timeSlot: TimeSlotHour
): number {
  return estimateShadeStatsAlongPolyline(line, graph, timeSlot).shadePercent;
}
