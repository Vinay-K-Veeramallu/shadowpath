"use client";
import { useEffect, useRef, useState } from "react";
import * as turf from "@turf/turf";
import type { RouteResult } from "../lib/routing/types";
import { edgeShadeFraction01 } from "../lib/graph/types";
import type { BuildingEntrance } from "../lib/graph/types";
import type { TimeSlotHour } from "../lib/timeSlots";
import type { WalkingRouteRanked } from "../lib/walking/types";
import { useHighContrast } from "../hooks/useHighContrast";

interface MapViewProps {
  routes: RouteResult[];
  selectedTime: TimeSlotHour;
  accessibilityMode: boolean;
  rankedWalkingRoutes?: WalkingRouteRanked[];
  selectedWalkingId?: string | null;
  tripEntrances?: BuildingEntrance[];
}

const ROUTE_TYPES = ["shortest", "shade-aware", "cooling-stop", "comfort-aware"] as const;
const ROUTE_STYLE: Record<
  (typeof ROUTE_TYPES)[number],
  { color: string; offset: number; dash: number[] }
> = {
  shortest: { color: "#2563eb", offset: -3, dash: [1.2, 1.2] },
  "shade-aware": { color: "#16a34a", offset: 0, dash: [1, 0] },
  "cooling-stop": { color: "#7c3aed", offset: 3, dash: [1.8, 1.1] },
  "comfort-aware": { color: "#ea580c", offset: 6, dash: [1, 0] },
};

// Shade colour ramp: dark green (100%) → yellow (50%) → red (0%)
// High contrast: blue (100%) → white (50%) → orange (0%)
function shadeColor(pct: number, highContrast: boolean): string {
  const t = pct / 100;
  if (highContrast) {
    if (t >= 0.5) {
      const s = (t - 0.5) * 2;
      const r = Math.round(255 + (0 - 255) * s);
      const g = Math.round(255 + (0 - 255) * s);
      const b = 255;
      return `rgb(${r},${g},${b})`;
    } else {
      const s = t * 2;
      const r = 255;
      const g = Math.round(165 + (255 - 165) * s);
      const b = Math.round(0 + (255 - 0) * s);
      return `rgb(${r},${g},${b})`;
    }
  } else {
    if (t >= 0.5) {
      const s = (t - 0.5) * 2;
      const r = Math.round(255 + (0 - 255) * s);
      const g = Math.round(255 + (128 - 255) * s);
      const b = 0;
      return `rgb(${r},${g},${b})`;
    } else {
      const s = t * 2;
      const r = 255;
      const g = Math.round(0 + (255 - 0) * s);
      const b = 0;
      return `rgb(${r},${g},${b})`;
    }
  }
}

