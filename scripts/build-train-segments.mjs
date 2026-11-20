// Builds src/lib/trains/segments.json: one track polyline per station-to-station segment around the
// pilot stations, stitched from the OSM track pieces in src/lib/map/krl-lines.json.
//
// Usage: node scripts/build-train-segments.mjs
//
// The OSM pieces are separate ways in no particular order, so the script builds a graph of their
// points, snaps each station to its nearest track point, and takes the shortest path. It fails when
// a station is far from the track or a path is much longer than the straight line between stations.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const LINES_PATH = join(ROOT, 'src', 'lib', 'map', 'krl-lines.json');
const OUT_PATH = join(ROOT, 'src', 'lib', 'trains', 'segments.json');

// Pilot stations from supabase/seed/stations.csv; the others are approximate and snapped to the track.
const STATION_COORDS = {
  TEB: [-6.22664, 106.85827],
  MRI: [-6.20988, 106.85018],
  SUD: [-6.20241, 106.82361],
  CW: [-6.2427, 106.8587],
  CKI: [-6.1986, 106.8413],
  MTR: [-6.2121, 106.8628],
  SUDB: [-6.2023, 106.8177],
};

const SEGMENTS = [
  ['bogor', 'CW', 'TEB'],
  ['bogor', 'TEB', 'MRI'],
  ['bogor', 'CKI', 'MRI'],
  ['cikarang', 'MTR', 'MRI'],
  ['cikarang', 'MRI', 'SUD'],
  ['cikarang', 'SUD', 'SUDB'],
];

const MAX_SNAP_M = 300;
const JOIN_ENDPOINTS_M = 15;

function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const nodeId = ([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

function buildGraph(paths) {
  const points = new Map(); // id -> [lat, lon]
  const edges = new Map(); // id -> Map(id -> metres)
  const link = (a, b) => {
    const ia = nodeId(a);
    const ib = nodeId(b);
    if (ia === ib) return;
    const d = haversine(a, b);
    for (const [x, y] of [[ia, ib], [ib, ia]]) {
      if (!edges.has(x)) edges.set(x, new Map());
      const prev = edges.get(x).get(y);
      if (prev === undefined || d < prev) edges.get(x).set(y, d);
    }
  };
  for (const path of paths) {
    for (const p of path) points.set(nodeId(p), p);
    for (let i = 1; i < path.length; i += 1) link(path[i - 1], path[i]);
  }
  // Join way endpoints that almost touch (OSM ways split at slightly different coordinates).
  const ends = paths.flatMap((p) => [p[0], p[p.length - 1]]);
  for (let i = 0; i < ends.length; i += 1) {
    for (let j = i + 1; j < ends.length; j += 1) {
      if (haversine(ends[i], ends[j]) < JOIN_ENDPOINTS_M) link(ends[i], ends[j]);
    }
  }
  return { points, edges };
}

function nearestNode(points, target) {
  let best = null;
  let bestD = Infinity;
  for (const [id, p] of points) {
    const d = haversine(p, target);
    if (d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return { id: best, distance: bestD };
}

function shortestPath({ points, edges }, from, to) {
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const done = new Set();
  while (true) {
    let u = null;
    let ud = Infinity;
    for (const [id, d] of dist) {
      if (!done.has(id) && d < ud) {
        u = id;
        ud = d;
      }
    }
    if (u === null) return null;
    if (u === to) break;
    done.add(u);
    for (const [v, w] of edges.get(u) ?? []) {
      const nd = ud + w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
      }
    }
  }
  const ids = [to];
  while (ids[0] !== from) ids.unshift(prev.get(ids[0]));
  return { path: ids.map((id) => points.get(id)), length: dist.get(to) };
}

const lines = JSON.parse(readFileSync(LINES_PATH, 'utf8'));
const graphs = new Map(lines.map((l) => [l.id, buildGraph(l.paths)]));
const out = {};
let failed = false;

for (const [lineId, from, to] of SEGMENTS) {
  const graph = graphs.get(lineId);
  const a = nearestNode(graph.points, STATION_COORDS[from]);
  const b = nearestNode(graph.points, STATION_COORDS[to]);
  const label = `${lineId}:${from}-${to}`;
  if (a.distance > MAX_SNAP_M || b.distance > MAX_SNAP_M) {
    console.error(`${label}: station too far from track (${a.distance.toFixed(0)} m / ${b.distance.toFixed(0)} m)`);
    failed = true;
    continue;
  }
  const result = shortestPath(graph, a.id, b.id);
  const straight = haversine(STATION_COORDS[from], STATION_COORDS[to]);
  if (!result || result.length < 0.8 * straight || result.length > 2.5 * straight) {
    console.error(`${label}: bad path (${result ? result.length.toFixed(0) : 'none'} m vs ${straight.toFixed(0)} m straight)`);
    failed = true;
    continue;
  }
  out[label] = result.path;
  console.log(
    `${label}: ${result.path.length} points, ${result.length.toFixed(0)} m (straight ${straight.toFixed(0)} m), snap ${a.distance.toFixed(0)} m / ${b.distance.toFixed(0)} m`,
  );
}

if (failed) process.exit(1);
writeFileSync(OUT_PATH, `${JSON.stringify({ stations: STATION_COORDS, segments: out })}\n`);
console.log(`wrote ${OUT_PATH}`);
