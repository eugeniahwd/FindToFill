/**
 * Builds src/lib/map/krl-lines.json (KRL track geometry for the map overlay) from
 * OpenStreetMap route relations via the public Overpass API. No API key needed.
 *
 *   npm run map:krl-lines
 *
 * Run it only when the track data needs a refresh; the JSON output is committed.
 * Map data (c) OpenStreetMap contributors, ODbL. The map already shows this attribution.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KRL_LINES, type KrlLineGeometry } from '../src/lib/map/krlLines';
import { roundPolyline, simplifyPolyline, type LatLngTuple } from '../src/lib/map/polyline';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OUTPUT_PATH = join(process.cwd(), 'src', 'lib', 'map', 'krl-lines.json');
/** About 6 m: smooth at street zoom, small file. */
const SIMPLIFY_TOLERANCE_DEG = 0.00005;
/** Member roles that are not track (platforms, stop areas). */
const NON_TRACK_ROLES = new Set(['platform', 'platform_entry_only', 'platform_exit_only', 'stop']);

interface OverpassMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  geometry?: { lat: number; lon: number }[];
}

interface OverpassRelation {
  type: 'relation';
  id: number;
  members: OverpassMember[];
}

async function fetchRelations(ids: number[]): Promise<OverpassRelation[]> {
  const query = `[out:json][timeout:120];relation(id:${ids.join(',')});out geom;`;
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'FindToFill-prototype (map data build script)',
    },
    body: new URLSearchParams({ data: query }).toString(),
  });
  if (!response.ok) throw new Error(`Overpass request failed with HTTP ${response.status}`);
  const json = (await response.json()) as { elements: OverpassRelation[] };
  return json.elements.filter((element) => element.type === 'relation');
}

function trackPaths(relations: OverpassRelation[]): LatLngTuple[][] {
  const seenWays = new Set<number>();
  const paths: LatLngTuple[][] = [];
  for (const relation of relations) {
    for (const member of relation.members) {
      if (member.type !== 'way' || NON_TRACK_ROLES.has(member.role) || !member.geometry) continue;
      if (seenWays.has(member.ref)) continue;
      seenWays.add(member.ref);
      const points = member.geometry.map((p): LatLngTuple => [p.lat, p.lon]);
      if (points.length >= 2) paths.push(roundPolyline(simplifyPolyline(points, SIMPLIFY_TOLERANCE_DEG)));
    }
  }
  return paths;
}

async function main(): Promise<void> {
  const allIds = KRL_LINES.flatMap((line) => line.osmRelationIds);
  const relations = await fetchRelations(allIds);
  const byId = new Map(relations.map((relation) => [relation.id, relation]));

  const output: KrlLineGeometry[] = KRL_LINES.map((line) => {
    const lineRelations = line.osmRelationIds.flatMap((id) => {
      const relation = byId.get(id);
      if (!relation) console.warn(`Relation ${id} (${line.name}) was not returned by Overpass.`);
      return relation ? [relation] : [];
    });
    const paths = trackPaths(lineRelations);
    const pointCount = paths.reduce((sum, path) => sum + path.length, 0);
    console.log(`${line.name}: ${paths.length} ways, ${pointCount} points`);
    return { id: line.id, paths };
  });

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