export function MapView({
  routes,
  selectedTime,
  accessibilityMode,
  rankedWalkingRoutes,
  selectedWalkingId,
  tripEntrances,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  /** Incremented when the map style has finished loading and custom sources/layers exist. */
  const [mapStyleEpoch, setMapStyleEpoch] = useState(0);
  const lastFitBoundsKey = useRef("");
  const { highContrast } = useHighContrast();

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    import("maplibre-gl").then((maplibre) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibre.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              // Proxy through our own origin to avoid browser CORS issues with tile hosts.
              tiles: ["/api/tiles/osm/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            },
          },
          layers: [
            {
              id: "osm-tiles",
              type: "raster",
              source: "osm",
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [-111.9335, 33.42],
        zoom: 15,
        maxZoom: 19,
      });

      map.on("load", () => {
        if (cancelled) return;
        map.addSource("campus-edges", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "campus-edges-layer",
          type: "line",
          source: "campus-edges",
          paint: {
            "line-color": "#9ca3af",
            "line-width": 2,
          },
        });

        map.addSource("shade-overlay", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "shade-overlay-layer",
          type: "line",
          source: "shade-overlay",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 4,
            "line-opacity": 0.8,
          },
        });

        for (const rt of ROUTE_TYPES) {
          const style = ROUTE_STYLE[rt];
          map.addSource(`route-${rt}`, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: `route-${rt}-layer`,
            type: "line",
            source: `route-${rt}`,
            paint: {
              "line-color": style.color,
              "line-width": 5,
              "line-opacity": 0.85,
              "line-offset": style.offset,
              "line-dasharray": [
                "case",
                ["==", ["get", "isIndoor"], true],
                ["literal", [2, 2]],
                ["literal", style.dash],
              ],
            },
          });
        }

        map.addSource("walking-alts", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "walking-alts-layer",
          type: "line",
          source: "walking-alts",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "sel"], 1],
              "#0f766e",
              "#94a3b8",
            ],
            "line-width": ["case", ["==", ["get", "sel"], 1], 6, 3],
            "line-opacity": ["case", ["==", ["get", "sel"], 1], 1, 0.42],
          },
        });

        map.addSource("trip-entrances", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "trip-entrances-layer",
          type: "circle",
          source: "trip-entrances",
          paint: {
            "circle-radius": 8,
            "circle-color": "#ea580c",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        if (!cancelled) {
          setMapStyleEpoch((n) => n + 1);
        }
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      lastFitBoundsKey.current = "";
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStyleEpoch === 0 || !map.isStyleLoaded()) return;

    const shadeFeatures = routes.flatMap((route) =>
      route.edges.map((edge) => {
        const shadePct = edgeShadeFraction01(edge, selectedTime) * 100;
        return {
          type: "Feature" as const,
          geometry: edge.geometry,
          properties: {
            color: shadeColor(shadePct, highContrast),
            isIndoor: edge.isIndoor === true,
          },
        };
      })
    );

    const shadeSource = map.getSource("shade-overlay");
    if (shadeSource && "setData" in shadeSource) {
      shadeSource.setData({ type: "FeatureCollection", features: shadeFeatures });
    }

    for (const route of routes) {
      for (const rt of route.type) {
        const src = map.getSource(`route-${rt}`);
        if (src && "setData" in src) {
          src.setData(route.geometry);
        }
      }
    }

    const hasWalking = (rankedWalkingRoutes?.length ?? 0) > 0;
    for (const rt of ROUTE_TYPES) {
      const layerId = `route-${rt}-layer`;
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, "line-opacity", hasWalking ? 0.4 : 0.85);
        map.setPaintProperty(layerId, "line-width", hasWalking ? 3 : 5);
      }
    }

    const walkingFeatures =
      rankedWalkingRoutes?.map((r) => ({
        type: "Feature" as const,
        geometry: r.geometry,
        properties: {
          id: r.id,
          sel: r.id === selectedWalkingId ? 1 : 0,
        },
      })) ?? [];

    const walkSrc = map.getSource("walking-alts");
    if (walkSrc && "setData" in walkSrc) {
      walkSrc.setData({ type: "FeatureCollection", features: walkingFeatures });
    }

    const entranceFeatures =
      tripEntrances?.map((e) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: e.coordinates,
        },
        properties: {
          label: e.label,
        },
      })) ?? [];

    const entSrc = map.getSource("trip-entrances");
    if (entSrc && "setData" in entSrc) {
      entSrc.setData({ type: "FeatureCollection", features: entranceFeatures });
    }

    const boundsFeatures: GeoJSON.Feature[] = [];
    if (rankedWalkingRoutes?.length) {
      for (const r of rankedWalkingRoutes) {
        boundsFeatures.push({ type: "Feature", properties: {}, geometry: r.geometry });
      }
    } else {
      for (const route of routes) {
        for (const f of route.geometry.features) {
          boundsFeatures.push(f as GeoJSON.Feature);
        }
      }
    }
    for (const e of tripEntrances ?? []) {
      boundsFeatures.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: e.coordinates },
      });
    }

    const fitKey = [
      rankedWalkingRoutes?.map((r) => r.id).join(",") ?? "",
      routes[0]?.path?.join("-") ?? "",
      tripEntrances?.map((e) => e.id).join(",") ?? "",
    ].join("|");

    if (boundsFeatures.length > 0 && fitKey !== lastFitBoundsKey.current) {
      lastFitBoundsKey.current = fitKey;
      try {
        const b = turf.bbox({ type: "FeatureCollection", features: boundsFeatures });
        if (
          Number.isFinite(b[0]) &&
          Number.isFinite(b[1]) &&
          Number.isFinite(b[2]) &&
          Number.isFinite(b[3])
        ) {
          map.fitBounds(
            [
              [b[0], b[1]],
              [b[2], b[3]],
            ],
            { padding: 52, maxZoom: 17, duration: 550 }
          );
        }
      } catch {
        /* ignore invalid bounds */
      }
    }
  }, [
    mapStyleEpoch,
    routes,
    selectedTime,
    highContrast,
    accessibilityMode,
    rankedWalkingRoutes,
    selectedWalkingId,
    tripEntrances,
  ]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Campus route map"
      className="h-[min(62vh,560px)] w-full overflow-hidden rounded-2xl border border-slate-200/90 shadow-inner hc:border-black"
    />
  );
}
