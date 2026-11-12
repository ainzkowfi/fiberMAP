import type { FiberLine, FiberPin, PinEvent, PlaceLabel, RepairLog } from "../domain/models";
import { PIN_TYPE_INFO } from "../domain/models";
import { encodeGeometryToBlob } from "../core/geometry";
import { db } from "./db";

export interface FmapBundle {
  format: "fiberMAP-bundle";
  version: 1;
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
  spliceLossDbm?: number | null;
  updatedAt?: number;
}

export interface BundleEvent {
  id: string;
  pinId: string;
  kind: string;
  eventDate: number;
  repairMethod: string;
  note: string;
  spliceLossDbm?: number | null;
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
}

export function generateFmapBundleJson(
  lines: FiberLine[],
  pins: FiberPin[],
  events: PinEvent[],
  repairLogs: RepairLog[] = [],
  exportedAt: number = Date.now(),
  placeLabels: PlaceLabel[] = [],
): string {
  const bundle: FmapBundle = {
    format: "fiberMAP-bundle",
    version: 1,
    exportedAt,
    lines: lines.map((line) => ({
      id: line.id,
      name: line.name,
      colorKey: line.colorKey,
      status: line.status,
      fiberType: line.fiberType,
      coreCount: line.coreCount ?? 24,
      notes: line.notes,
      lengthMapM: line.lengthMapM,
      slackPercent: line.slackPercent,
      vertices: line.vertices.map((v) => [v.lat, v.lon] as [number, number]),
      measuredLengthM: line.measuredLengthM,
      parentLineId: line.parentLineId,
      branchChainageM: line.branchChainageM,
      createdAt: line.createdAt,
      updatedAt: line.updatedAt,
    })),
    pins: pins.map((pin) => ({
      id: pin.id,
      lineId: pin.lineId ?? "",
      type: pin.type,
      lat: pin.lat,
      lon: pin.lon,
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
    })),
    events: events.map((ev) => ({
      id: ev.id,
      pinId: ev.pinId,
      kind: ev.kind,
      eventDate: ev.eventDate,
      repairMethod: ev.repairMethod ?? "",
      note: ev.note,
      spliceLossDbm: ev.spliceLossDbm,
    })),
    repairLogs: repairLogs.map((log) => ({
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
    })),
    placeLabels: placeLabels.map((label) => ({
      id: label.id,
      name: label.name,
      lat: label.lat,
      lon: label.lon,
      createdAt: label.createdAt,
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

const upper = (v: string | undefined, fallback: string) =>
  (v ?? fallback).toUpperCase();

/**
 * Merges a fiberMAP bundle into the local database. Existing rows with the same
 * id are overwritten; ids not present in the bundle are kept.
 */
export async function importFmapBundle(json: string): Promise<ImportResult> {
  const parsed = JSON.parse(json) as Partial<FmapBundle>;
  if (parsed.format !== "fiberMAP-bundle") {
    throw new Error("Not a fiberMAP bundle (missing format marker)");
  }
  const now = Date.now();
  const lines = parsed.lines ?? [];
  const pins = parsed.pins ?? [];
  const events = parsed.events ?? [];
  const repairLogs = parsed.repairLogs ?? [];
  const placeLabels = parsed.placeLabels ?? [];

  await db.transaction(
    "rw",
    db.lines,
    db.pins,
    db.pinEvents,
    db.repairLogs,
    db.placeLabels,
    async () => {
      await db.lines.bulkPut(
        lines.map((l) => ({
          id: l.id,
          name: l.name,
          colorKey: l.colorKey || "blue",
          status: upper(l.status, "ACTIVE").toLowerCase(),
          fiberType: l.fiberType || "G.652D Single Mode",
          coreCount: l.coreCount ?? 24,
          notes: l.notes ?? "",
          geometry: encodeVertices(l.vertices ?? []),
          lengthMapM: l.lengthMapM ?? 0,
          slackPercent: l.slackPercent ?? 3,
          measuredLengthM: l.measuredLengthM ?? null,
          parentLineId: l.parentLineId ?? null,
          branchChainageM: l.branchChainageM ?? null,
          createdAt: l.createdAt ?? now,
          updatedAt: l.updatedAt ?? now,
          deletedAt: null,
        })),
      );

      await db.pins.bulkPut(
        pins.map((p) => ({
          id: p.id,
          lineId: p.lineId || null,
          type: upper(p.type, "CUT_REPAIR").toLowerCase(),
          lat: p.lat,
          lon: p.lon,
          snapLat: p.snapLat ?? p.lat,
          snapLon: p.snapLon ?? p.lon,
          chainageM: p.chainageM !== undefined && p.chainageM >= 0 ? p.chainageM : null,
          gpsAccuracyM: p.gpsAccuracyM ?? null,
          label: p.label ?? "",
          notes: p.notes ?? "",
          state: upper(p.state, "NONE").toLowerCase(),
          spliceLossDbm: p.spliceLossDbm ?? null,
          coilLengthM: p.coilLengthM ?? 0,
          createdAt: p.createdAt ?? now,
          updatedAt: p.updatedAt ?? now,
          deletedAt: null,
        })),
      );

      await db.pinEvents.bulkPut(
        events.map((e) => ({
          id: e.id,
          pinId: e.pinId,
          kind: e.kind,
          eventDate: e.eventDate,
          repairMethod: e.repairMethod ? e.repairMethod.toLowerCase() : null,
          spliceLossDbm: e.spliceLossDbm ?? null,
          note: e.note ?? "",
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })),
      );

      await db.repairLogs.bulkPut(
        repairLogs.map((r) => ({
          id: r.id,
          lineId: r.lineId || null,
          pinId: r.pinId || null,
          spliceLossDbm: r.spliceLossDbm ?? 0,
          fiberCutLocation: r.fiberCutLocation ?? "",
          cutLat: r.cutLat,
          cutLon: r.cutLon,
          chainageM: r.chainageM !== undefined && r.chainageM >= 0 ? r.chainageM : null,
          repairTimestamp: r.repairTimestamp,
          technicianName: r.technicianName ?? "",
          repairMethod: upper(r.repairMethod, "FUSION").toLowerCase(),
          closureTag: r.closureTag ?? "",
          notes: r.notes ?? "",
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })),
      );

      await db.placeLabels.bulkPut(
        placeLabels.map((l) => ({
          id: l.id,
          name: l.name,
          lat: l.lat,
          lon: l.lon,
          createdAt: l.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
        })),
      );
    },
  );

  return {
    lines: lines.length,
    pins: pins.length,
    events: events.length,
    repairLogs: repairLogs.length,
    placeLabels: placeLabels.length,
  };
}

const encodeVertices = (vertices: Array<[number, number]>) =>
  encodeGeometryToBlob(vertices.map(([lat, lon]) => ({ lat, lon })));
