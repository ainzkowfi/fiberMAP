import { describe, expect, it } from "vitest";
import {
  computeCumulativeDistances,
  decodeGeometryFromBlob,
  encodeGeometryToBlob,
  formatChainage,
  getPointAtChainage,
  haversineDistance,
  otdrToMapLocation,
  simplifyDouglasPeucker,
  snapPointToPolyline,
} from "./geometry";

describe("geometry engine", () => {
  it("computes haversine distance", () => {
    const p1 = { lat: 8.5085, lon: 125.9772 };
    const p2 = { lat: 8.515, lon: 125.972 };
    const dist = haversineDistance(p1, p2);
    expect(dist).toBeGreaterThan(500);
    expect(dist).toBeLessThan(1500);
  });

  it("snaps a point to a polyline", () => {
    const p1 = { lat: 8.5085, lon: 125.9772 };
    const p2 = { lat: 8.515, lon: 125.972 };
    const snap = snapPointToPolyline({ lat: 8.5117, lon: 125.9746 }, [p1, p2]);
    expect(snap).not.toBeNull();
    expect(snap!.distanceToLineM).toBeLessThan(50);
  });

  it("round-trips the delta-encoded geometry blob", () => {
    const points = [
      { lat: 8.5085, lon: 125.9772 },
      { lat: 8.515, lon: 125.972 },
      { lat: 8.522, lon: 125.967 },
    ];
    const decoded = decodeGeometryFromBlob(encodeGeometryToBlob(points));
    expect(decoded).toHaveLength(3);
    decoded.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(points[i].lat, 5);
      expect(p.lon).toBeCloseTo(points[i].lon, 5);
    });
  });

  it("computes cumulative distances", () => {
    const corners = [
      { lat: 8.5085, lon: 125.9772 },
      { lat: 8.515, lon: 125.972 },
      { lat: 8.522, lon: 125.967 },
    ];
    const cum = computeCumulativeDistances(corners);
    expect(cum).toHaveLength(3);
    expect(cum[0]).toBeCloseTo(0, 3);
    expect(cum[1]).toBeGreaterThan(500);
    expect(cum[2]).toBeGreaterThan(cum[1]);
  });

  it("resolves a point at a given chainage", () => {
    const line = [
      { lat: 8.5085, lon: 125.9772 },
      { lat: 8.515, lon: 125.972 },
    ];
    const cum = computeCumulativeDistances(line);
    const mid = getPointAtChainage(cum[1] / 2, line, cum)!;
    expect(mid.lat).toBeCloseTo(8.51175, 4);
  });

  it("maps an OTDR reading onto the route", () => {
    const line = [
      { lat: 8.5085, lon: 125.9772 },
      { lat: 8.515, lon: 125.972 },
      { lat: 8.522, lon: 125.967 },
    ];
    const match = otdrToMapLocation(800, false, 3, [], line);
    expect(match).not.toBeNull();
    expect(match!.targetMapDistanceM).toBeGreaterThan(700);
    expect(match!.targetMapDistanceM).toBeLessThan(900);
    expect(match!.minMapDistanceM).toBeLessThan(match!.targetMapDistanceM);
    expect(match!.maxMapDistanceM).toBeGreaterThan(match!.targetMapDistanceM);
  });

  it("subtracts slack coils that the OTDR reading passes through", () => {
    const line = [
      { lat: 8.5085, lon: 125.9772 },
      { lat: 8.522, lon: 125.967 },
    ];
    const cum = computeCumulativeDistances(line);
    const total = cum[cum.length - 1];

    // Coil sits before the estimated location, so the reading passes through it.
    const passed = otdrToMapLocation(total * 0.5, true, 0, [[100, 50]], line);
    const bare = otdrToMapLocation(total * 0.5, true, 0, [], line);
    expect(passed!.coilsPassedM).toBe(50);
    // The 50 m of coil cable is subtracted, so both readings land on the same spot.
    expect(passed!.targetMapDistanceM).toBeCloseTo(bare!.targetMapDistanceM, 6);

    // Coil sits beyond the estimated location, so it is never subtracted and
    // the extra cable on the spool pushes the match further from the end.
    const ahead = otdrToMapLocation(total * 0.5, true, 0, [[total - 10, 50]], line);
    expect(ahead!.coilsPassedM).toBe(0);
    expect(ahead!.targetMapDistanceM).toBeGreaterThan(bare!.targetMapDistanceM);
  });

  it("simplifies with Douglas-Peucker", () => {
    const points = [
      { lat: 8.5, lon: 125.97 },
      { lat: 8.5005, lon: 125.976 }, // ~110 m off the A->C line
      { lat: 8.51, lon: 125.98 },
    ];
    expect(simplifyDouglasPeucker(points, 5000)).toHaveLength(2);
    expect(simplifyDouglasPeucker(points, 1)).toHaveLength(3);
  });

  it("formats chainage", () => {
    expect(formatChainage(1240)).toBe("1+240 m");
    expect(formatChainage(1240, false)).toBe("1.24 km");
  });
});
