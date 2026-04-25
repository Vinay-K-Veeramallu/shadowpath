import type { CampusGraph, GraphEdge } from "../graph/types";

/**
 * Generic priority-queue Dijkstra over a CampusGraph.
 *
 * @param graph     - The campus graph to traverse.
 * @param startId   - ID of the start node.
 * @param endId     - ID of the destination node.
 * @param weightFn  - Returns the cost of traversing an edge (must be >= 0).
 * @param filter    - Optional predicate; edges where filter returns false are skipped.
 * @returns         - The shortest path, or null if no path exists or nodes are missing.
 */
export function dijkstra(
  graph: CampusGraph,
  startId: string,
  endId: string,
  weightFn: (edge: GraphEdge) => number,
  filter?: (edge: GraphEdge) => boolean
): { path: string[]; edges: GraphEdge[]; totalWeight: number } | null {
  // Validate that both nodes exist in the graph
  if (!graph.nodes.has(startId) || !graph.nodes.has(endId)) {
    return null;
  }

  // Trivial case: start === end
  if (startId === endId) {
    return { path: [startId], edges: [], totalWeight: 0 };
  }

  // dist[nodeId] = best known cost to reach that node
  const dist = new Map<string, number>();
  // prev[nodeId] = { nodeId, edge } that led to this node on the best path
  const prev = new Map<string, { nodeId: string; edge: GraphEdge }>();

  // Initialise all distances to Infinity
  for (const nodeId of graph.nodes.keys()) {
    dist.set(nodeId, Infinity);
  }
  dist.set(startId, 0);

  // Priority queue as a sorted array of [cost, nodeId]
  // We keep it sorted ascending by cost so the minimum is always at index 0.
  const queue: Array<{ cost: number; nodeId: string }> = [
    { cost: 0, nodeId: startId },
  ];

  const visited = new Set<string>();

  while (queue.length > 0) {
    // Pop the node with the smallest cost (front of sorted array)
    const { cost, nodeId } = queue.shift()!;

    // Skip stale entries
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    // Early exit once we reach the destination
    if (nodeId === endId) break;

    const neighbours = graph.adjacency.get(nodeId) ?? [];

    for (const edge of neighbours) {
      // Apply the optional filter predicate
      if (filter && !filter(edge)) continue;

      // Determine the neighbour on the other side of this edge
      const neighbourId = edge.from === nodeId ? edge.to : edge.from;

      if (visited.has(neighbourId)) continue;

      const edgeCost = weightFn(edge);
      const newCost = cost + edgeCost;

      if (newCost < (dist.get(neighbourId) ?? Infinity)) {
        dist.set(neighbourId, newCost);
        prev.set(neighbourId, { nodeId, edge });

        // Insert into the sorted queue (binary-search insertion for efficiency)
        const entry = { cost: newCost, nodeId: neighbourId };
        let lo = 0;
        let hi = queue.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (queue[mid].cost <= entry.cost) {
            lo = mid + 1;
          } else {
            hi = mid;
          }
        }
        queue.splice(lo, 0, entry);
      }
    }
  }

  // No path found
  if (dist.get(endId) === Infinity) {
    return null;
  }

  // Reconstruct path by walking backwards through `prev`
  const pathEdges: GraphEdge[] = [];
  const pathNodes: string[] = [];
  let current = endId;

  while (current !== startId) {
    const entry = prev.get(current);
    if (!entry) return null; // Shouldn't happen, but guard anyway
    pathEdges.unshift(entry.edge);
    pathNodes.unshift(current);
    current = entry.nodeId;
  }
  pathNodes.unshift(startId);

  const totalWeight = pathEdges.reduce((sum, edge) => sum + weightFn(edge), 0);

  return { path: pathNodes, edges: pathEdges, totalWeight };
}
