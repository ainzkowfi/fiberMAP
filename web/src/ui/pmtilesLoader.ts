import maplibregl from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * MapLibre does not know how to read PMTiles out of the box. The pmtiles
 * package ships a protocol handler; registering it once lets any style use a
 * `pmtiles://<key>` vector source.
 *
 * MapLibre v5 has no global `maplibregl` object, so the module import is used
 * directly rather than reaching for a global.
 */
let protocol: Protocol | null = null;

export function getPmTilesProtocol(): Protocol {
  if (!protocol) {
    protocol = new Protocol({ metadata: false });
    maplibregl.addProtocol("pmtiles", protocol.tile);
  }
  return protocol;
}

export interface ArchiveInfo {
  key: string;
  minZoom: number;
  maxZoom: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  sizeBytes: number;
}

let mountedKey: string | null = null;
let lastInfo: ArchiveInfo | null = null;

/** Key of the archive currently mounted on the map, if any. */
export function getMountedKey(): string | null {
  return mountedKey;
}

export function getMountedInfo(): ArchiveInfo | null {
  return lastInfo;
}

/**
 * Registers an already-instantiated archive under a stable key so the style
 * can reference `pmtiles://<key>`. The archive is expected to be backed by
 * IndexedDB (see `pmtilesStore.ts`) so it survives reloads and needs no
 * network.
 */
export function registerArchive(
  key: string,
  archive: PMTiles,
  info: ArchiveInfo,
): void {
  getPmTilesProtocol().add(archive);
  mountedKey = key;
  lastInfo = info;
}

/** Adds the PMTiles vector source to a map instance. */
export function addPmTilesSource(map: MapLibreMap, key: string): void {
  if (map.getSource("pmtiles")) {
    map.removeSource("pmtiles");
  }
  map.addSource("pmtiles", {
    type: "vector",
    url: `pmtiles://${key}`,
  });
}
