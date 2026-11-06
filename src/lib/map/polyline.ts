/** A [latitude, longitude] pair, the order Leaflet expects. */
export type LatLngTuple = [number, number];

function perpendicularDistance(point: LatLngTuple, start: LatLngTuple, end: LatLngTuple): number {
  const [py, px] = point;
  const [sy, sx] = start;
  const [ey, ex] = end;
  const dx = ex - sx;
  const dy = ey - sy;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - sx, py - sy);
  const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lengthSq));
  return Math.hypot(px - (sx + t * dx), py - (sy + t * dy));
}

/**
 * Douglas-Peucker simplification. `tolerance` is in degrees
 * (0.0001 deg is roughly 11 m at Jakarta's latitude). Endpoints are always kept.
 */
export function simplifyPolyline(points: LatLngTuple[], tolerance: number): LatLngTuple[] {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let splitIndex = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[last]);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }

  if (maxDistance <= tolerance) return [points[0], points[last]];

  const left = simplifyPolyline(points.slice(0, splitIndex + 1), tolerance);
  const right = simplifyPolyline(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Rounds coordinates to `decimals` places (5 decimals is about 1 m) to keep the data file small. */
export function roundPolyline(points: LatLngTuple[], decimals = 5): LatLngTuple[] {
  const factor = 10 ** decimals;
  return points.map(([lat, lng]) => [Math.round(lat * factor) / factor, Math.round(lng * factor) / factor]);
}
