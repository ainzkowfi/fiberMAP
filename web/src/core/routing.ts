import type { GeoPoint } from "./geometry";

/**
 * Road routing for the auto-path draw mode.
 *
 * The basemap archive carries the OSM road network as vector tiles, so the
 * roads are read straight off the live map. No server, no extra download.
 * The graph is rebuilt from whatever is in view, which is all a field tech
 * needs: they are standing on the road they want to trace.
 */

export interface RoadFeature {
  geometry: {
    type: "LineString" | "MultiLineString";
    coordinates: number[][] | number[][][];
  };
  properties?: Record<string, unknown>;
}

interface Graph {
  /** Node id -> [lon, lat] */
  nodes: Map<string, [number, number]>;
  /** Node id -> [{ to: nodeId, cost: metres }] */
  edges: Map<string, Array<{ to: string; cost: number }>>;
}

const EARTH_R = 6371000;

function haversine(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

function nodeId(coord: [number, number]): string {
  // Round to 6 decimals (~0.1 m) so the same corner in two tiles is one node.
  return `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
}

function linesOf(feature: RoadFeature): Array<Array<[number, number]>> {
  if (feature.geometry.type === "LineString") {
    return [feature.geometry.coordinates as Array<[number, number]>];
  }
  return (feature.geometry.coordinates as Array<Array<[number, number]>>).map(
    (line) => line as Array<[number, number]>,
  );
}

/** Build a routing graph from the road features currently in view. */
export function buildRoadGraph(features: RoadFeature[]): Graph {
  const nodes = new Map<string, [number, number]>();
  const edges = new Map<string, Array<{ to: string; cost: number }>>();

  const addEdge = (a: string, b: string, cost: number) => {
    if (!edges.has(a)) edges.set(a, []);
    edges.get(a)!.push({ to: b, cost });
  };

  for (const feature of features) {
    for (const line of linesOf(feature)) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = nodeId(line[i]);
        const b = nodeId(line[i + 1]);
        nodes.set(a, line[i]);
        nodes.set(b, line[i + 1]);
        const cost = haversine(line[i], line[i + 1]);
        addEdge(a, b, cost);
        addEdge(b, a, cost);
      }
    }
  }

  return { nodes, edges };
}

/** Nearest graph node to a point, within `maxM` (default 120 m). */
export function nearestNode(
  graph: Graph,
  point: GeoPoint,
  maxM = 120,
): { id: string; dist: number } | null {
  let best: { id: string; dist: number } | null = null;
  for (const [id, coord] of graph.nodes) {
    const d = haversine([point.lon, point.lat], coord);
    if (d <= maxM && (!best || d < best.dist)) best = { id, dist: d };
  }
  return best;
}

/**
 * Dijkstra shortest path between two nodes. Returns the coordinates in order,
 * or null when the two points are not on the same connected road network.
 */
export function shortestPath(
  graph: Graph,
  startId: string,
  endId: string,
): Array<[number, number]> | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; d: number }> = [{ id: startId, d: 0 }];
  dist.set(startId, 0);

  while (queue.length > 0) {
    // Small graph: a linear scan beats a heap here.
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].d < queue[bi].d) bi = i;
    const { id } = queue.splice(bi, 1)[0];
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === endId) break;

    for (const { to, cost } of graph.edges.get(id) ?? []) {
      const nd = (dist.get(id) ?? Infinity) + cost;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, id);
        queue.push({ id: to, d: nd });
      }
    }
  }

  if (!prev.has(endId)) return null;

  const path: Array<[number, number]> = [];
  let cur = endId;
  while (cur !== startId) {
    path.unshift(graph.nodes.get(cur)!);
    cur = prev.get(cur)!;
  }
  path.unshift(graph.nodes.get(startId)!);
  return path;
}

export interface RouteResult {
  /** The path in map order, as lon/lat pairs. */
  path: Array<[number, number]>;
  /** Total length in metres. */
  lengthM: number;
}

/** Route between two map points along the roads in view. */
export function routeBetween(
  features: RoadFeature[],
  start: GeoPoint,
  end: GeoPoint,
): RouteResult | null {
  const graph = buildRoadGraph(features);
  if (graph.nodes.size === 0) return null;

  const a = nearestNode(graph, start);
  const b = nearestNode(graph, end);
  if (!a || !b) return null;
  if (a.id === b.id) return null;

  const path = shortestPath(graph, a.id, b.id);
  if (!path || path.length < 2) return null;

  let lengthM = 0;
  for (let i = 1; i < path.length; i++) lengthM += haversine(path[i - 1], path[i]);

  return { path, lengthM };
}