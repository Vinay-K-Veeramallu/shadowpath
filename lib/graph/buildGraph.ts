import type {
  CampusNodeProperties,
  CampusEdgeProperties,
  GraphNode,
  GraphEdge,
  CampusGraph,
  BuildingFootprintSpec,
  TreeCanopySpec,
  BuildingEntrance,
  SurfaceType,
  AccessRestriction,
} from "./types";
import { DatasetError } from "./types";
import * as turf from "@turf/turf";
import { estimateWindCanyonFactor } from "../shadow/shadeFractions";

const NODE_TYPES = new Set([
  "building",
  "cooling_point",
  "water_refill",
  "intersection",
  "shuttle_stop",
]);

function isNodeProperties(p: unknown): p is CampusNodeProperties {
  if (!p || typeof p !== "object") return false;
  const props = p as Record<string, unknown>;
  return (
    NODE_TYPES.has(props.type as string) &&
    typeof props.id === "string" &&
    typeof props.name === "string" &&
    typeof props.accessible === "boolean"
  );
}

function parseSurface(raw: unknown): SurfaceType {
  const s = typeof raw === "string" ? raw.toLowerCase() : "";
  switch (s) {
    case "asphalt":
      return "asphalt";
    case "grass":
    case "ground":
      return "grass";
    case "concrete":
      return "concrete";
    case "paving_stones":
    case "paving_stones:status":
      return "paving_stones";
    case "covered_walkway":
      return "covered_walkway";
    case "indoor":
      return "indoor";
    default:
      return "unknown";
  }
}

function parseAccessRestriction(raw: unknown): AccessRestriction {
  const a = typeof raw === "string" ? raw.toLowerCase() : "";
  if (a === "private" || a === "staff" || a === "staff_only") return "staff_only";
  if (a === "students" || a === "student" || a === "student_only") return "student_only";
  return "public";
}

function isEdgeProperties(p: unknown): p is CampusEdgeProperties {
  if (!p || typeof p !== "object") return false;
  const props = p as Record<string, unknown>;
  if (props.type !== "path") return false;
  if (typeof props.id !== "string") return false;
  if (typeof props.fromNodeId !== "string") return false;
  if (typeof props.toNodeId !== "string") return false;
  if (typeof props.distanceMeters !== "number") return false;
  if (typeof props.accessible !== "boolean") return false;
  if (typeof props.hasCoolingPoint !== "boolean") return false;
  if (typeof props.hasWaterRefill !== "boolean") return false;
  const shade = props.shade;
  if (shade !== undefined) {
    if (!shade || typeof shade !== "object") return false;
    const s = shade as Record<string, unknown>;
    if (typeof s["10"] !== "number" || typeof s["14"] !== "number" || typeof s["18"] !== "number") {
      return false;
    }
  }
  return true;
}

function isBuildingFootprintProps(p: unknown): p is {
  type: "building_footprint";
  buildingId: string;
  heightMeters: number;
  name?: string;
} {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    o.type === "building_footprint" &&
    typeof o.buildingId === "string" &&
    typeof o.heightMeters === "number"
  );
}

function isTreeProps(p: unknown): p is {
  type: "tree";
  id: string;
  heightMeters: number;
  canopyRadiusMeters: number;
  canopyDensity: number;
  species: string;
} {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    o.type === "tree" &&
    typeof o.id === "string" &&
    typeof o.heightMeters === "number" &&
    typeof o.canopyRadiusMeters === "number" &&
    typeof o.canopyDensity === "number" &&
    typeof o.species === "string"
  );
}

function isBuildingEntranceProps(p: unknown): p is {
  type: "building_entrance";
  id: string;
  buildingId: string;
  label: string;
  studentAccess?: boolean;
} {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    o.type === "building_entrance" &&
    typeof o.id === "string" &&
    typeof o.buildingId === "string" &&
    typeof o.label === "string"
  );
}

function lineDistanceMeters(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  let m = 0;
  for (let i = 1; i < coords.length; i++) {
    m +=
      turf.distance(turf.point(coords[i - 1]), turf.point(coords[i]), {
        units: "kilometers",
      }) * 1000;
  }
  return m;
}

