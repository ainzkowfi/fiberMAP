import { describe, expect, it } from "vitest";
import { readPmTilesHeader, TileType } from "./pmtiles";

/** Builds a valid PMTiles v3 header, mirroring the APK's synthetic header. */
function syntheticHeader(options: {
  minZoom?: number;
  maxZoom?: number;
  minLat?: number;
  minLon?: number;
  maxLat?: number;
  maxLon?: number;
  tileType?: TileType;
} = {}) {
  const {
    minZoom = 8,
    maxZoom = 18,
    minLat = 7.5,
    minLon = 125.0,
    maxLat = 9.2,
    maxLon = 126.8,
    tileType = TileType.MVT,
  } = options;

  const buffer = new ArrayBuffer(127);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const magic = "PMTiles";
  for (let i = 0; i < 7; i++) bytes[i] = magic.charCodeAt(i);
  bytes[7] = 3;

  let offset = 8;
  const u64 = (v: number) => {
    view.setBigUint64(offset, BigInt(v), true);
    offset += 8;
  };
  u64(127); // rootDirOffset
  u64(1024); // rootDirLength
  u64(2048); // jsonMetadataOffset
  u64(512); // jsonMetadataLength
  u64(0); // leafDirsOffset
  u64(0); // leafDirsLength
  u64(4096); // tileDataOffset
  u64(10_000_000); // tileDataLength
  u64(1250); // numAddressedTiles
  u64(1250); // numTileEntries
  u64(1250); // numTileContents

  bytes[offset++] = 1; // isClustered
  bytes[offset++] = 2; // internalCompression gzip
  bytes[offset++] = 2; // tileCompression gzip
  bytes[offset++] = tileType;
  bytes[offset++] = minZoom;
  bytes[offset++] = maxZoom;

  view.setInt32(offset, Math.round(minLon * 10_000_000), true);
  offset += 4;
  view.setInt32(offset, Math.round(minLat * 10_000_000), true);
  offset += 4;
  view.setInt32(offset, Math.round(maxLon * 10_000_000), true);
  offset += 4;
  view.setInt32(offset, Math.round(maxLat * 10_000_000), true);
  offset += 4;

  bytes[offset++] = 13; // centerZoom
  view.setInt32(offset, Math.round(125.9772 * 10_000_000), true);
  offset += 4;
  view.setInt32(offset, Math.round(8.5085 * 10_000_000), true);

  return buffer;
}

describe("pmtiles header", () => {
  it("parses a v3 header", () => {
    const header = readPmTilesHeader(syntheticHeader());
    expect(header.version).toBe(3);
    expect(header.minZoom).toBe(8);
    expect(header.maxZoom).toBe(18);
    expect(header.minLat).toBeCloseTo(7.5, 4);
    expect(header.minLon).toBeCloseTo(125.0, 4);
    expect(header.maxLat).toBeCloseTo(9.2, 4);
    expect(header.maxLon).toBeCloseTo(126.8, 4);
    expect(header.tileType).toBe(TileType.MVT);
  });

  it("rejects a non-PMTiles file", () => {
    expect(() => readPmTilesHeader(new ArrayBuffer(127))).toThrow(/magic/);
  });

  it("rejects a truncated file", () => {
    expect(() => readPmTilesHeader(new ArrayBuffer(10))).toThrow(/too small/);
  });
});
