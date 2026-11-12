export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface SnapResult {
  snapPoint: GeoPoint;
  segmentIndex: number;
  projectionRatio: number;
  distanceToLineM: number;
  chainageM: number;
}

export interface ChainagePoint {
  point: GeoPoint;
  segmentIndex: number;
  bearingDegrees: number;
}

export interface OtdrMapMatch {
  targetMapDistanceM: number;
  point: GeoPoint;
  minMapDistanceM: number;
  maxMapDistanceM: number;
  minPoint: GeoPoint;
  maxPoint: GeoPoint;
  coilsPassedM: number;
}

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export const EARTH_RADIUS_M = 6_371_008.8;

export function haversineDistance(p1: GeoPoint, p2: GeoPoint): number {
  const lat1Rad = (p1.lat * Math.PI) / 180;
  const lat2Rad = (p2.lat * Math.PI) / 180;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function computeCumulativeDistances(points: GeoPoint[]): number[] {
  if (points.length === 0) return [];
  const cum = new Array<number>(points.length);
  cum[0] = 0;
  for (let i = 0; i < points.length - 1; i++) {
    cum[i + 1] = cum[i] + haversineDistance(points[i], points[i + 1]);
  }
  return cum;
}

export function snapPointToPolyline(
  point: GeoPoint,
  polyline: GeoPoint[],
  cumulative: number[] = computeCumulativeDistances(polyline),
): SnapResult | null {
  if (polyline.length < 2) return null;

  let bestDist = Number.MAX_VALUE;
  let bestSnap = polyline[0];
  let bestSegIndex = 0;
  let bestRatio = 0;
  let bestChainage = 0;

  const cosLat = Math.cos((point.lat * Math.PI) / 180);

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];

    // Flat local projection around the segment.
    const ax = (((a.lon - point.lon) * Math.PI) / 180) * cosLat * EARTH_RADIUS_M;
    const ay = (((a.lat - point.lat) * Math.PI) / 180) * EARTH_RADIUS_M;
    const bx = (((b.lon - point.lon) * Math.PI) / 180) * cosLat * EARTH_RADIUS_M;
    const by = (((b.lat - point.lat) * Math.PI) / 180) * EARTH_RADIUS_M;

    const segDx = bx - ax;
    const segDy = by - ay;
    const segLenSq = segDx * segDx + segDy * segDy;

    const t =
      segLenSq > 1e-6 ? (-ax * segDx - ay * segDy) / segLenSq : 0;
    const clamped = Math.min(1, Math.max(0, t));

    const projLat = a.lat + clamped * (b.lat - a.lat);
    const projLon = a.lon + clamped * (b.lon - a.lon);
    const snapP = { lat: projLat, lon: projLon };

    const dist = haversineDistance(point, snapP);
    if (dist < bestDist) {
      bestDist = dist;
      bestSnap = snapP;
      bestSegIndex = i;
      bestRatio = clamped;
      const segLength =
        i + 1 < cumulative.length
          ? cumulative[i + 1] - cumulative[i]
          : haversineDistance(a, b);
      bestChainage = cumulative[i] + clamped * segLength;
    }
  }

  return {
    snapPoint: bestSnap,
    segmentIndex: bestSegIndex,
    projectionRatio: bestRatio,
    distanceToLineM: bestDist,
    chainageM: bestChainage,
  };
}

export function getPointAtChainage(
  chainageM: number,
  polyline: GeoPoint[],
  cumulative: number[] = computeCumulativeDistances(polyline),
): GeoPoint | null {
  if (polyline.length === 0) return null;
  if (polyline.length === 1) return polyline[0];
  const totalLength = cumulative[cumulative.length - 1] ?? 0;
  if (chainageM <= 0) return polyline[0];
  if (chainageM >= totalLength) return polyline[polyline.length - 1];

  let low = 0;
  let high = cumulative.length - 1;
  let segIndex = 0;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (cumulative[mid] <= chainageM) {
      segIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (segIndex >= polyline.length - 1) return polyline[polyline.length - 1];

  const segStart = cumulative[segIndex];
  const segEnd = cumulative[segIndex + 1];
  const segLen = segEnd - segStart;
  const t = segLen > 1e-4 ? (chainageM - segStart) / segLen : 0;

  const a = polyline[segIndex];
  const b = polyline[segIndex + 1];
  return { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) };
}

