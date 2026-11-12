import type { FiberLine, FiberPin } from "../domain/models";
import { PIN_TYPE_INFO } from "../domain/models";
import { decodeGeometryFromBlob, encodeGeometryToBlob } from "../core/geometry";
import {
  db,
  type LineRow,
  type PinEventRow,
  type PinRow,
  type PlaceLabelRow,
  type RepairLogRow,
} from "./db";

/**
 * Version 2 adds `deletedAt` to every row, so a bundle carries the tombstones
 * of what was deleted. Version 1 is still read: its rows have no `deletedAt`
 * and must never delete anything.
 */
export const BUNDLE_VERSION = 2;

export interface FmapBundle {
  format: "fiberMAP-bundle";
  version: 1 | 2;
  exportedAt: number;
  lines: BundleLine[];
  pins: BundlePin[];
  events: BundleEvent[];
  repairLogs?: BundleRepairLog[];
  placeLabels?: BundlePlaceLabel[];
}

/** A name the crew put on the map. Additive: older readers ignore it. */
export interface BundlePlaceLabel {
  id: string;
  name: string;
  lat: number;
  lon: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

/**
 * Bundle line shape. The first block matches the Android exporter byte-for-byte so
 * bundles exported by the APK import cleanly here; the tail block is additive
 * (older readers ignore unknown keys).
 */
export interface BundleLine {
  id: string;
  name: string;
  colorKey: string;
  status: string;
  fiberType: string;
  coreCount: number;
  notes: string;
  lengthMapM: number;
  slackPercent: number;
  vertices: Array<[number, number]>;
  measuredLengthM?: number | null;
  parentLineId?: string | null;
  branchChainageM?: number | null;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface BundlePin {
  id: string;
  lineId: string;
  type: string;
  lat: number;
  lon: number;
  chainageM: number;
  label: string;
  notes: string;
  state: string;
  coilLengthM: number;
  createdAt: number;
  snapLat?: number;
  snapLon?: number;
  gpsAccuracyM?: number | null;
  /** The splice loss in dB. The key keeps the old dBm spelling on purpose. */
  spliceLossDbm?: number | null;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface BundleEvent {
  id: string;
  pinId: string;
  kind: string;
  eventDate: number;
  repairMethod: string;
  note: string;
  spliceLossDbm?: number | null;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface BundleRepairLog {
  id: string;
  lineId: string;
  pinId: string;
  spliceLossDbm: number;
  fiberCutLocation: string;
  cutLat: number;
  cutLon: number;
  chainageM: number;
  repairTimestamp: number;
  technicianName: string;
  repairMethod: string;
  closureTag: string;
  notes: string;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

// --- Export ---

/**
 * Six decimals is about eleven centimetres. More than that is the noise the
 * GPS adds, and a bundle full of it is a bundle full of nothing.
 */
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Builds a bundle from the stored rows, tombstones included.
 *
 * The rows come straight out of the database rather than from the live
 * queries, because the live queries leave out the deleted rows and a bundle
 * that forgets a deletion cannot carry it to the next phone.
 */
export async function exportFmapBundle(): Promise<string> {
  const [lines, pins, events, repairLogs, placeLabels] = await Promise.all([
    db.lines.toArray(),
    db.pins.toArray(),
    db.pinEvents.toArray(),
    db.repairLogs.toArray(),
    db.placeLabels.toArray(),
  ]);
  return buildBundleJson({ lines, pins, events, repairLogs, placeLabels }, Date.now());
}

export function buildBundleJson(
  rows: {
    lines: LineRow[];
    pins: PinRow[];
    events: PinEventRow[];
    repairLogs: RepairLogRow[];
    placeLabels: PlaceLabelRow[];
  },
  exportedAt: number,
): string {
  const bundle: FmapBundle = {
    format: "fiberMAP-bundle",
    version: BUNDLE_VERSION,
    exportedAt,
    lines: rows.lines.map((line) => ({
      id: line.id,
      name: line.name,
      colorKey: line.colorKey,
      status: line.status,
      fiberType: line.fiberType,
      coreCount: line.coreCount ?? 24,
      notes: line.notes,
      lengthMapM: line.lengthMapM,
      slackPercent: line.slackPercent,
      vertices: decodeGeometryFromBlob(line.geometry).map(
        (v) => [round6(v.lat), round6(v.lon)] as [number, number],
      ),
      measuredLengthM: line.measuredLengthM,
      parentLineId: line.parentLineId,
      branchChainageM: line.branchChainageM,
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
      deletedAt: line.deletedAt,
    })),
    pins: rows.pins.map((pin) => ({
      id: pin.id,
      lineId: pin.lineId ?? "",
      type: pin.type,
      lat: round6(pin.lat),
      lon: round6(pin.lon),
      chainageM: pin.chainageM ?? -1,
      label: pin.label,
      notes: pin.notes,
      state: pin.state,
      coilLengthM: pin.coilLengthM,
      createdAt: pin.createdAt,
      snapLat: pin.snapLat,
      snapLon: pin.snapLon,
      gpsAccuracyM: pin.gpsAccuracyM,
      spliceLossDbm: pin.spliceLossDbm,
      updatedAt: pin.updatedAt,
      deletedAt: pin.deletedAt,
    })),
    events: rows.events.map((ev) => ({
      id: ev.id,
      pinId: ev.pinId,
      kind: ev.kind,
      eventDate: ev.eventDate,
      repairMethod: ev.repairMethod ?? "",
      note: ev.note,
      spliceLossDbm: ev.spliceLossDbm,
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt,
      deletedAt: ev.deletedAt,
    })),
    repairLogs: rows.repairLogs.map((log) => ({
      id: log.id,
      lineId: log.lineId ?? "",
      pinId: log.pinId ?? "",
      spliceLossDbm: log.spliceLossDbm,
      fiberCutLocation: log.fiberCutLocation,
      cutLat: log.cutLat,
      cutLon: log.cutLon,
      chainageM: log.chainageM ?? -1,
      repairTimestamp: log.repairTimestamp,
      technicianName: log.technicianName,
      repairMethod: log.repairMethod,
      closureTag: log.closureTag,
      notes: log.notes,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
      deletedAt: log.deletedAt,
    })),
    placeLabels: rows.placeLabels.map((label) => ({
      id: label.id,
      name: label.name,
      lat: round6(label.lat),
      lon: round6(label.lon),
      createdAt: label.createdAt,
      updatedAt: label.updatedAt,
      deletedAt: label.deletedAt,
    })),
  };
  return JSON.stringify(bundle, null, 2);
}

export function generateGeoJson(lines: FiberLine[], pins: FiberPin[]): string {
  const features: unknown[] = [];

  for (const line of lines) {
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: line.vertices.map((v) => [v.lon, v.lat]),
      },
      properties: {
        id: line.id,
        name: line.name,
        color: line.colorKey,
        status: line.status,
        length_meters: line.lengthMapM,
        core_count: line.coreCount ?? 0,
      },
    });
  }

  for (const pin of pins) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pin.lon, pin.lat] },
      properties: {
        id: pin.id,
        type: pin.type,
        label: pin.label,
        state: pin.state,
        chainage_m: pin.chainageM ?? 0,
        coil_length_m: pin.coilLengthM,
      },
    });
  }

  return JSON.stringify(
    { type: "FeatureCollection", features },
    null,
    2,
  );
}

