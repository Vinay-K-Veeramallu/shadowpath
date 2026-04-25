// Feature: shadow-path, Property 14: Campus_Graph serialization round-trip

import { test, expect, describe } from "vitest";
import { test as testProp, fc } from "@fast-check/vitest";
import { buildGraph } from "../../lib/graph/buildGraph";
import { DatasetError } from "../../lib/graph/types";
import campusData from "../../data/campus.geojson";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a valid node id like "n0", "n1", etc. */
const nodeIdArb = fc.integer({ min: 0, max: 9 }).map((i) => `n${i}`);

/** Generate a single node feature */
const nodeFeatureArb = fc
  .record({
    id: nodeIdArb,
    name: fc.string({ minLength: 1, maxLength: 20 }),
    accessible: fc.boolean(),
    demoHeatIndex: fc.float({ min: 80, max: 120, noNaN: true }),
  })
  .map(({ id, name, accessible, demoHeatIndex }) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [
        parseFloat(fc.sample(fc.float({ min: -112, max: -111, noNaN: true }), 1)[0].toFixed(4)),
        parseFloat(fc.sample(fc.float({ min: 33, max: 34, noNaN: true }), 1)[0].toFixed(4)),
      ] as [number, number],
    },
    properties: {
      type: "building" as const,
      id,
      name,
      accessible,
      demoHeatIndex,
    },
  }));

/** Generate a set of 2-5 unique node features */
const nodeSetArb = fc
  .array(nodeFeatureArb, { minLength: 2, maxLength: 5 })
  .map((nodes) => {
    // Deduplicate by id
    const seen = new Set<string>();
    return nodes.filter((n) => {
      if (seen.has(n.properties.id)) return false;
      seen.add(n.properties.id);
      return true;
    });
  })
  .filter((nodes) => nodes.length >= 2);

/** Generate a single edge feature given a list of available node ids */
function edgeFeatureArb(nodeIds: string[], edgeIndex: number) {
  return fc
    .record({
      fromIdx: fc.integer({ min: 0, max: nodeIds.length - 1 }),
      toIdx: fc.integer({ min: 0, max: nodeIds.length - 1 }),
      distanceMeters: fc.float({ min: 10, max: 500, noNaN: true }),
      accessible: fc.boolean(),
      shade10: fc.integer({ min: 0, max: 100 }),
      shade14: fc.integer({ min: 0, max: 100 }),
      shade18: fc.integer({ min: 0, max: 100 }),
      hasCoolingPoint: fc.boolean(),
      hasWaterRefill: fc.boolean(),
    })
    .filter(({ fromIdx, toIdx }) => fromIdx !== toIdx)
    .map(
      ({
        fromIdx,
        toIdx,
        distanceMeters,
        accessible,
        shade10,
        shade14,
        shade18,
        hasCoolingPoint,
        hasWaterRefill,
      }) => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [-111.93, 33.42],
            [-111.92, 33.41],
          ] as [number, number][],
        },
        properties: {
          type: "path" as const,
          id: `e${edgeIndex}`,
          fromNodeId: nodeIds[fromIdx],
          toNodeId: nodeIds[toIdx],
          distanceMeters,
          accessible,
          shade: { "10": shade10, "14": shade14, "18": shade18 },
          hasCoolingPoint,
          hasWaterRefill,
          shadeStructures: [] as string[],
        },
      })
    );
}

/** Generate a minimal valid GeoJSON FeatureCollection */
const validGeoJsonArb = nodeSetArb.chain((nodes) => {
  const nodeIds = nodes.map((n) => n.properties.id);
  const numEdges = Math.min(3, nodeIds.length - 1);
  const edgeArbs = Array.from({ length: numEdges }, (_, i) =>
    edgeFeatureArb(nodeIds, i)
  );
  return fc.tuple(...(edgeArbs as [ReturnType<typeof edgeFeatureArb>])).map(
    (edges) => ({
      type: "FeatureCollection" as const,
      features: [
        ...nodes,
        ...(edges as ReturnType<typeof edgeFeatureArb> extends fc.Arbitrary<infer T>
          ? T[]
          : never[]),
      ],
    })
  );
});