export function otdrToMapLocation(
  otdrDistanceM: number,
  fromEnd: boolean,
  slackPercent: number,
  coils: Array<[number, number]>,
  polyline: GeoPoint[],
  cumulative: number[] = computeCumulativeDistances(polyline),
  uncertaintyRatio = 0.03,
  launchOffsetM = 0,
): OtdrMapMatch | null {
  if (polyline.length < 2) return null;
  const totalMapLength = cumulative[cumulative.length - 1] ?? 0;
  if (totalMapLength <= 0) return null;

  const slackFactor = 1 + slackPercent / 100;

  // The launch cable and the pigtail sit between the OTDR and the fiber under
  // test, so the reading is longer than the route by that much. Take it off
  // before the solve. An offset of zero changes nothing.
  const reading = Math.max(0, otdrDistanceM - Math.max(0, launchOffsetM));

  const effectiveCableDist = fromEnd
    ? Math.max(
        0,
        totalMapLength * slackFactor +
          coils.reduce((s, c) => s + c[1], 0) -
          reading,
      )
    : reading;

  // Iterative solve: coils subtract based on the current map chainage estimate.
  let estimatedMapDist = effectiveCableDist / slackFactor;
  let prevEst = -1;
  let iterations = 0;
  let coilsPassed = 0;

  while (Math.abs(estimatedMapDist - prevEst) > 0.5 && iterations < 10) {
    prevEst = estimatedMapDist;
    coilsPassed = coils
      .filter((c) => c[0] <= estimatedMapDist)
      .reduce((s, c) => s + c[1], 0);
    const netCable = Math.max(0, effectiveCableDist - coilsPassed);
    estimatedMapDist = netCable / slackFactor;
    iterations++;
  }

  const clampedTarget = Math.min(totalMapLength, Math.max(0, estimatedMapDist));
  const targetPoint = getPointAtChainage(clampedTarget, polyline, cumulative);
  if (!targetPoint) return null;

  const uncertaintyM = Math.max(5, clampedTarget * uncertaintyRatio);
  const minMapDist = Math.max(0, clampedTarget - uncertaintyM);
  const maxMapDist = Math.min(totalMapLength, clampedTarget + uncertaintyM);

  const minPoint = getPointAtChainage(minMapDist, polyline, cumulative) ?? targetPoint;
  const maxPoint = getPointAtChainage(maxMapDist, polyline, cumulative) ?? targetPoint;

  return {
    targetMapDistanceM: clampedTarget,
    point: targetPoint,
    minMapDistanceM: minMapDist,
    maxMapDistanceM: maxMapDist,
    minPoint,
    maxPoint,
    coilsPassedM: coilsPassed,
  };
}

export function simplifyDouglasPeucker(
  points: GeoPoint[],
  toleranceM: number,
): GeoPoint[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  const cosLat = Math.cos((((first.lat + last.lat) / 2) * Math.PI) / 180);

  const ax = ((first.lon * Math.PI) / 180) * cosLat * EARTH_RADIUS_M;
  const ay = ((first.lat * Math.PI) / 180) * EARTH_RADIUS_M;
  const bx = ((last.lon * Math.PI) / 180) * cosLat * EARTH_RADIUS_M;
  const by = ((last.lat * Math.PI) / 180) * EARTH_RADIUS_M;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const px = ((p.lon * Math.PI) / 180) * cosLat * EARTH_RADIUS_M;
    const py = ((p.lat * Math.PI) / 180) * EARTH_RADIUS_M;

    let dist: number;
    if (lenSq > 1e-4) {
      const t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      const clampedT = Math.min(1, Math.max(0, t));
      const projX = ax + clampedT * dx;
      const projY = ay + clampedT * dy;
      dist = Math.hypot(px - projX, py - projY);
    } else {
      dist = Math.hypot(px - ax, py - ay);
    }

    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > toleranceM) {
    const left = simplifyDouglasPeucker(points.slice(0, maxIndex + 1), toleranceM);
    const right = simplifyDouglasPeucker(points.slice(maxIndex), toleranceM);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

// --- Delta-encoded zigzag varint geometry blob (matches the Android format) ---

export function encodeGeometryToBlob(points: GeoPoint[]): Uint8Array {
  const out: number[] = [];
  writeVarInt(out, points.length);
  let lastLat = 0;
  let lastLon = 0;

  for (const pt of points) {
    const latMicro = Math.trunc(pt.lat * 1_000_000);
    const lonMicro = Math.trunc(pt.lon * 1_000_000);
    writeSignedVarInt(out, latMicro - lastLat);
    writeSignedVarInt(out, lonMicro - lastLon);
    lastLat = latMicro;
    lastLon = lonMicro;
  }
  return Uint8Array.from(out);
}

export function decodeGeometryFromBlob(blob: Uint8Array): GeoPoint[] {
  if (blob.length === 0) return [];
  let pos = 0;
  const readByte = () => blob[pos++];

  const readVarInt = (): number => {
    let result = 0;
    let shift = 0;
    for (;;) {
      const b = readByte();
      if (b === undefined) break;
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return result;
  };

  const size = readVarInt();
  const result: GeoPoint[] = [];
  let currentLat = 0;
  let currentLon = 0;

  const readSignedVarInt = (): number => {
    const raw = readVarInt();
    return (raw >>> 1) ^ -(raw & 1);
  };

  for (let i = 0; i < size; i++) {
    const dLat = readSignedVarInt();
    const dLon = readSignedVarInt();
    currentLat += dLat;
    currentLon += dLon;
    result.push({ lat: currentLat / 1_000_000, lon: currentLon / 1_000_000 });
  }
  return result;
}

function writeVarInt(out: number[], value: number) {
  let v = value;
  while ((v & ~0x7f) !== 0) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v & 0x7f);
}

function writeSignedVarInt(out: number[], value: number) {
  const zigzag = (value << 1) ^ (value >> 31);
  writeVarInt(out, zigzag);
}

export function formatChainage(
  distanceM: number,
  useChainageStyle = true,
): string {
  if (!useChainageStyle) {
    return distanceM >= 1000
      ? `${(distanceM / 1000).toFixed(2)} km`
      : `${Math.round(distanceM)} m`;
  }
  const km = Math.trunc(distanceM / 1000);
  const meters = Math.round(distanceM % 1000);
  return `${km}+${String(meters).padStart(3, "0")} m`;
}