export function generateCsv(pins: FiberPin[]): string {
  const header =
    "ID,Type,State,Chainage_m,Latitude,Longitude,Label,CoilLength_m,Notes,Created_Date";
  const rows = pins.map((pin) => {
    const date = new Date(pin.createdAt).toISOString().replace("T", " ").slice(0, 19);
    const clean = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      clean(pin.id),
      clean(PIN_TYPE_INFO[pin.type].title),
      clean(pin.state),
      String(pin.chainageM !== null ? Math.trunc(pin.chainageM) : 0),
      String(pin.lat),
      String(pin.lon),
      clean(pin.label),
      String(pin.coilLengthM),
      clean(pin.notes),
      clean(date),
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function generateKml(lines: FiberLine[], pins: FiberPin[]): string {
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    "<Document>",
    "<name>fiberMAP Agusan del Sur Export</name>",
  ];

  for (const line of lines) {
    out.push(
      "  <Placemark>",
      `    <name>${escapeXml(line.name)}</name>`,
      `    <description>Status: ${line.status}, Length: ${Math.trunc(line.lengthMapM)}m</description>`,
      "    <LineString>",
      "      <coordinates>",
      `        ${line.vertices.map((v) => `${v.lon},${v.lat},0`).join(" ")}`,
      "      </coordinates>",
      "    </LineString>",
      "  </Placemark>",
    );
  }

  for (const pin of pins) {
    out.push(
      "  <Placemark>",
      `    <name>${escapeXml(pin.label)}</name>`,
      `    <description>Type: ${PIN_TYPE_INFO[pin.type].title}, State: ${pin.state}</description>`,
      "    <Point>",
      `      <coordinates>${pin.lon},${pin.lat},0</coordinates>`,
      "    </Point>",
      "  </Placemark>",
    );
  }

  out.push("</Document>", "</kml>");
  return out.join("\n");
}

// --- Import ---

export interface ImportResult {
  lines: number;
  pins: number;
  events: number;
  repairLogs: number;
  placeLabels: number;
}

/** What an import would do to each kind of row. */
export interface ImportCounts {
  /** Not on this device yet. */
  new: number;
  /** Newer than the local row, so it replaces it. */
  updated: number;
  /** The local row is newer or the same, so it stays as it is. */
  skipped: number;
  /** Newer than the local row and marked deleted, so it becomes a tombstone. */
  deleted: number;
  /** A parent brought back because a child under it is newer than the deletion. */
  restored: number;
  /** A child taken down because the parent under it is deleted. */
  orphaned: number;
}

export interface ImportPreview {
  lines: ImportCounts;
  pins: ImportCounts;
  events: ImportCounts;
  repairLogs: ImportCounts;
  placeLabels: ImportCounts;
  totals: ImportCounts;
}

/**
 * A bundle that cannot be trusted is refused before a single row is written.
 * The message names the first field that is wrong, because a tech staring at
 * a rejected file needs to know where to look.
 */
export class BundleError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "BundleError";
  }
}

