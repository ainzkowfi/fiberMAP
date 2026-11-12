import { addProtocol, type Map as MapLibreMap, type RequestParameters } from "maplibre-gl";
import { PMTiles } from "pmtiles";

/**
 * MapLibre does not know how to read PMTiles out of the box, so the archive is
 * served over a `pmtiles://` protocol that this file owns.
 *
 * The handler is written here rather than taken from the pmtiles package
 * because the map and the package disagree about the shape of a response: the
 * map wants the tile bytes as an ArrayBuffer and the tile description as an
 * object, and the package hands over a Uint8Array and an object in one field.
 *
 * The protocol has to be registered before the map is created. The map takes a
 * copy of the protocol handlers when it is built, so a protocol registered
 * later is never seen and the archive renders as an empty map.
 */
const archives = new Map<string, PMTiles>();
let registered = false;
let mountedKey: string | null = null;

function registerProtocol() {
  if (registered) return;
  registered = true;

  addProtocol(
    "pmtiles",
    async (params: RequestParameters, abortController: AbortController) => {
      const match = /^pmtiles:\/\/([^/]+)(?:\/(\d+)\/(\d+)\/(\d+))?$/.exec(params.url);
      if (!match) throw new Error(`Invalid PMTiles protocol URL: ${params.url}`);
      const key = match[1];
      const archive = archives.get(key);
      if (!archive) throw new Error(`Unknown PMTiles archive: ${key}`);

      if (!match[2]) {
        // The tile description. The map reads the zoom levels and the tile
        // template straight out of it.
        const header = await archive.getHeader();
        return {
          data: {
            tiles: [`pmtiles://${key}/{z}/{x}/{y}`],
            minzoom: header.minZoom,
            maxzoom: header.maxZoom,
            bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
          },
        };
      }

      const tile = await archive.getZxy(
        Number(match[2]),
        Number(match[3]),
        Number(match[4]),
        abortController.signal,
      );
      if (!tile) return { data: new ArrayBuffer(0) };
      const bytes = new Uint8Array(tile.data);
      return {
        data: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      };
    },
  );
}

export interface ArchiveInfo {
  key: string;
  minZoom: number;
  maxLon: number;
  minLat: number;
  maxZoom: number;
  minLon: number;
  maxLat: number;
  sizeBytes: number;
}

/** Registers an archive under a stable key so the style can reference it. */
export function registerPmTilesArchive(key: string, archive: PMTiles): void {
  registerProtocol();
  archives.set(key, archive);
  mountedKey = key;
}

/** Key of the archive currently mounted on the map, if any. */
export function getMountedKey(): string | null {
  return mountedKey;
}

/** Makes sure the protocol exists before a map is built. */
export function ensurePmTilesProtocol(): void {
  registerProtocol();
}

/** Adds the PMTiles vector source to a map instance. */
export function addPmTilesSource(map: MapLibreMap, key: string): void {
  registerProtocol();
  if (map.getSource("pmtiles")) {
    map.removeSource("pmtiles");
  }
  map.addSource("pmtiles", {
    type: "vector",
    url: `pmtiles://${key}`,
  });
}
