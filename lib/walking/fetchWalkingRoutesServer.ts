import { decodeGooglePolyline } from "./decodePolyline";
import type { WalkingDirectionsErr, WalkingDirectionsOk, WalkingRouteLeg } from "./types";

export type WalkingDirectionsResult = WalkingDirectionsOk | WalkingDirectionsErr;
const MAX_ALTERNATIVES = 3;

function routeFingerprint(route: WalkingRouteLeg): string {
  const c = route.geometry.coordinates;
  const first = c[0];
  const last = c[c.length - 1];
  return `${Math.round(route.distanceMeters)}|${Math.round(route.durationMinutes)}|${first?.[0]?.toFixed(5)}|${first?.[1]?.toFixed(5)}|${last?.[0]?.toFixed(5)}|${last?.[1]?.toFixed(5)}`;
}

function normalizeAlternatives(routes: WalkingRouteLeg[]): WalkingRouteLeg[] {
  const seen = new Set<string>();
  const out: WalkingRouteLeg[] = [];
  for (const r of routes) {
    const fp = routeFingerprint(r);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(r);
    if (out.length >= MAX_ALTERNATIVES) break;
  }
  return out;
}

async function fetchGoogleWalking(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  key: string
): Promise<WalkingRouteLeg[] | null> {
  const origin = `${fromLat},${fromLng}`;
  const dest = `${toLat},${toLng}`;
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", dest);
  url.searchParams.set("mode", "walking");
  url.searchParams.set("alternatives", "true");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    routes?: Array<{
      overview_polyline?: { points?: string };
      legs?: Array<{ distance?: { value: number }; duration?: { value: number } }>;
    }>;
  };

  if (data.status !== "OK" || !data.routes?.length) return null;

  const legs: WalkingRouteLeg[] = [];
  let i = 0;
  for (const r of data.routes) {
    const enc = r.overview_polyline?.points;
    if (!enc) continue;
    const geometry = decodeGooglePolyline(enc);
    if (geometry.coordinates.length < 2) continue;
    let distanceMeters = 0;
    let durationSeconds = 0;
    for (const leg of r.legs ?? []) {
      distanceMeters += leg.distance?.value ?? 0;
      durationSeconds += leg.duration?.value ?? 0;
    }
    legs.push({
      id: `google-${i++}`,
      geometry,
      distanceMeters: Math.max(1, Math.round(distanceMeters)),
      durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    });
  }
  return legs.length ? normalizeAlternatives(legs) : null;
}

async function fetchOsrmWalking(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): Promise<WalkingRouteLeg[] | null> {
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `https://router.project-osrm.org/route/v1/foot/${coords}?alternatives=true&steps=false&overview=full&geometries=geojson`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    code: string;
    routes?: Array<{
      geometry?: GeoJSON.LineString;
      distance?: number;
      duration?: number;
    }>;
  };

  if (data.code !== "Ok" || !data.routes?.length) return null;

  const legs: WalkingRouteLeg[] = [];
  let i = 0;
  for (const r of data.routes) {
    const g = r.geometry;
    if (!g || g.type !== "LineString" || g.coordinates.length < 2) continue;
    legs.push({
      id: `osrm-${i++}`,
      geometry: g,
      distanceMeters: Math.max(1, Math.round(r.distance ?? 0)),
      durationMinutes: Math.max(1, Math.round((r.duration ?? 60) / 60)),
    });
  }
  return legs.length ? normalizeAlternatives(legs) : null;
}

export async function fetchWalkingRoutesServer(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): Promise<WalkingDirectionsResult> {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    try {
      const routes = await fetchGoogleWalking(fromLng, fromLat, toLng, toLat, googleKey);
      if (routes?.length) {
        return {
          ok: true,
          provider: "google",
          routes,
          attribution:
            "Walking paths shown using Google Directions. Route geometry is subject to Google Maps Platform terms and attribution requirements.",
        };
      }
    } catch {
      // fall through to OSRM
    }
  }

  try {
    const routes = await fetchOsrmWalking(fromLng, fromLat, toLng, toLat);
    if (routes?.length) {
      return {
        ok: true,
        provider: "osrm",
        routes,
        attribution:
          "Sidewalk-aligned paths from OpenStreetMap via the public OSRM demo (rate-limited). For production, host OSRM or use a routing provider with an SLA.",
      };
    }
  } catch {
    // handled below
  }

  return {
    ok: false,
    error: "Could not fetch walking directions. Check network or try again later.",
    routes: [],
  };
}
