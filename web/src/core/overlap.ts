import {
  computeCumulativeDistances,
  getPointAtChainage,
  haversineDistance,
  snapPointToPolyline,
  type GeoPoint,
} from "./geometry";

export interface OverlapLine {
  id: string;
  vertices: GeoPoint[];
}

// Two cables on the same road run within a few metres of each other for the
// stretch they share. The corridor test samples one line and asks how much of
// it the other line covers, so a line that shares only part of the path still
// counts, and two lines that merely cross do not.
const CORRIDOR_M = 20;
const COVERAGE = 0.2;

// Screen pixels between two lines of the same corridor. Ten pixels reads as
// two separate strands at any zoom a crew works at.
const OFFSET_SPACING_PX = 10;

function lengthOf(vertices: GeoPoint[]): number {
  const cumulative = computeCumulativeDistances(vertices);
  return cumulative[cumulative.length - 1] ?? 0;
}

function covers(a: OverlapLine, aLen: number, b: OverlapLine): number {
  let covered = 0;
  let counted = 0;
  for (let i = 0; i <= 20; i++) {
    const p = getPointAtChainage((aLen * i) / 20, a.vertices);
    if (!p) continue;
    counted++;
    const snap = snapPointToPolyline(p, b.vertices);
    if (snap && snap.distanceToLineM <= CORRIDOR_M) covered++;
  }
  return counted === 0 ? 0 : covered / counted;
}

function samePath(a: OverlapLine, b: OverlapLine): boolean {
  if (a.vertices.length < 2 || b.vertices.length < 2) return false;
  const aLen = lengthOf(a.vertices);
  const bLen = lengthOf(b.vertices);

  // Too short to sample: fall back to the ends.
  if (aLen < 10 || bLen < 10) {
    const aStart = a.vertices[0];
    const aEnd = a.vertices[a.vertices.length - 1];
    const bStart = b.vertices[0];
    const bEnd = b.vertices[b.vertices.length - 1];
    const forward =
      haversineDistance(aStart, bStart) <= 25 && haversineDistance(aEnd, bEnd) <= 25;
    const reverse =
      haversineDistance(aStart, bEnd) <= 25 && haversineDistance(aEnd, bStart) <= 25;
    return forward || reverse;
  }

  // If either direction shows enough coverage, the lines share a corridor.
  // Using max means a short line that sits inside a long one still counts,
  // because the short line's coverage of the long one is complete.
  return Math.max(covers(a, aLen, b), covers(b, bLen, a)) >= COVERAGE;
}

/**
 * Lines that pass within `radiusM` metres of a tap point.
 *
 * The corridor test groups lines that share a road. This is the fallback for
 * the case where the tap itself lands on more than one line, even if the
 * corridor test did not group them.
 */
export function wiresAtTap(
  lines: OverlapLine[],
  tap: { lat: number; lon: number },
  radiusM: number = 20,
): string[] {
  return lines
    .filter((l) => {
      const snap = snapPointToPolyline(tap, l.vertices);
      return snap !== null && snap.distanceToLineM <= radiusM;
    })
    .map((l) => l.id);
}

/**
 * The other lines recorded along the same path as this one.
 *
 * A crew walking the same road twice ends up with two lines that look like
 * one on the map. This answers "how many cables are on this road?" without
 * the crew having to compare them by eye.
 */
export function wiresOnPath(lines: OverlapLine[], targetId: string): string[] {
  const target = lines.find((l) => l.id === targetId);
  if (!target) return [];
  return lines
    .filter((l) => l.id !== targetId && samePath(target, l))
    .map((l) => l.id);
}

/**
 * Screen-pixel offsets that fan out lines recorded on the same path.
 *
 * A crew that walks the same span twice gets two identical geometries, and
 * the second line hides the first. Fanning them apart keeps every line
 * visible and tappable without moving the data on disk. A lone line stays at
 * 0, so normal lines sit exactly where they were drawn.
 */
export function lineOffsets(lines: OverlapLine[]): Record<string, number> {
  const groups: OverlapLine[][] = [];
  for (const line of lines) {
    const group = groups.find((g) => samePath(g[0], line));
    if (group) group.push(line);
    else groups.push([line]);
  }

  const offsets: Record<string, number> = {};
  for (const group of groups) {
    // Sorting by id keeps a line on the same side when its updatedAt changes.
    group.sort((a, b) => a.id.localeCompare(b.id));
    const middle = (group.length - 1) / 2;
    group.forEach((line, index) => {
      offsets[line.id] = (index - middle) * OFFSET_SPACING_PX;
    });
  }
  return offsets;
}