const CAPS = {
  jsonBytes: 64 * 1024 * 1024,
  lines: 50_000,
  pins: 200_000,
  events: 500_000,
  repairLogs: 200_000,
  placeLabels: 100_000,
  verticesPerLine: 200_000,
  text: 8_000,
  id: 200,
};

function fail(field: string, message: string): never {
  throw new BundleError(field, `${field}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function needObject(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) fail(field, "expected an object");
  return value;
}

function needArray(value: unknown, field: string, cap: number): unknown[] {
  if (!Array.isArray(value)) fail(field, "expected an array");
  if (value.length > cap) {
    fail(field, `has ${value.length} rows, the limit is ${cap}`);
  }
  return value;
}

function needString(
  row: Record<string, unknown>,
  key: string,
  field: string,
  max = CAPS.text,
): string {
  const value = row[key];
  if (typeof value !== "string") fail(`${field}.${key}`, "expected a string");
  if (value.length > max) {
    fail(`${field}.${key}`, `is ${value.length} characters, the limit is ${max}`);
  }
  return value;
}

function optionalString(
  row: Record<string, unknown>,
  key: string,
  field: string,
  max = CAPS.text,
): string | null {
  const value = row[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") fail(`${field}.${key}`, "expected a string");
  if (value.length > max) {
    fail(`${field}.${key}`, `is ${value.length} characters, the limit is ${max}`);
  }
  return value;
}

function needNumber(row: Record<string, unknown>, key: string, field: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${field}.${key}`, "expected a finite number");
  }
  return value;
}

function optionalNumber(
  row: Record<string, unknown>,
  key: string,
  field: string,
): number | null {
  const value = row[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${field}.${key}`, "expected a finite number");
  }
  return value;
}

function needTimestamp(
  row: Record<string, unknown>,
  key: string,
  field: string,
): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${field}.${key}`, "expected a timestamp in milliseconds");
  }
  return Math.trunc(value);
}

