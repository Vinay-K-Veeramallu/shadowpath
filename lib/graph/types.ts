import type { TimeSlotHour } from "../timeSlots";

export type CampusNodeType =
  | "building"
  | "cooling_point"
  | "water_refill"
  | "intersection"
  | "shuttle_stop";

export type SurfaceType =
  | "asphalt"
  | "grass"
  | "concrete"
  | "paving_stones"
  | "covered_walkway"
  | "indoor"
  | "unknown";

export type AccessRestriction = "public" | "student_only" | "staff_only";

export type AccessLevel = "public" | "student" | "staff";

export interface CampusNodeProperties {
  type: CampusNodeType;
  id: string;
  name: string;
  accessible: boolean;
  demoHeatIndex?: number;
}

export interface CampusEdgeProperties {
  type: "path";
  id: string;
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  accessible: boolean;
  /** Legacy static shade 0–100 for 10 / 14 / 18 (HeatShield / fallback). */
  shade?: {
    "10": number;
    "14": number;
    "18": number;
  };
  hasCoolingPoint: boolean;
  hasWaterRefill: boolean;
  shadeStructures: string[];
  isIndoor?: boolean;
  surfaceType?: SurfaceType;
  accessRestriction?: AccessRestriction;
  windCanyonFactor?: number;
}

export interface GraphNode {
  id: string;
  name: string;
  accessible: boolean;
  type: CampusNodeType;
  coordinates: [number, number]; // [lng, lat]
  demoHeatIndex?: number;
  /** Building footprint when available (from OSM polygon). */
  footprintPolygon?: GeoJSON.Polygon;
  heightMeters?: number;
  canopyRadiusMeters?: number;
  canopyDensity?: number;
  species?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  distanceMeters: number;
  accessible: boolean;
  surfaceType: SurfaceType;
  accessRestriction: AccessRestriction;
  /** Multiplier for wind speed in [0, 2]; 1 = nominal. */
  windCanyonFactor: number;
  hasCoolingPoint: boolean;
  hasWaterRefill: boolean;
  isIndoor?: boolean;
  geometry: GeoJSON.LineString;
  /** Legacy snapshots 0–100; used when graph has no building footprints. */
  shadeLegacy?: Record<"10" | "14" | "18", number>;
  /**
   * Dynamic shade fraction [0, 1] for the last resolved datetime.
   * Populated by `attachShadeForDatetime` before routing.
   */
  shadeFraction?: number;
}

export interface BuildingFootprintSpec {
  id: string;
  name?: string;
  polygon: GeoJSON.Polygon;
  heightMeters: number;
}

export interface TreeCanopySpec {
  id: string;
  lng: number;
  lat: number;
  heightMeters: number;
  canopyRadiusMeters: number;
  canopyDensity: number;
  species: string;
}

/** Pedestrian door — useful when routes use indoor / building connectors. */
export interface BuildingEntrance {
  id: string;
  buildingId: string;
  label: string;
  coordinates: [number, number];
  /** False = staff-only (still shown, with note). */
  studentAccess: boolean;
}

export interface CampusGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  adjacency: Map<string, GraphEdge[]>;
  buildings: BuildingFootprintSpec[];
  trees: TreeCanopySpec[];
  entrances: BuildingEntrance[];
}

export class DatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetError";
  }
}

/** Resolve shade as 0–1 fraction using dynamic cache or legacy snapshots. */
export function edgeShadeFraction01(
  edge: GraphEdge,
  timeSlot: TimeSlotHour
): number {
  if (typeof edge.shadeFraction === "number") {
    return Math.max(0, Math.min(1, edge.shadeFraction));
  }
  const pct = legacyShadePercent(edge, timeSlot);
  return Math.max(0, Math.min(1, pct / 100));
}

/** Legacy shade percentage 0–100 for exposure / old UI when dynamic shade unset. */
export function legacyShadePercent(edge: GraphEdge, timeSlot: TimeSlotHour): number {
  const legacy = edge.shadeLegacy;
  if (!legacy) return 50;
  const h = timeSlot;
  if (h <= 10) return Math.max(0, Math.min(100, legacy["10"]));
  if (h >= 18) return Math.max(0, Math.min(100, legacy["18"]));
  if (h <= 14) {
    const t = (h - 10) / 4;
    return Math.max(0, Math.min(100, legacy["10"] + t * (legacy["14"] - legacy["10"])));
  }
  const t = (h - 14) / 4;
  return Math.max(0, Math.min(100, legacy["14"] + t * (legacy["18"] - legacy["14"])));
}
