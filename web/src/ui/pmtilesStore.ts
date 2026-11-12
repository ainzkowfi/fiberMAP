import { PMTiles } from "pmtiles";
import type { RangeResponse } from "pmtiles";
import { db } from "../data/db";
import { registerArchive, type ArchiveInfo } from "./pmtilesLoader";
import { readBlobWithProgress, type DownloadProgress } from "../core/download";

export type { DownloadProgress };

/**
 * Reads byte ranges out of an archive stored in IndexedDB.
 *
 * A Blob in IndexedDB supports slice() without loading the whole archive into
 * memory, so the phone only pulls the tile bytes MapLibre actually asks for.
 * That is what keeps a 9 MB archive usable on a low-end handset.
 */
export class IndexedDbSource {
  constructor(
    private readonly blob: Blob,
    private readonly key: string,
  ) {}

  getKey(): string {
    return this.key;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const slice = this.blob.slice(offset, offset + length);
    const data = await slice.arrayBuffer();
    return { data };
  }
}

/**
 * The basemap that ships with the app, covering all of Agusan del Sur.
 *
 * 9.21 MB, z0 to z15, built from OSM with planetiler (see web/basemap).
 * The repo already carried a 2.28 MB Protomaps archive, but it only covers
 * lat 7.94 to 8.20, which is the Davao Gulf strip. San Francisco, Prosperidad
 * and Bayugan are all outside it, so the northern half of the province had no
 * basemap at all. This one is the whole province.
 *
 * It is in the service worker precache, so a crew who installs the app has the
 * whole province offline before they walk to the first pole. It is also copied
 * into IndexedDB on first run, which is what the map reads from.
 */
export const BUNDLED_BASEMAP = {
  id: "bundled-agusan-full",
  displayName: "Agusan del Sur (full province)",
  path: "bundled://agusan-del-sur-full.pmtiles",
  url: "maps/agusan-del-sur-full.pmtiles",
  sizeBytes: 9_662_000,
};

/**
 * Fetches the archive out of the service worker.
 *
 * The archive is in the worker's precache. During the very first install the
 * worker is still downloading it, and a request that reaches the precache
 * route before the file is in the cache comes back as a network error. Wait
 * for the worker to finish installing, and if the request still fails, ask
 * for the file under a fresh URL so it goes to the network instead.
 */
async function fetchArchive(): Promise<Response> {
  if ("serviceWorker" in navigator) {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(resolve, 20_000)),
    ]);
  }
  const direct = await fetch(BUNDLED_BASEMAP.url).catch(() => null);
  if (direct && direct.ok) return direct;
  const bypass = await fetch(`${BUNDLED_BASEMAP.url}?direct=${Date.now()}`);
  if (!bypass.ok) {
    throw new Error(`Basemap download failed (${bypass.status})`);
  }
  return bypass;
}

/**
 * Copies the bundled basemap into IndexedDB, which is where the map reads it
 * from in byte ranges.
 *
 * The file itself is already on the device in the service worker precache, so
 * this fetch is served locally and does not use the crew's mobile data.
 */
export async function downloadBundledBasemap(
  onProgress?: (progress: DownloadProgress) => void,
): Promise<ArchiveInfo> {
  const response = await fetchArchive();

  const blob = await readBlobWithProgress(response, onProgress);

  await db.archiveBlobs.put({ id: BUNDLED_BASEMAP.id, blob });
  await db.mapFiles.put({
    id: BUNDLED_BASEMAP.id,
    displayName: BUNDLED_BASEMAP.displayName,
    path: BUNDLED_BASEMAP.path,
    sizeBytes: blob.size,
    minZoom: 0,
    maxZoom: 15,
    bounds: "7.5500,124.8500,9.1500,126.4500",
    buildDate: Date.now(),
    active: 1,
  });

  return mountBlob(BUNDLED_BASEMAP.id, blob);
}

/**
 * Imports a .pmtiles file the user picked, stores it in IndexedDB and mounts
 * it on the map. Nothing leaves the device.
 */
export async function importArchive(file: File): Promise<ArchiveInfo> {
  const { readPmTilesHeader, boundsString } = await import("../core/pmtiles");
  const header = readPmTilesHeader(await file.arrayBuffer());

  const id = `archive-${file.name}-${file.size}`;
  await db.archiveBlobs.put({ id, blob: file });
  await db.mapFiles.put({
    id,
    displayName: file.name,
    path: `idb://${file.name}`,
    sizeBytes: file.size,
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    bounds: boundsString(header),
    buildDate: Date.now(),
    active: 1,
  });

  return mountBlob(id, file);
}

/** Mounts an archive blob on the map under a stable key. */
async function mountBlob(id: string, blob: Blob): Promise<ArchiveInfo> {
  // The key becomes part of a `pmtiles://<key>` URL that MapLibre parses, so
  // it must be a plain token with no scheme or slashes.
  const key = `archive-${id.replace(/[^a-zA-Z0-9-]/g, "-")}`;
  const source = new IndexedDbSource(blob, key);
  const archive = new PMTiles(source);
  const header = await archive.getHeader();

  const info: ArchiveInfo = {
    key,
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    minLon: header.minLon,
    minLat: header.minLat,
    maxLon: header.maxLon,
    maxLat: header.maxLat,
    sizeBytes: blob.size,
  };

  registerArchive(key, archive, info);
  return info;
}

/** Mounts an archive previously stored on the device. */
export async function mountStoredArchive(id: string): Promise<ArchiveInfo> {
  const row = await db.archiveBlobs.get(id);
  if (!row) throw new Error("Archive not found in local storage");
  return mountBlob(id, row.blob);
}

/** True when the bundled basemap has already been downloaded to this device. */
export async function isBundledBasemapStored(): Promise<boolean> {
  return (await db.archiveBlobs.get(BUNDLED_BASEMAP.id)) !== undefined;
}

/**
 * Makes sure the map has a basemap and returns the mounted archive.
 *
 * The crew should not have to know that a basemap exists. If an archive is
 * already active it is mounted as it is. If there is none, the province
 * archive is installed and mounted, so the map is whole on first open.
 */
export async function ensureBasemap(
  onProgress?: (progress: DownloadProgress) => void,
): Promise<ArchiveInfo | null> {
  const all = await db.mapFiles.toArray();
  const active = all.find(
    (m) => m.active === 1 && !m.path.startsWith("builtin://"),
  );
  if (active) {
    const row = await db.archiveBlobs.get(active.id);
    if (row) return mountStoredArchive(active.id);
  }

  if (await isBundledBasemapStored()) {
    await db.mapFiles.toCollection().modify({ active: 0 });
    await db.mapFiles.put({
      id: BUNDLED_BASEMAP.id,
      displayName: BUNDLED_BASEMAP.displayName,
      path: BUNDLED_BASEMAP.path,
      sizeBytes: 9_662_000,
      minZoom: 0,
      maxZoom: 15,
      bounds: "7.5500,124.8500,9.1500,126.4500",
      buildDate: Date.now(),
      active: 1,
    });
    return mountStoredArchive(BUNDLED_BASEMAP.id);
  }

  return downloadBundledBasemap(onProgress);
}