export function buildGraph(geojson: GeoJSON.FeatureCollection): CampusGraph {
  if (!geojson || typeof geojson !== "object") {
    throw new DatasetError("GeoJSON FeatureCollection is missing or not an object");
  }
  if (geojson.type !== "FeatureCollection") {
    throw new DatasetError(`Expected type "FeatureCollection", got "${geojson.type}"`);
  }
  if (!Array.isArray(geojson.features)) {
    throw new DatasetError("GeoJSON FeatureCollection is missing a features array");
  }

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const adjacency = new Map<string, GraphEdge[]>();
  const buildings: BuildingFootprintSpec[] = [];
  const trees: TreeCanopySpec[] = [];
  const entrances: BuildingEntrance[] = [];
  const footprintByBuildingId = new Map<string, BuildingFootprintSpec>();

  for (const feature of geojson.features) {
    if (!feature || feature.type !== "Feature") continue;
    const props = feature.properties;

    if (isBuildingFootprintProps(props) && feature.geometry?.type === "Polygon") {
      const poly = feature.geometry as GeoJSON.Polygon;
      const spec: BuildingFootprintSpec = {
        id: props.buildingId,
        name: props.name,
        polygon: poly,
        heightMeters: props.heightMeters,
      };
      buildings.push(spec);
      footprintByBuildingId.set(props.buildingId, spec);
      continue;
    }

    if (isTreeProps(props) && feature.geometry?.type === "Point") {
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      trees.push({
        id: props.id,
        lng,
        lat,
        heightMeters: props.heightMeters,
        canopyRadiusMeters: props.canopyRadiusMeters,
        canopyDensity: props.canopyDensity,
        species: props.species,
      });
      continue;
    }

    if (isBuildingEntranceProps(props) && feature.geometry?.type === "Point") {
      const c = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      entrances.push({
        id: props.id,
        buildingId: props.buildingId,
        label: props.label,
        coordinates: [c[0], c[1]],
        studentAccess: props.studentAccess !== false,
      });
      continue;
    }

    if (!isNodeProperties(props)) continue;
    if (!feature.geometry || feature.geometry.type !== "Point") continue;

    const coords = (feature.geometry as GeoJSON.Point).coordinates;
    const node: GraphNode = {
      id: props.id,
      name: props.name,
      accessible: props.accessible,
      type: props.type,
      coordinates: [coords[0], coords[1]],
      ...(props.demoHeatIndex !== undefined ? { demoHeatIndex: props.demoHeatIndex } : {}),
    };
    const fp = footprintByBuildingId.get(props.id);
    if (fp && props.type === "building") {
      node.footprintPolygon = fp.polygon;
      node.heightMeters = fp.heightMeters;
    }
    nodes.set(node.id, node);
    adjacency.set(node.id, []);
  }

  for (const feature of geojson.features) {
    if (!feature || feature.type !== "Feature") continue;
    const props = feature.properties;
    if (!isEdgeProperties(props)) continue;
    if (!feature.geometry || feature.geometry.type !== "LineString") continue;

    if (!nodes.has(props.fromNodeId)) {
      throw new DatasetError(
        `Edge "${props.id}" references unknown fromNodeId "${props.fromNodeId}"`
      );
    }
    if (!nodes.has(props.toNodeId)) {
      throw new DatasetError(
        `Edge "${props.id}" references unknown toNodeId "${props.toNodeId}"`
      );
    }

    const line = feature.geometry as GeoJSON.LineString;
    const coords = line.coordinates as [number, number][];
    const geoDist = lineDistanceMeters(coords);
    const distanceMeters =
      geoDist > 0.1 ? geoDist : props.distanceMeters;

    const raw = props as unknown as Record<string, unknown>;
    const surfaceType =
      props.isIndoor === true
        ? "indoor"
        : parseSurface(raw.surfaceType ?? raw.surface);
    const accessRestriction = parseAccessRestriction(raw.accessRestriction ?? raw.access);
    const shadeLegacy =
      props.shade !== undefined
        ? {
            "10": (props.shade as Record<string, number>)["10"],
            "14": (props.shade as Record<string, number>)["14"],
            "18": (props.shade as Record<string, number>)["18"],
          }
        : { "10": 50, "14": 50, "18": 50 };

    const edge: GraphEdge = {
      id: props.id,
      from: props.fromNodeId,
      to: props.toNodeId,
      distanceMeters,
      accessible: props.accessible,
      surfaceType,
      accessRestriction,
      windCanyonFactor:
        typeof raw.windCanyonFactor === "number"
          ? Math.max(0, Math.min(2, raw.windCanyonFactor as number))
          : 1,
      hasCoolingPoint: props.hasCoolingPoint,
      hasWaterRefill: props.hasWaterRefill,
      isIndoor: props.isIndoor === true || surfaceType === "indoor",
      geometry: line,
      shadeLegacy,
    };

    edges.set(edge.id, edge);
    adjacency.get(props.fromNodeId)!.push(edge);
    adjacency.get(props.toNodeId)!.push(edge);
  }

  const graph: CampusGraph = { nodes, edges, adjacency, buildings, trees, entrances };

  for (const edge of graph.edges.values()) {
    if (edge.windCanyonFactor === 1 && graph.buildings.length > 0) {
      edge.windCanyonFactor = estimateWindCanyonFactor(edge, graph.buildings);
    }
  }

  return graph;
}
