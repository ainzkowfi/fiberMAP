import Dexie, { type Table } from "dexie";

export interface LineRow {
  id: string;
  name: string;
  colorKey: string;
  status: string;
  fiberType: string;
  coreCount: number | null;
  notes: string;
  geometry: Uint8Array;
  lengthMapM: number;
  slackPercent: number;
  measuredLengthM: number | null;
  parentLineId: string | null;
  branchChainageM: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface PinRow {
  id: string;
  lineId: string | null;
  type: string;
  lat: number;
  lon: number;
  snapLat: number;
  snapLon: number;
  chainageM: number | null;
  gpsAccuracyM: number | null;
  label: string;
  notes: string;
  state: string;
  spliceLossDbm: number | null;
  coilLengthM: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface PinEventRow {
  id: string;
  pinId: string;
  kind: string;
  eventDate: number;
  repairMethod: string | null;
  spliceLossDbm: number | null;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface RepairLogRow {
  id: string;
  lineId: string | null;
  pinId: string | null;
  spliceLossDbm: number;
  fiberCutLocation: string;
  cutLat: number;
  cutLon: number;
  chainageM: number | null;
  repairTimestamp: number;
  technicianName: string;
  repairMethod: string;
  closureTag: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface MapFileRow {
  id: string;
  displayName: string;
  path: string;
  sizeBytes: number;
  minZoom: number;
  maxZoom: number;
  bounds: string;
  buildDate: number;
  /** 1 = active, 0 = not. Stored as a number so Dexie can index it. */
  active: number;
}

export interface SettingRow {
  key: string;
  value: string;
}

/** A name the crew put on the map for a place or an area. */
export interface PlaceLabelRow {
  id: string;
  name: string;
  lat: number;
  lon: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

/** Raw .pmtiles archives, stored as Blobs so the OS pages them lazily. */
export interface ArchiveBlobRow {
  id: string;
  blob: Blob;
}

class FiberDatabase extends Dexie {
  lines!: Table<LineRow, string>;
  pins!: Table<PinRow, string>;
  pinEvents!: Table<PinEventRow, string>;
  repairLogs!: Table<RepairLogRow, string>;
  mapFiles!: Table<MapFileRow, string>;
  settings!: Table<SettingRow, string>;
  archiveBlobs!: Table<ArchiveBlobRow, string>;
  placeLabels!: Table<PlaceLabelRow, string>;

  constructor() {
    super("fibermap");
    this.version(1).stores({
      lines: "id, name, status, deletedAt, updatedAt",
      pins: "id, lineId, type, state, deletedAt, chainageM",
      pinEvents: "id, pinId, kind, deletedAt, eventDate",
      repairLogs: "id, lineId, pinId, repairTimestamp, deletedAt",
      mapFiles: "id, active, buildDate",
      settings: "key",
      archiveBlobs: "id",
    });
    // Place names the crew adds themselves. Only the new table is listed here,
    // the rest of the schema is inherited from version 1.
    this.version(2).stores({
      placeLabels: "id, name, deletedAt, createdAt",
    });
  }
}

export const db = new FiberDatabase();

export const DEFAULT_SETTINGS: Record<string, string> = {
  theme: "system",
  handedness: "right",
  units: "chainage",
};

/** Creates the default settings on first run and clears the old basemap seed. */
export async function ensureSeedData(): Promise<void> {
  const settings = await db.settings.toArray();
  if (settings.length === 0) {
    await db.settings.bulkPut(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })),
    );
  }
  // The old seed pointed at a "builtin://" archive that never existed, so the
  // map had no basemap at all until the crew downloaded one by hand. The
  // province archive is installed on first run instead.
  await db.mapFiles.filter((m) => m.path.startsWith("builtin://")).delete();
}
