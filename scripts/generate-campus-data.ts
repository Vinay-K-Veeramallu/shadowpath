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

async function tryOverpass(): Promise<void> {
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
    if (!res.ok) return;
    const json = await res.json();
    const els = json?.elements as unknown[] | undefined;
    if (!Array.isArray(els) || els.length === 0) return;
    log(`Overpass returned ${els.length} raw elements (merge not implemented in this pass).`);
  } catch {
    /* ignore */
  }
}

function augmentFeatureCollection(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
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

  for (const bf of buildingPoints) {
    const p = bf.properties as Record<string, unknown>;
    const bid = p.id as string;
    const fpId = `footprint-${bid}`;
    if (existingIds.has(fpId)) continue;
    const coords = (bf.geometry as GeoJSON.Point).coordinates;
    const height =
      typeof p.heightMeters === "number"
        ? (p.heightMeters as number)
        : typeof p.demoHeatIndex === "number"
          ? 12
          : 10;
    out.push({
      type: "Feature",
      properties: {
        type: "building_footprint",
        buildingId: bid,
        heightMeters: height,
        name: typeof p.name === "string" ? p.name : bid,
      },
      geometry: footprintFromPoint(coords[0], coords[1]),
    });
    existingIds.add(fpId);
  }

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
        accessible: true,
      },
      geometry: { type: "Point", coordinates: [lng, lat] },
    });
    existingIds.add(tid);
  }

  return { type: "FeatureCollection", features: out };
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const live = process.argv.includes("--live");

  if (!force && fs.existsSync(OUT)) {
    const age = Date.now() - fs.statSync(OUT).mtimeMs;
    if (age < CACHE_MAX_MS) {
      log(`Using cached ${OUT} (${Math.round(age / 3600000)}h old). Pass --force to regenerate.`);
      process.exit(0);
    }
  }

  if (live) {
    await tryOverpass();
  }

  if (!fs.existsSync(OUT)) {
    log(`Missing ${OUT}; create base file before running this script.`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(OUT, "utf8")) as GeoJSON.FeatureCollection;
  const augmented = augmentFeatureCollection(raw);

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