// ---------------------------------------------------------------------------
// Property 14: Campus_Graph serialization round-trip
// Validates: Requirements 11.2
// ---------------------------------------------------------------------------

describe("buildGraph – P14 serialization round-trip", () => {
  testProp.prop([validGeoJsonArb], { numRuns: 100 })(
    "serialising and deserialising GeoJSON produces identical node count, edge count, and edge weights",
    (geojson) => {
      // Cast to the expected type
      const original = geojson as unknown as GeoJSON.FeatureCollection;
      const roundTripped = JSON.parse(
        JSON.stringify(original)
      ) as GeoJSON.FeatureCollection;

      const g1 = buildGraph(original);
      const g2 = buildGraph(roundTripped);

      // Node count must match
      expect(g2.nodes.size).toBe(g1.nodes.size);

      // Edge count must match
      expect(g2.edges.size).toBe(g1.edges.size);

      // Edge weights (distanceMeters and shade values) must match for every edge
      for (const [id, edge1] of g1.edges) {
        const edge2 = g2.edges.get(id);
        expect(edge2).toBeDefined();
        if (!edge2) continue;
        expect(edge2.distanceMeters).toBeCloseTo(edge1.distanceMeters, 5);
        expect(edge2.shadeLegacy?.["10"]).toBe(edge1.shadeLegacy?.["10"]);
        expect(edge2.shadeLegacy?.["14"]).toBe(edge1.shadeLegacy?.["14"]);
        expect(edge2.shadeLegacy?.["18"]).toBe(edge1.shadeLegacy?.["18"]);
      }
    }
  );
});

// ---------------------------------------------------------------------------
// Unit tests: malformed GeoJSON throws DatasetError
// ---------------------------------------------------------------------------

describe("buildGraph – malformed input throws DatasetError", () => {
  test("throws DatasetError for null input", () => {
    expect(() => buildGraph(null as unknown as GeoJSON.FeatureCollection)).toThrow(
      DatasetError
    );
  });

  test("throws DatasetError for wrong type (not FeatureCollection)", () => {
    expect(() =>
      buildGraph({ type: "Feature", geometry: null, properties: {} } as unknown as GeoJSON.FeatureCollection)
    ).toThrow(DatasetError);
  });

  test("throws DatasetError when features array is missing", () => {
    expect(() =>
      buildGraph({ type: "FeatureCollection" } as unknown as GeoJSON.FeatureCollection)
    ).toThrow(DatasetError);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: smoke-load campus.geojson
// ---------------------------------------------------------------------------

describe("buildGraph – campus.geojson smoke tests", () => {
  const graph = buildGraph(campusData as unknown as GeoJSON.FeatureCollection);

  test("has at least 10 buildings", () => {
    const buildings = [...graph.nodes.values()].filter(
      (n) => n.type === "building"
    );
    expect(buildings.length).toBeGreaterThanOrEqual(10);
  });

  test("has at least 5 cooling points", () => {
    const coolingPoints = [...graph.nodes.values()].filter(
      (n) => n.type === "cooling_point"
    );
    expect(coolingPoints.length).toBeGreaterThanOrEqual(5);
  });

  test("has at least 5 water refills", () => {
    const waterRefills = [...graph.nodes.values()].filter(
      (n) => n.type === "water_refill"
    );
    expect(waterRefills.length).toBeGreaterThanOrEqual(5);
  });

  test("has at least 3 shade structures (intersections)", () => {
    const intersections = [...graph.nodes.values()].filter(
      (n) => n.type === "intersection"
    );
    expect(intersections.length).toBeGreaterThanOrEqual(3);
  });

  test("every edge has legacy shade snapshots 10 / 14 / 18", () => {
    for (const edge of graph.edges.values()) {
      expect(typeof edge.shadeLegacy?.["10"]).toBe("number");
      expect(typeof edge.shadeLegacy?.["14"]).toBe("number");
      expect(typeof edge.shadeLegacy?.["18"]).toBe("number");
    }
  });
});
