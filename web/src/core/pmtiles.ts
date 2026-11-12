export interface PmTilesHeader {
  version: number;
  rootDirOffset: number;
  rootDirLength: number;
  jsonMetadataOffset: number;
  jsonMetadataLength: number;
  leafDirsOffset: number;
  leafDirsLength: number;
  tileDataOffset: number;
  tileDataLength: number;
  numAddressedTiles: number;
  numTileEntries: number;
  numTileContents: number;
  isClustered: boolean;
  internalCompression: number;
  tileCompression: number;
  tileType: TileType;
  minZoom: number;
  maxZoom: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  centerZoom: number;
  centerLon: number;
  centerLat: number;
}

export enum TileType {
  UNKNOWN = 0,
  MVT = 1,
  PNG = 2,
  JPEG = 3,
  WEBP = 4,
  AVIF = 5,
}

export const TILE_TYPE_DESCRIPTION: Record<TileType, string> = {
  [TileType.UNKNOWN]: "Unknown",
  [TileType.MVT]: "Mapbox Vector Tile (MVT)",
  [TileType.PNG]: "Raster PNG",
  [TileType.JPEG]: "Raster JPEG",
  [TileType.WEBP]: "Raster WEBP",
  [TileType.AVIF]: "Raster AVIF",
};

const PMTILES_MAGIC = "PMTiles";
export const HEADER_SIZE_BYTES = 127;

export class PmTilesError extends Error {}

/** Parses a PMTiles v3 header from the first 127 bytes of an archive. */
export function readPmTilesHeader(buffer: ArrayBuffer): PmTilesHeader {
  if (buffer.byteLength < HEADER_SIZE_BYTES) {
    throw new PmTilesError("File is too small to be a PMTiles archive");
  }
  const bytes = new Uint8Array(buffer, 0, HEADER_SIZE_BYTES);
  const magic = String.fromCharCode(...bytes.slice(0, 7));
  if (magic !== PMTILES_MAGIC) {
    throw new PmTilesError("Invalid PMTiles magic bytes");
  }
  const version = bytes[7];
  if (version !== 3) {
    throw new PmTilesError(`Unsupported PMTiles version ${version}`);
  }

  const view = new DataView(buffer, 0, HEADER_SIZE_BYTES);
  let offset = 8;
  const u64 = () => {
    const v = view.getBigUint64(offset, true);
    offset += 8;
    return Number(v);
  };
  const u8 = () => bytes[offset++];
  const i32 = () => {
    const v = view.getInt32(offset, true);
    offset += 4;
    return v;
  };

  const rootDirOffset = u64();
  const rootDirLength = u64();
  const jsonMetadataOffset = u64();
  const jsonMetadataLength = u64();
  const leafDirsOffset = u64();
  const leafDirsLength = u64();
  const tileDataOffset = u64();
  const tileDataLength = u64();
  const numAddressedTiles = u64();
  const numTileEntries = u64();
  const numTileContents = u64();

  const isClustered = u8() !== 0;
  const internalCompression = u8();
  const tileCompression = u8();
  const tileType = u8() as TileType;
  const minZoom = u8();
  const maxZoom = u8();

  const minLon = i32() / 10_000_000;
  const minLat = i32() / 10_000_000;
  const maxLon = i32() / 10_000_000;
  const maxLat = i32() / 10_000_000;

  const centerZoom = u8();
  const centerLon = i32() / 10_000_000;
  const centerLat = i32() / 10_000_000;

  return {
    version,
    rootDirOffset,
    rootDirLength,
    jsonMetadataOffset,
    jsonMetadataLength,
    leafDirsOffset,
    leafDirsLength,
    tileDataOffset,
    tileDataLength,
    numAddressedTiles,
    numTileEntries,
    numTileContents,
    isClustered,
    internalCompression,
    tileCompression,
    tileType,
    minZoom,
    maxZoom,
    minLon,
    minLat,
    maxLon,
    maxLat,
    centerZoom,
    centerLon,
    centerLat,
  };
}

export const boundsString = (h: PmTilesHeader) =>
  `${h.minLat.toFixed(4)},${h.minLon.toFixed(4)},${h.maxLat.toFixed(4)},${h.maxLon.toFixed(4)}`;
