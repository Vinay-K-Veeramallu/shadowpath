import campusData from "../../data/campus.geojson";
import { buildGraph } from "../graph/buildGraph";
import { DatasetError } from "../graph/types";
import type { CampusGraph } from "../graph/types";

let campusGraph: CampusGraph;

try {
  campusGraph = buildGraph(campusData as GeoJSON.FeatureCollection);
} catch (err) {
  if (err instanceof DatasetError) {
    throw err;
  }
  throw new DatasetError(`Failed to load campus dataset: ${err}`);
}

export { campusGraph };
