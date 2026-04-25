import { NextResponse } from "next/server";
import { fetchWalkingRoutesServer } from "../../../../lib/walking/fetchWalkingRoutesServer";

function parseCoord(v: string | null, min: number, max: number): number | null {
  if (v === null || v === "") return null;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/**
 * Returns several walking route geometries (Google if GOOGLE_MAPS_API_KEY is set,
 * otherwise OSRM foot on OpenStreetMap) between two WGS84 points.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fromLng = parseCoord(searchParams.get("fromLng"), -180, 180);
  const fromLat = parseCoord(searchParams.get("fromLat"), -90, 90);
  const toLng = parseCoord(searchParams.get("toLng"), -180, 180);
  const toLat = parseCoord(searchParams.get("toLat"), -90, 90);

  if (fromLng === null || fromLat === null || toLng === null || toLat === null) {
    return NextResponse.json({ error: "Invalid or missing coordinates." }, { status: 400 });
  }

  const result = await fetchWalkingRoutesServer(fromLng, fromLat, toLng, toLat);
  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result);
}
