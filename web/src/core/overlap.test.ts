import { describe, expect, it } from "vitest";
import { lineOffsets, wiresAtTap, type OverlapLine } from "./overlap";

const line = (id: string, coords: number[][]): OverlapLine => ({
  id,
  vertices: coords.map(([lon, lat]) => ({ lat, lon })),
});

// A straight 222 m span along the equator.
const span = (id: string) => line(id, [[0, 0], [0.001, 0], [0.002, 0]]);

describe("overlapping line offsets", () => {
  it("leaves a lone line on the drawn path", () => {
    expect(lineOffsets([span("a")])).toEqual({ a: 0 });
  });

  it("fans duplicate lines apart", () => {
    const offsets = lineOffsets([span("a"), span("b")]);
    expect(offsets.a).toBe(-5);
    expect(offsets.b).toBe(5);
  });

  it("groups a duplicate recorded in the opposite direction", () => {
    const reversed = line("b", [[0.002, 0], [0.001, 0], [0, 0]]);
    const offsets = lineOffsets([span("a"), reversed]);
    expect(offsets.a).toBe(-5);
    expect(offsets.b).toBe(5);
  });

  it("groups a line that shares only part of the path", () => {
    // Same road, different extents: the short line is inside the long one.
    const short = line("b", [[0.0005, 0], [0.0015, 0]]);
    const offsets = lineOffsets([span("a"), short]);
    expect(offsets.a).toBe(-5);
    expect(offsets.b).toBe(5);
  });

  it("groups two lines that share the middle stretch", () => {
    const west = line("a", [[-0.00065, 0], [0.0002, 0]]);
    const east = line("b", [[-0.0002, 0], [0.00065, 0]]);
    const offsets = lineOffsets([west, east]);
    expect(offsets.a).toBe(-5);
    expect(offsets.b).toBe(5);
  });

  it("keeps lines on different routes centred", () => {
    const elsewhere = line("b", [[0.01, 0.01], [0.011, 0.01], [0.012, 0.01]]);
    const offsets = lineOffsets([span("a"), elsewhere]);
    expect(offsets).toEqual({ a: 0, b: 0 });
  });

  it("keeps lines that only cross centred", () => {
    const crossing = line("b", [[0.001, -0.001], [0.001, 0.001]]);
    const offsets = lineOffsets([span("a"), crossing]);
    expect(offsets).toEqual({ a: 0, b: 0 });
  });

  it("spreads three copies around the centre", () => {
    const offsets = lineOffsets([span("a"), span("b"), span("c")]);
    expect(offsets).toEqual({ a: -10, b: 0, c: 10 });
  });
});

describe("wires at a tap", () => {
  it("returns every line within 20 m of the tap", () => {
    const a = span("a");
    const b = span("b");
    const far = line("c", [[0.01, 0.01], [0.011, 0.01], [0.012, 0.01]]);
    const ids = wiresAtTap([a, b, far], { lat: 0, lon: 0.001 });
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
  });
});
