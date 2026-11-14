import { describe, expect, it } from "vitest";
import { routeBetween, type RoadFeature } from "./routing";

const line = (coords: number[][]): RoadFeature => ({
  geometry: { type: "LineString", coordinates: coords },
});

// A straight road east from A to C, and a long detour north of it.
const features: RoadFeature[] = [
  line([
    [0, 0],
    [0.001, 0],
    [0.002, 0],
  ]),
  line([
    [0, 0],
    [0.001, 0.002],
    [0.002, 0],
  ]),
];

describe("road routing", () => {
  it("takes the shorter road between the two taps", () => {
    const route = routeBetween(features, { lat: 0, lon: 0 }, { lat: 0, lon: 0.002 });
    expect(route).not.toBeNull();
    // The straight road is ~222 m; the detour is ~400 m.
    expect(route!.lengthM).toBeGreaterThan(200);
    expect(route!.lengthM).toBeLessThan(250);
    expect(route!.path[0]).toEqual([0, 0]);
    expect(route!.path[route!.path.length - 1]).toEqual([0.002, 0]);
    expect(route!.path).toHaveLength(3);
  });

  it("returns null when the taps are not near a road", () => {
    const route = routeBetween(features, { lat: 0.5, lon: 0.5 }, { lat: 0, lon: 0.002 });
    expect(route).toBeNull();
  });

  it("returns null when the roads are disconnected", () => {
    const disconnected = [...features, line([[0.01, 0.01], [0.011, 0.01]])];
    const route = routeBetween(
      disconnected,
      { lat: 0, lon: 0 },
      { lat: 0.01, lon: 0.01 },
    );
    expect(route).toBeNull();
  });
});
