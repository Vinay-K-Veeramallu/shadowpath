/**
 * Standalone campus GeoJSON generator / cache refresh.
 * Default: enrich existing data/campus.geojson with synthetic building footprints
 * and tree features so dynamic shade works offline; validates with buildGraph.
 *
 * Usage: npm run generate-data [-- --force] [-- --live]
 * --force  Ignore 24h cache and rewrite output.
 * --live   Attempt Overpass fetch (best-effort; falls back on failure).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import { buildGraph } from "../lib/graph/buildGraph";
import { DatasetError } from "../lib/graph/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "campus.geojson");
const CACHE_MAX_MS = 24 * 60 * 60 * 1000;

const BBOX = "33.41,33.43,-111.94,-111.92";

interface OverpassElementBase {
  id: number;
  tags?: Record<string, string>;
}

interface OverpassWay extends OverpassElementBase {
  type: "way";
  geometry?: Array<{ lat: number; lon: number }>;
}

interface OverpassNode extends OverpassElementBase {
  type: "node";
  lat: number;
  lon: number;
}

interface LiveBuilding {
  polygon: GeoJSON.Polygon;
  name?: string;
  heightMeters: number;
  heightSource: "height" | "levels" | "estimate";
}

interface LiveTree {
  lng: number;
  lat: number;
  species: string;
  heightMeters: number;
  canopyRadiusMeters: number;
  canopyDensity: number;
  heightSource: "height" | "species-estimate";
  canopySource: "crown_diameter" | "species-estimate";
}

function log(msg: string): void {
  console.warn(`[generate-data] ${msg}`);
}

function footprintFromPoint(lng: number, lat: number, halfM = 18): GeoJSON.Polygon {
  const c = turf.point([lng, lat]);
  const nw = turf.destination(c, halfM, 315, { units: "meters" });
  const ne = turf.destination(c, halfM, 45, { units: "meters" });
  const se = turf.destination(c, halfM, 135, { units: "meters" });
  const sw = turf.destination(c, halfM, 225, { units: "meters" });
  return turf.polygon([
    [
      nw.geometry.coordinates as [number, number],
      ne.geometry.coordinates as [number, number],
      se.geometry.coordinates as [number, number],
      sw.geometry.coordinates as [number, number],
      nw.geometry.coordinates as [number, number],
    ],
  ]).geometry;
}

function speciesDensity(species: string): number {
  const s = species.toLowerCase();
  if (s.includes("palm")) return 0.45;
  if (s.includes("pine")) return 0.85;
  if (s.includes("oak")) return 0.8;
  return 0.7;
}

function parseHeightMeters(tags: Record<string, string> | undefined): {
  meters: number;
  source: "height" | "levels" | "estimate";
} {
  if (!tags) return { meters: 12, source: "estimate" };
  const rawHeight = tags.height;
  if (rawHeight) {
    const n = Number.parseFloat(rawHeight.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 2) return { meters: n, source: "height" };
  }
  const rawLevels = tags["building:levels"];
  if (rawLevels) {
    const levels = Number.parseFloat(rawLevels);
    if (Number.isFinite(levels) && levels >= 1) {
      return { meters: Math.max(3, levels * 3.2), source: "levels" };
    }
  }
  return { meters: 12, source: "estimate" };
}

function parseTreeHeight(tags: Record<string, string> | undefined, species: string): {
  meters: number;
  source: "height" | "species-estimate";
} {
  const rawHeight = tags?.height;
  if (rawHeight) {
    const n = Number.parseFloat(rawHeight.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 1) return { meters: n, source: "height" };
  }

  const s = species.toLowerCase();
  if (s.includes("palm")) return { meters: 11, source: "species-estimate" };
  if (s.includes("oak")) return { meters: 9, source: "species-estimate" };
  if (s.includes("pine")) return { meters: 10, source: "species-estimate" };
  return { meters: 8, source: "species-estimate" };
}

function parseCanopyRadius(tags: Record<string, string> | undefined, species: string): {
  meters: number;
  source: "crown_diameter" | "species-estimate";
} {
  const crownDiameter = tags?.crown_diameter;
  if (crownDiameter) {
    const n = Number.parseFloat(crownDiameter.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 1) return { meters: Math.max(1, n / 2), source: "crown_diameter" };
  }

  const s = species.toLowerCase();
  if (s.includes("palm")) return { meters: 2.5, source: "species-estimate" };
  if (s.includes("oak")) return { meters: 5.5, source: "species-estimate" };
  if (s.includes("pine")) return { meters: 4.5, source: "species-estimate" };
  return { meters: 4, source: "species-estimate" };
}

function wayToPolygon(way: OverpassWay): GeoJSON.Polygon | null {
  if (!Array.isArray(way.geometry) || way.geometry.length < 3) return null;
  const ring = way.geometry.map((p) => [p.lon, p.lat] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  if (ring.length < 4) return null;
  return { type: "Polygon", coordinates: [ring] };
}

async function tryOverpass(): Promise<{ buildings: LiveBuilding[]; trees: LiveTree[] }> {
  const q = `[out:json][timeout:180];
(
  way["building"](${BBOX});
  node["natural"="tree"](${BBOX});
);
out geom;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(q)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) return { buildings: [], trees: [] };
    const json = await res.json();
    const els = json?.elements as Array<OverpassWay | OverpassNode> | undefined;
    if (!Array.isArray(els) || els.length === 0) return { buildings: [], trees: [] };

    const buildings: LiveBuilding[] = [];
    const trees: LiveTree[] = [];

    for (const el of els) {
      if (el.type === "way") {
        const tags = el.tags;
        if (!tags || !("building" in tags)) continue;
        const polygon = wayToPolygon(el);
        if (!polygon) continue;
        const h = parseHeightMeters(tags);
        buildings.push({
          polygon,
          name: tags.name,
          heightMeters: h.meters,
          heightSource: h.source,
        });
      } else if (el.type === "node") {
        const tags = el.tags;
        if (!tags || tags.natural !== "tree") continue;
        const species = tags.species ?? tags["genus:en"] ?? "unknown";
        const height = parseTreeHeight(tags, species);
        const canopy = parseCanopyRadius(tags, species);
        trees.push({
          lng: el.lon,
          lat: el.lat,
          species,
          heightMeters: height.meters,
          canopyRadiusMeters: canopy.meters,
          canopyDensity: speciesDensity(species),
          heightSource: height.source,
          canopySource: canopy.source,
        });
      }
    }

    log(`Overpass parsed ${buildings.length} building footprints and ${trees.length} trees.`);
    return { buildings, trees };
  } catch {
    return { buildings: [], trees: [] };
  }
}

function augmentFeatureCollection(
  fc: GeoJSON.FeatureCollection,
  live: { buildings: LiveBuilding[]; trees: LiveTree[] } | null
): GeoJSON.FeatureCollection {
  const existingIds = new Set<string>();
  const out: GeoJSON.Feature[] = [];
  const buildingPoints: GeoJSON.Feature[] = [];

  for (const f of fc.features) {
    if (!f || f.type !== "Feature") continue;
    const p = f.properties as Record<string, unknown> | null;
    const id = typeof p?.id === "string" ? p.id : "";
    if (id) existingIds.add(id);
    out.push(f);
    if (p?.type === "building" && f.geometry?.type === "Point") {
      buildingPoints.push(f);
    }
  }

  const liveBuildings = live?.buildings ?? [];
  const liveTrees = live?.trees ?? [];
  const usedLiveBuildingIndexes = new Set<number>();

  for (const bf of buildingPoints) {
    const p = bf.properties as Record<string, unknown>;
    const bid = p.id as string;
    const fpId = `footprint-${bid}`;
    if (existingIds.has(fpId)) continue;
    const coords = (bf.geometry as GeoJSON.Point).coordinates;
    const nodePt = turf.point(coords as [number, number]);
    let chosenLive: LiveBuilding | null = null;
    let chosenIdx = -1;
    let minMeters = Number.POSITIVE_INFINITY;
    for (let i = 0; i < liveBuildings.length; i++) {
      if (usedLiveBuildingIndexes.has(i)) continue;
      const lb = liveBuildings[i];
      try {
        const center = turf.centroid(turf.polygon(lb.polygon.coordinates));
        const dMeters = turf.distance(nodePt, center, { units: "kilometers" }) * 1000;
        if (dMeters < minMeters) {
          minMeters = dMeters;
          chosenLive = lb;
          chosenIdx = i;
        }
      } catch {
        // ignore malformed polygons
      }
    }
    // Guardrail to avoid accidentally mapping far-away buildings.
    if (minMeters > 250) {
      chosenLive = null;
      chosenIdx = -1;
    }
    if (chosenIdx >= 0) usedLiveBuildingIndexes.add(chosenIdx);
    const height = chosenLive
      ? chosenLive.heightMeters
      : typeof p.heightMeters === "number"
        ? (p.heightMeters as number)
        : typeof p.demoHeatIndex === "number"
          ? 12
          : 10;
    const heightSource = chosenLive
      ? chosenLive.heightSource
      : typeof p.heightMeters === "number"
        ? "dataset"
        : "estimate";
    out.push({
      type: "Feature",
      properties: {
        id: fpId,
        type: "building_footprint",
        buildingId: bid,
        heightMeters: height,
        heightSource,
        name: typeof p.name === "string" ? p.name : bid,
      },
      geometry: chosenLive ? chosenLive.polygon : footprintFromPoint(coords[0], coords[1]),
    });
    existingIds.add(fpId);
  }

  if (liveTrees.length > 0) {
    let treeIdx = 0;
    for (const tr of liveTrees.slice(0, 400)) {
      const tid = `tree-live-${treeIdx++}`;
      if (existingIds.has(tid)) continue;
      out.push({
        type: "Feature",
        properties: {
          type: "tree",
          id: tid,
          heightMeters: tr.heightMeters,
          canopyRadiusMeters: tr.canopyRadiusMeters,
          canopyDensity: tr.canopyDensity,
          species: tr.species,
          heightSource: tr.heightSource,
          canopySource: tr.canopySource,
          accessible: true,
        },
        geometry: { type: "Point", coordinates: [tr.lng, tr.lat] },
      });
      existingIds.add(tid);
    }
  } else {
    let treeIdx = 0;
    for (const bf of buildingPoints.slice(0, 40)) {
      const coords = (bf.geometry as GeoJSON.Point).coordinates;
      const lng = coords[0] + 0.00012 * ((treeIdx % 5) - 2);
      const lat = coords[1] + 0.00008 * (((treeIdx / 5) | 0) % 3);
      const tid = `tree-gen-${treeIdx++}`;
      if (existingIds.has(tid)) continue;
      out.push({
        type: "Feature",
        properties: {
          type: "tree",
          id: tid,
          heightMeters: 8,
          canopyRadiusMeters: 4,
          canopyDensity: speciesDensity("unknown"),
          species: "unknown",
          heightSource: "species-estimate",
          canopySource: "species-estimate",
          accessible: true,
        },
        geometry: { type: "Point", coordinates: [lng, lat] },
      });
      existingIds.add(tid);
    }
  }

  return { type: "FeatureCollection", features: out };
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const live = process.argv.includes("--live");
  let liveData: { buildings: LiveBuilding[]; trees: LiveTree[] } | null = null;

  if (!force && fs.existsSync(OUT)) {
    const age = Date.now() - fs.statSync(OUT).mtimeMs;
    if (age < CACHE_MAX_MS) {
      log(`Using cached ${OUT} (${Math.round(age / 3600000)}h old). Pass --force to regenerate.`);
      process.exit(0);
    }
  }

  if (live) {
    liveData = await tryOverpass();
  }

  if (!fs.existsSync(OUT)) {
    log(`Missing ${OUT}; create base file before running this script.`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(OUT, "utf8")) as GeoJSON.FeatureCollection;
  const augmented = augmentFeatureCollection(raw, liveData ?? null);

  try {
    buildGraph(augmented);
  } catch (e) {
    if (e instanceof DatasetError) {
      log(`Validation failed: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }

  fs.writeFileSync(OUT, JSON.stringify(augmented, null, 2));
  log(`Wrote ${OUT} (${augmented.features.length} features).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