function optionalTimestamp(
  row: Record<string, unknown>,
  key: string,
  field: string,
): number | null {
  const value = row[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${field}.${key}`, "expected a timestamp in milliseconds");
  }
  return Math.trunc(value);
}

function needLatitude(row: Record<string, unknown>, key: string, field: string): number {
  const value = needNumber(row, key, field);
  if (value < -90 || value > 90) {
    fail(`${field}.${key}`, `${value} is outside -90 to 90`);
  }
  return value;
}

function needLongitude(row: Record<string, unknown>, key: string, field: string): number {
  const value = needNumber(row, key, field);
  if (value < -180 || value > 180) {
    fail(`${field}.${key}`, `${value} is outside -180 to 180`);
  }
  return value;
}

function needId(row: Record<string, unknown>, field: string): string {
  const id = needString(row, "id", field, CAPS.id);
  if (id.trim() === "") fail(`${field}.id`, "must not be empty");
  return id;
}

interface IncomingLine {
  id: string;
  name: string;
  colorKey: string;
  status: string;
  fiberType: string;
  coreCount: number;
  notes: string;
  vertices: Array<[number, number]>;
  lengthMapM: number;
  slackPercent: number;
  measuredLengthM: number | null;
  parentLineId: string | null;
  branchChainageM: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface IncomingPin {
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

interface IncomingEvent {
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

interface IncomingRepairLog {
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

interface IncomingPlaceLabel {
  id: string;
  name: string;
  lat: number;
  lon: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface IncomingBundle {
  version: 1 | 2;
  lines: IncomingLine[];
  pins: IncomingPin[];
  events: IncomingEvent[];
  repairLogs: IncomingRepairLog[];
  placeLabels: IncomingPlaceLabel[];
}

/**
 * Reads a bundle and refuses anything that is not shaped like one.
 *
 * The checks are deliberately literal: every number has to be finite, every
 * coordinate has to be on the globe, every row has to have an id. A bundle
 * that fails one of these is not a bundle, and half of it being applied would
 * be worse than none of it.
 */
export function validateBundle(json: string): IncomingBundle {
  if (json.length > CAPS.jsonBytes) {
    fail("bundle", `is ${(json.length / 1_048_576).toFixed(1)} MB, the limit is ${
      CAPS.jsonBytes / 1_048_576
    } MB`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    fail("bundle", `is not valid JSON (${(err as Error).message})`);
  }

  const root = needObject(parsed, "bundle");
  if (root.format !== "fiberMAP-bundle") {
    fail("bundle.format", "is not a fiberMAP bundle");
  }

  const rawVersion = root.version === undefined ? 1 : root.version;
  if (rawVersion !== 1 && rawVersion !== 2) {
    fail(
      "bundle.version",
      `is ${String(rawVersion)}, this app reads version 1 and ${BUNDLE_VERSION}`,
    );
  }
  const version = rawVersion as 1 | 2;

  const lineRows = needArray(root.lines ?? [], "lines", CAPS.lines);
  const pinRows = needArray(root.pins ?? [], "pins", CAPS.pins);
  const eventRows = needArray(root.events ?? [], "events", CAPS.events);
  const logRows = needArray(root.repairLogs ?? [], "repairLogs", CAPS.repairLogs);
  const labelRows = needArray(root.placeLabels ?? [], "placeLabels", CAPS.placeLabels);

  const lines: IncomingLine[] = lineRows.map((raw, index) => {
    const field = `lines[${index}]`;
    const row = needObject(raw, field);
    const id = needId(row, field);
    const verticesRaw = needArray(
      row.vertices ?? [],
      `${field}.vertices`,
      CAPS.verticesPerLine,
    );
    const vertices = verticesRaw.map((v, vi) => {
      const pair = needArray(v, `${field}.vertices[${vi}]`, 2);
      if (pair.length !== 2) {
        fail(`${field}.vertices[${vi}]`, "expected a latitude and a longitude");
      }
      const lat = needLatitude(
        { lat: pair[0] },
        "lat",
        `${field}.vertices[${vi}]`,
      );
      const lon = needLongitude(
        { lon: pair[1] },
        "lon",
        `${field}.vertices[${vi}]`,
      );
      return [lat, lon] as [number, number];
    });
    const createdAt = optionalTimestamp(row, "createdAt", field) ?? 0;
    const updatedAt = optionalTimestamp(row, "updatedAt", field) ?? createdAt;
    return {
      id,
      name: needString(row, "name", field),
      colorKey: optionalString(row, "colorKey", field) ?? "blue",
      status: (optionalString(row, "status", field) ?? "ACTIVE").toLowerCase(),
      fiberType: optionalString(row, "fiberType", field) ?? "G.652D Single Mode",
      coreCount: needNumber(row, "coreCount", field),
      notes: optionalString(row, "notes", field) ?? "",
      vertices,
      lengthMapM: needNumber(row, "lengthMapM", field),
      slackPercent: needNumber(row, "slackPercent", field),
      measuredLengthM: optionalNumber(row, "measuredLengthM", field),
      parentLineId: optionalString(row, "parentLineId", field),
      branchChainageM: optionalNumber(row, "branchChainageM", field),
      createdAt,
      updatedAt,
      deletedAt: optionalTimestamp(row, "deletedAt", field),
    };
  });

  const pins: IncomingPin[] = pinRows.map((raw, index) => {
    const field = `pins[${index}]`;
    const row = needObject(raw, field);
    const id = needId(row, field);
    const createdAt = optionalTimestamp(row, "createdAt", field) ?? 0;
    const updatedAt = optionalTimestamp(row, "updatedAt", field) ?? createdAt;
    const chainage = optionalNumber(row, "chainageM", field);
    return {
      id,
      lineId: optionalString(row, "lineId", field) || null,
      type: (optionalString(row, "type", field) ?? "CUT_REPAIR").toLowerCase(),
      lat: needLatitude(row, "lat", field),
      lon: needLongitude(row, "lon", field),
      snapLat: optionalNumber(row, "snapLat", field) ?? needLatitude(row, "lat", field),
      snapLon: optionalNumber(row, "snapLon", field) ?? needLongitude(row, "lon", field),
      chainageM: chainage !== null && chainage >= 0 ? chainage : null,
      gpsAccuracyM: optionalNumber(row, "gpsAccuracyM", field),
      label: optionalString(row, "label", field) ?? "",
      notes: optionalString(row, "notes", field) ?? "",
      state: (optionalString(row, "state", field) ?? "NONE").toLowerCase(),
      spliceLossDbm: optionalNumber(row, "spliceLossDbm", field),
      coilLengthM: needNumber(row, "coilLengthM", field),
      createdAt,
      updatedAt,
      deletedAt: optionalTimestamp(row, "deletedAt", field),
    };
  });

  const events: IncomingEvent[] = eventRows.map((raw, index) => {
    const field = `events[${index}]`;
    const row = needObject(raw, field);
    const id = needId(row, field);
    const eventDate = needTimestamp(row, "eventDate", field);
    const createdAt = optionalTimestamp(row, "createdAt", field) ?? eventDate;
    const updatedAt = optionalTimestamp(row, "updatedAt", field) ?? eventDate;
    return {
      id,
      pinId: needString(row, "pinId", field),
      kind: needString(row, "kind", field),
      eventDate,
      repairMethod: optionalString(row, "repairMethod", field),
      spliceLossDbm: optionalNumber(row, "spliceLossDbm", field),
      note: optionalString(row, "note", field) ?? "",
      createdAt,
      updatedAt,
      deletedAt: optionalTimestamp(row, "deletedAt", field),
    };
  });

  const repairLogs: IncomingRepairLog[] = logRows.map((raw, index) => {
    const field = `repairLogs[${index}]`;
    const row = needObject(raw, field);
    const id = needId(row, field);
    const repairTimestamp = needTimestamp(row, "repairTimestamp", field);
    const createdAt = optionalTimestamp(row, "createdAt", field) ?? repairTimestamp;
    const updatedAt = optionalTimestamp(row, "updatedAt", field) ?? repairTimestamp;
    const chainage = optionalNumber(row, "chainageM", field);
    return {
      id,
      lineId: optionalString(row, "lineId", field) || null,
      pinId: optionalString(row, "pinId", field) || null,
      spliceLossDbm: needNumber(row, "spliceLossDbm", field),
      fiberCutLocation: optionalString(row, "fiberCutLocation", field) ?? "",
      cutLat: needLatitude(row, "cutLat", field),
      cutLon: needLongitude(row, "cutLon", field),
      chainageM: chainage !== null && chainage >= 0 ? chainage : null,
      repairTimestamp,
      technicianName: optionalString(row, "technicianName", field) ?? "",
      repairMethod: (optionalString(row, "repairMethod", field) ?? "FUSION").toLowerCase(),
      closureTag: optionalString(row, "closureTag", field) ?? "",
      notes: optionalString(row, "notes", field) ?? "",
      createdAt,
      updatedAt,
      deletedAt: optionalTimestamp(row, "deletedAt", field),
    };
  });

  const placeLabels: IncomingPlaceLabel[] = labelRows.map((raw, index) => {
    const field = `placeLabels[${index}]`;
    const row = needObject(raw, field);
    const id = needId(row, field);
    const createdAt = optionalTimestamp(row, "createdAt", field) ?? 0;
    const updatedAt = optionalTimestamp(row, "updatedAt", field) ?? createdAt;
    return {
      id,
      name: needString(row, "name", field),
      lat: needLatitude(row, "lat", field),
      lon: needLongitude(row, "lon", field),
      createdAt,
      updatedAt,
      deletedAt: optionalTimestamp(row, "deletedAt", field),
    };
  });

  return { version, lines, pins, events, repairLogs, placeLabels };
}

export interface BundleImportPlan {
  preview: ImportPreview;
  lines: LineRow[];
  pins: PinRow[];
  pinEvents: PinEventRow[];
  repairLogs: RepairLogRow[];
  placeLabels: PlaceLabelRow[];
  /** The bundle this plan came from, so the write can be re-planned. */
  json: string;
}

const emptyCounts = (): ImportCounts => ({
  new: 0,
  updated: 0,
  skipped: 0,
  deleted: 0,
  restored: 0,
  orphaned: 0,
});

interface MergedRow {
  id: string;
  updatedAt: number;
  deletedAt: number | null;
}

/**
 * Picks the rows that win. The merge is by time, not by arrival: a row wins
 * only if it is strictly newer than the row already on the phone, so a bundle
 * that is a week old cannot roll back a week of work. A record that was
 * deleted here stays deleted unless the incoming row is newer than the
 * deletion.
 */
function mergeRows<T extends MergedRow>(
  incoming: T[],
  local: T[],
  counts: ImportCounts,
): T[] {
  const existing = new Map(local.map((row) => [row.id, row]));
  const winners: T[] = [];
  for (const row of incoming) {
    const current = existing.get(row.id);
    if (!current) {
      counts.new++;
      winners.push(row);
      continue;
    }
    if (row.updatedAt > current.updatedAt) {
      if (row.deletedAt !== null) counts.deleted++;
      else counts.updated++;
      winners.push(row);
    } else {
      counts.skipped++;
    }
  }
  return winners;
}

/** The state of every row after the merge: the local row unless the incoming wins. */
function stateAfter<T extends MergedRow>(
  local: T[],
  winners: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of local) map.set(row.id, row);
  for (const row of winners) map.set(row.id, row);
  return map;
}

function upsert<T extends { id: string }>(list: T[], row: T): void {
  const at = list.findIndex((r) => r.id === row.id);
  if (at >= 0) list[at] = row;
  else list.push(row);
}

/**
 * A child cannot stay live under a deleted parent.
 *
 * If the child is newer than the parent's deletion, the parent comes back,
 * because the crew clearly worked on that child after the parent was deleted.
 * Otherwise the child goes with the parent.
 */
function reconcile<T extends MergedRow, P extends MergedRow>(
  children: T[],
  resolveParent: (child: T) => P | null | undefined,
  onChildWrite: (child: T) => void,
  onParentRestore: (parent: P) => void,
  childCounts: ImportCounts,
  parentCounts: ImportCounts,
  now: number,
): void {
  for (const child of children) {
    if (child.deletedAt !== null) continue;
    const parent = resolveParent(child);
    if (!parent || parent.deletedAt === null) continue;
    if (child.updatedAt > parent.deletedAt) {
      parent.deletedAt = null;
      parent.updatedAt = child.updatedAt;
      onParentRestore(parent);
      parentCounts.restored++;
    } else {
      child.deletedAt = now;
      child.updatedAt = now;
      onChildWrite(child);
      childCounts.orphaned++;
    }
  }
}

/**
 * Works out what an import would do, without doing it.
 *
 * The merge is by time, not by arrival. A row wins only if it is strictly
 * newer than the row already on the phone, so a bundle that is a week old
 * cannot roll back a week of work. A record that was deleted here stays
 * deleted unless the incoming row is newer than the deletion.
 */
export async function planBundleImport(json: string): Promise<BundleImportPlan> {
  const bundle = validateBundle(json);
  const now = Date.now();

  const counts = {
    lines: emptyCounts(),
    pins: emptyCounts(),
    events: emptyCounts(),
    repairLogs: emptyCounts(),
    placeLabels: emptyCounts(),
    totals: emptyCounts(),
  };

  const incoming = {
    lines: bundle.lines.map(toLineRow),
    pins: bundle.pins.map(toPinRow),
    events: bundle.events.map(toEventRow),
    repairLogs: bundle.repairLogs.map(toRepairLogRow),
    placeLabels: bundle.placeLabels.map(toPlaceLabelRow),
  };

  const local = {
    lines: await db.lines.toArray(),
    pins: await db.pins.toArray(),
    events: await db.pinEvents.toArray(),
    repairLogs: await db.repairLogs.toArray(),
    placeLabels: await db.placeLabels.toArray(),
  };

  const winners = {
    lines: mergeRows(incoming.lines, local.lines, counts.lines),
    pins: mergeRows(incoming.pins, local.pins, counts.pins),
    events: mergeRows(incoming.events, local.events, counts.events),
    repairLogs: mergeRows(incoming.repairLogs, local.repairLogs, counts.repairLogs),
    placeLabels: mergeRows(
      incoming.placeLabels,
      local.placeLabels,
      counts.placeLabels,
    ),
  };

  const state = {
    lines: stateAfter(local.lines, winners.lines),
    pins: stateAfter(local.pins, winners.pins),
    events: stateAfter(local.events, winners.events),
    repairLogs: stateAfter(local.repairLogs, winners.repairLogs),
  };

  const plan: BundleImportPlan = {
    preview: { ...counts },
    lines: [...winners.lines],
    pins: [...winners.pins],
    pinEvents: [...winners.events],
    repairLogs: [...winners.repairLogs],
    placeLabels: [...winners.placeLabels],
    json,
  };

  // A pin under a deleted line.
  reconcile(
    [...state.pins.values()],
    (pin) => (pin.lineId ? state.lines.get(pin.lineId) : null),
    (gone) => upsert(plan.pins, gone),
    (restored) => upsert(plan.lines, restored),
    counts.pins,
    counts.lines,
    now,
  );

  // An event under a deleted pin.
  reconcile(
    [...state.events.values()],
    (event) => state.pins.get(event.pinId),
    (gone) => upsert(plan.pinEvents, gone),
    (restored) => upsert(plan.pins, restored),
    counts.events,
    counts.pins,
    now,
  );

  // A repair log under a deleted pin, or under a deleted line when it has no pin.
  const logs = [...state.repairLogs.values()];
  reconcile(
    logs.filter((log) => log.pinId !== null),
    (log) => (log.pinId ? state.pins.get(log.pinId) : null),
    (gone) => upsert(plan.repairLogs, gone),
    (restored) => upsert(plan.pins, restored),
    counts.repairLogs,
    counts.pins,
    now,
  );
  reconcile(
    logs.filter((log) => log.pinId === null && log.lineId !== null),
    (log) => (log.lineId ? state.lines.get(log.lineId) : null),
    (gone) => upsert(plan.repairLogs, gone),
    (restored) => upsert(plan.lines, restored),
    counts.repairLogs,
    counts.lines,
    now,
  );

  for (const table of [
    counts.lines,
    counts.pins,
    counts.events,
    counts.repairLogs,
    counts.placeLabels,
  ]) {
    counts.totals.new += table.new;
    counts.totals.updated += table.updated;
    counts.totals.skipped += table.skipped;
    counts.totals.deleted += table.deleted;
    counts.totals.restored += table.restored;
    counts.totals.orphaned += table.orphaned;
  }
  plan.preview = { ...counts };

  return plan;
}

/** Writes a plan. Everything lands in one transaction or nothing does. */
export async function applyBundleImport(plan: BundleImportPlan): Promise<ImportResult> {
  await db.transaction(
    "rw",
    db.lines,
    db.pins,
    db.pinEvents,
    db.repairLogs,
    db.placeLabels,
    async () => {
      if (plan.lines.length) await db.lines.bulkPut(plan.lines);
      if (plan.pins.length) await db.pins.bulkPut(plan.pins);
      if (plan.pinEvents.length) await db.pinEvents.bulkPut(plan.pinEvents);
      if (plan.repairLogs.length) await db.repairLogs.bulkPut(plan.repairLogs);
      if (plan.placeLabels.length) await db.placeLabels.bulkPut(plan.placeLabels);
    },
  );

  return {
    lines: plan.lines.length,
    pins: plan.pins.length,
    events: plan.pinEvents.length,
    repairLogs: plan.repairLogs.length,
    placeLabels: plan.placeLabels.length,
  };
}

/** Plans and writes in one go. The app uses the two steps so it can show a preview. */
export async function importFmapBundle(json: string): Promise<ImportResult> {
  const plan = await planBundleImport(json);
  return applyBundleImport(plan);
}

function toLineRow(incoming: IncomingLine): LineRow {
  return {
    id: incoming.id,
    name: incoming.name,
    colorKey: incoming.colorKey,
    status: incoming.status,
    fiberType: incoming.fiberType,
    coreCount: incoming.coreCount,
    notes: incoming.notes,
    geometry: encodeVertices(incoming.vertices),
    lengthMapM: incoming.lengthMapM,
    slackPercent: incoming.slackPercent,
    measuredLengthM: incoming.measuredLengthM,
    parentLineId: incoming.parentLineId,
    branchChainageM: incoming.branchChainageM,
    createdAt: incoming.createdAt,
    updatedAt: incoming.updatedAt,
    deletedAt: incoming.deletedAt,
  };
}

function toPinRow(incoming: IncomingPin): PinRow {
  return {
    id: incoming.id,
    lineId: incoming.lineId,
    type: incoming.type,
    lat: incoming.lat,
    lon: incoming.lon,
    snapLat: incoming.snapLat,
    snapLon: incoming.snapLon,
    chainageM: incoming.chainageM,
    gpsAccuracyM: incoming.gpsAccuracyM,
    label: incoming.label,
    notes: incoming.notes,
    state: incoming.state,
    spliceLossDbm: incoming.spliceLossDbm,
    coilLengthM: incoming.coilLengthM,
    createdAt: incoming.createdAt,
    updatedAt: incoming.updatedAt,
    deletedAt: incoming.deletedAt,
  };
}

function toEventRow(incoming: IncomingEvent): PinEventRow {
  return {
    id: incoming.id,
    pinId: incoming.pinId,
    kind: incoming.kind,
    eventDate: incoming.eventDate,
    repairMethod: incoming.repairMethod,
    spliceLossDbm: incoming.spliceLossDbm,
    note: incoming.note,
    createdAt: incoming.createdAt,
    updatedAt: incoming.updatedAt,
    deletedAt: incoming.deletedAt,
  };
}

function toRepairLogRow(incoming: IncomingRepairLog): RepairLogRow {
  return {
    id: incoming.id,
    lineId: incoming.lineId,
    pinId: incoming.pinId,
    spliceLossDbm: incoming.spliceLossDbm,
    fiberCutLocation: incoming.fiberCutLocation,
    cutLat: incoming.cutLat,
    cutLon: incoming.cutLon,
    chainageM: incoming.chainageM,
    repairTimestamp: incoming.repairTimestamp,
    technicianName: incoming.technicianName,
    repairMethod: incoming.repairMethod,
    closureTag: incoming.closureTag,
    notes: incoming.notes,
    createdAt: incoming.createdAt,
    updatedAt: incoming.updatedAt,
    deletedAt: incoming.deletedAt,
  };
}

function toPlaceLabelRow(incoming: IncomingPlaceLabel): PlaceLabelRow {
  return {
    id: incoming.id,
    name: incoming.name,
    lat: incoming.lat,
    lon: incoming.lon,
    createdAt: incoming.createdAt,
    updatedAt: incoming.updatedAt,
    deletedAt: incoming.deletedAt,
  };
}

const encodeVertices = (vertices: Array<[number, number]>) =>
  encodeGeometryToBlob(vertices.map(([lat, lon]) => ({ lat, lon })));
