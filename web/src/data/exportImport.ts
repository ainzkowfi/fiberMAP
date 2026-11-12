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
}

const emptyCounts = (): ImportCounts => ({
  new: 0,
  updated: 0,
  skipped: 0,
  deleted: 0,
});

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

  const plan: BundleImportPlan = {
    preview: {
      lines: emptyCounts(),
      pins: emptyCounts(),
      events: emptyCounts(),
      repairLogs: emptyCounts(),
      placeLabels: emptyCounts(),
      totals: emptyCounts(),
    },
    lines: [],
    pins: [],
    pinEvents: [],
    repairLogs: [],
    placeLabels: [],
  };

  const [localLines, localPins, localEvents, localLogs, localLabels] = await Promise.all([
    db.lines.bulkGet(bundle.lines.map((l) => l.id)),
    db.pins.bulkGet(bundle.pins.map((p) => p.id)),
    db.pinEvents.bulkGet(bundle.events.map((e) => e.id)),
    db.repairLogs.bulkGet(bundle.repairLogs.map((r) => r.id)),
    db.placeLabels.bulkGet(bundle.placeLabels.map((l) => l.id)),
  ]);

  bundle.lines.forEach((incoming, index) => {
    const local = localLines[index];
    const counts = plan.preview.lines;
    if (!local) {
      counts.new++;
      plan.lines.push(toLineRow(incoming));
      return;
    }
    if (incoming.updatedAt > local.updatedAt) {
      if (incoming.deletedAt !== null) counts.deleted++;
      else counts.updated++;
      plan.lines.push(toLineRow(incoming));
    } else {
      counts.skipped++;
    }
  });

  bundle.pins.forEach((incoming, index) => {
    const local = localPins[index];
    const counts = plan.preview.pins;
    if (!local) {
      counts.new++;
      plan.pins.push(toPinRow(incoming));
      return;
    }
    if (incoming.updatedAt > local.updatedAt) {
      if (incoming.deletedAt !== null) counts.deleted++;
      else counts.updated++;
      plan.pins.push(toPinRow(incoming));
    } else {
      counts.skipped++;
    }
  });

  bundle.events.forEach((incoming, index) => {
    const local = localEvents[index];
    const counts = plan.preview.events;
    if (!local) {
      counts.new++;
      plan.pinEvents.push(toEventRow(incoming));
      return;
    }
    if (incoming.updatedAt > local.updatedAt) {
      if (incoming.deletedAt !== null) counts.deleted++;
      else counts.updated++;
      plan.pinEvents.push(toEventRow(incoming));
    } else {
      counts.skipped++;
    }
  });

  bundle.repairLogs.forEach((incoming, index) => {
    const local = localLogs[index];
    const counts = plan.preview.repairLogs;
    if (!local) {
      counts.new++;
      plan.repairLogs.push(toRepairLogRow(incoming));
      return;
    }
    if (incoming.updatedAt > local.updatedAt) {
      if (incoming.deletedAt !== null) counts.deleted++;
      else counts.updated++;
      plan.repairLogs.push(toRepairLogRow(incoming));
    } else {
      counts.skipped++;
    }
  });

  bundle.placeLabels.forEach((incoming, index) => {
    const local = localLabels[index];
    const counts = plan.preview.placeLabels;
    if (!local) {
      counts.new++;
      plan.placeLabels.push(toPlaceLabelRow(incoming));
      return;
    }
    if (incoming.updatedAt > local.updatedAt) {
      if (incoming.deletedAt !== null) counts.deleted++;
      else counts.updated++;
      plan.placeLabels.push(toPlaceLabelRow(incoming));
    } else {
      counts.skipped++;
    }
  });

  for (const table of [
    plan.preview.lines,
    plan.preview.pins,
    plan.preview.events,
    plan.preview.repairLogs,
    plan.preview.placeLabels,
  ]) {
    plan.preview.totals.new += table.new;
    plan.preview.totals.updated += table.updated;
    plan.preview.totals.skipped += table.skipped;
    plan.preview.totals.deleted += table.deleted;
  }

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
