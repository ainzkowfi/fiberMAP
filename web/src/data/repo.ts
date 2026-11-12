import { db, type LineRow, type PinEventRow, type PinRow, type PlaceLabelRow, type RepairLogRow } from "./db";
import {
  computeCumulativeDistances,
  decodeGeometryFromBlob,
  encodeGeometryToBlob,
  formatChainage,
  snapPointToPolyline,
  type GeoPoint,
} from "../core/geometry";
import type {
  FiberLine,
  FiberPin,
  LineStatus,
  PinEvent,
  PinEventKind,
  PinState,
  PinType,
  PlaceLabel,
  RepairLog,
  RepairMethod,
} from "../domain/models";
import { PIN_TYPE_INFO } from "../domain/models";

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * The name a repair log entry carries for a pin. A crew can name their own
 * pins; when they have not, the type and the place stand in.
 */
function pinLogName(
  type: PinType,
  label: string,
  chainage: number | null,
  lat: number,
  lon: number,
): string {
  const own = label.trim();
  if (own) return own;
  const where =
    chainage !== null
      ? formatChainage(chainage)
      : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  return `${PIN_TYPE_INFO[type].title} at ${where}`;
}

// --- Row <-> domain mapping ---

export function lineToDomain(row: LineRow): FiberLine {
  return {
    id: row.id,
    name: row.name,
    colorKey: row.colorKey,
    status: (row.status.toUpperCase() as LineStatus) ?? "ACTIVE",
    fiberType: row.fiberType,
    coreCount: row.coreCount,
    notes: row.notes,
    vertices: decodeGeometryFromBlob(row.geometry),
    lengthMapM: row.lengthMapM,
    slackPercent: row.slackPercent,
    measuredLengthM: row.measuredLengthM,
    parentLineId: row.parentLineId,
    branchChainageM: row.branchChainageM,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function pinToDomain(row: PinRow): FiberPin {
  return {
    id: row.id,
    lineId: row.lineId,
    type: (row.type.toUpperCase() as PinType) ?? "CUT_REPAIR",
    lat: row.lat,
    lon: row.lon,
    snapLat: row.snapLat,
    snapLon: row.snapLon,
    chainageM: row.chainageM,
    gpsAccuracyM: row.gpsAccuracyM,
    label: row.label,
    notes: row.notes,
    state: (row.state.toUpperCase() as PinState) ?? "NONE",
    spliceLossDbm: row.spliceLossDbm,
    coilLengthM: row.coilLengthM,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function eventToDomain(row: PinEventRow): PinEvent {
  return {
    id: row.id,
    pinId: row.pinId,
    kind: row.kind as PinEventKind,
    eventDate: row.eventDate,
    repairMethod: row.repairMethod
      ? (row.repairMethod.toUpperCase() as RepairMethod)
      : null,
    spliceLossDbm: row.spliceLossDbm,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function repairLogToDomain(row: RepairLogRow): RepairLog {  return {
    id: row.id,
    lineId: row.lineId,
    pinId: row.pinId,
    spliceLossDbm: row.spliceLossDbm,
    fiberCutLocation: row.fiberCutLocation,
    cutLat: row.cutLat,
    cutLon: row.cutLon,
    chainageM: row.chainageM,
    repairTimestamp: row.repairTimestamp,
    technicianName: row.technicianName,
    repairMethod: (row.repairMethod.toUpperCase() as RepairMethod) ?? "FUSION",
    closureTag: row.closureTag,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

// --- Place names ---

export function labelToDomain(row: PlaceLabelRow): PlaceLabel {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** Stores a name the crew put on the map for a place or an area. */
export async function savePlaceLabel(label: PlaceLabel): Promise<void> {
  const now = Date.now();
  await db.placeLabels.put({
    id: label.id,
    name: label.name.trim(),
    lat: label.lat,
    lon: label.lon,
    createdAt: label.createdAt || now,
    updatedAt: now,
    deletedAt: label.deletedAt,
  });
}

export async function deletePlaceLabel(id: string): Promise<void> {
  const now = Date.now();
  await db.placeLabels.update(id, { deletedAt: now, updatedAt: now });
}

// --- Mutations ---

export async function saveLine(line: FiberLine): Promise<void> {
  const cum = computeCumulativeDistances(line.vertices);
  const length = cum[cum.length - 1] ?? 0;
  await db.lines.put({
    id: line.id || uid(),
    name: line.name,
    colorKey: line.colorKey,
    status: line.status.toLowerCase(),
    fiberType: line.fiberType,
    coreCount: line.coreCount,
    notes: line.notes,
    geometry: encodeGeometryToBlob(line.vertices),
    lengthMapM: length,
    slackPercent: line.slackPercent,
    measuredLengthM: line.measuredLengthM,
    parentLineId: line.parentLineId,
    branchChainageM: line.branchChainageM,
    createdAt: line.createdAt,
    updatedAt: Date.now(),
    deletedAt: line.deletedAt,
  });
}

export async function deleteLine(lineId: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.lines, db.pins, db.pinEvents, db.repairLogs, async () => {
    await db.lines.update(lineId, { deletedAt: now, updatedAt: now });
    await db.pins.where("lineId").equals(lineId).modify({ deletedAt: now });
    const pinIds = await db.pins.where("lineId").equals(lineId).primaryKeys();
    if (pinIds.length > 0) {
      await db.pinEvents.where("pinId").anyOf(pinIds).modify({ deletedAt: now });
    }
    await db.repairLogs.where("lineId").equals(lineId).modify({ deletedAt: now });
  });
}

export interface DropPinInput {
  lineId: string | null;
  type: PinType;
  lat: number;
  lon: number;
  label: string;
  notes: string;
  state?: PinState;
  spliceLossDbm?: number | null;
  coilLengthM?: number;
  gpsAccuracyM?: number | null;
}

export async function dropPin(input: DropPinInput): Promise<FiberPin> {
  const pinId = uid();
  const now = Date.now();
  const state: PinState =
    input.state ?? (input.type === "CUT_REPAIR" ? "OPEN" : "NONE");

  let lineId = input.lineId;
  let snapLat = input.lat;
  let snapLon = input.lon;
  let chainage: number | null = null;

  // A pin dropped in the field belongs to the line under the crew's finger,
  // not to whichever line happened to be open in the app. With no line given,
  // find the closest line within the 50 m snap gate and use it.
  const candidates = input.lineId
    ? [await db.lines.get(input.lineId)]
    : await db.lines.filter((r) => r.deletedAt === null).toArray();

  let closest: { rowId: string; distanceM: number; snapLat: number; snapLon: number; chainage: number } | null =
    null;
  for (const row of candidates) {
    if (!row) continue;
    const snap = snapPointToPolyline(
      { lat: input.lat, lon: input.lon },
      decodeGeometryFromBlob(row.geometry),
    );
    if (!snap || snap.distanceToLineM > 50) continue;
    if (!closest || snap.distanceToLineM < closest.distanceM) {
      closest = {
        rowId: row.id,
        distanceM: snap.distanceToLineM,
        snapLat: snap.snapPoint.lat,
        snapLon: snap.snapPoint.lon,
        chainage: snap.chainageM,
      };
    }
  }

  if (closest) {
    lineId = closest.rowId;
    snapLat = closest.snapLat;
    snapLon = closest.snapLon;
    chainage = closest.chainage;
  } else if (input.lineId) {
    // The crew picked a line but the point is not on it. The pin stays on that
    // line as an off-road point rather than silently jumping to another one.
    snapLat = input.lat;
    snapLon = input.lon;
    chainage = null;
  }

  const resolvedLabel = input.label.trim();

  const row: PinRow = {
    id: pinId,
    lineId,
    type: input.type.toLowerCase(),
    lat: input.lat,
    lon: input.lon,
    snapLat,
    snapLon,
    chainageM: chainage,
    gpsAccuracyM: input.gpsAccuracyM ?? null,
    label: resolvedLabel,
    notes: input.notes,
    state: state.toLowerCase(),
    spliceLossDbm: input.spliceLossDbm ?? null,
    coilLengthM: input.coilLengthM ?? 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.pins.put(row);

  if (state === "REPAIRED") {
    const loss = input.spliceLossDbm ?? 0.02;
    await db.pinEvents.put({
      id: uid(),
      pinId,
      kind: "repaired",
      eventDate: now,
      repairMethod: "fusion",
      spliceLossDbm: loss,
      note: input.notes || "Field splice repair completed.",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await db.repairLogs.put({
      id: uid(),
      lineId,
      pinId,
      spliceLossDbm: loss,
      fiberCutLocation: pinLogName(input.type, resolvedLabel, chainage, snapLat, snapLon),
      cutLat: snapLat,
      cutLon: snapLon,
      chainageM: chainage,
      repairTimestamp: now,
      technicianName: "Field Tech",
      repairMethod: "fusion",
      closureTag: "",
      notes: input.notes || "Initial repair entry",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  } else if (input.type === "CUT_REPAIR" || state === "OPEN") {
    await db.pinEvents.put({
      id: uid(),
      pinId,
      kind: "cut",
      eventDate: now,
      repairMethod: null,
      spliceLossDbm: null,
      note: input.notes || "Cut reported in field.",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  return pinToDomain(row);
}

export async function markPinRepaired(
  pinId: string,
  method: RepairMethod,
  spliceLossDbm: number | null,
  note: string,
): Promise<void> {
  const pin = await db.pins.get(pinId);
  if (!pin) return;
  const now = Date.now();
  const loss = spliceLossDbm ?? pin.spliceLossDbm ?? 0.01;

  await db.pins.update(pinId, {
    state: "repaired",
    spliceLossDbm: loss,
    updatedAt: now,
  });

  await db.pinEvents.put({
    id: uid(),
    pinId,
    kind: "repaired",
    eventDate: now,
    repairMethod: method.toLowerCase(),
    spliceLossDbm: loss,
    note,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  await db.repairLogs.put({
    id: uid(),
    lineId: pin.lineId,
    pinId,
    spliceLossDbm: loss,
    fiberCutLocation: pinLogName(
      pin.type.toUpperCase() as PinType,
      pin.label,
      pin.chainageM,
      pin.snapLat,
      pin.snapLon,
    ),
    cutLat: pin.snapLat,
    cutLon: pin.snapLon,
    chainageM: pin.chainageM,
    repairTimestamp: now,
    technicianName: "Field Tech",
    repairMethod: method.toLowerCase(),
    closureTag: "",
    notes: note,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
}

/**
 * Persists a pin edit. When the crew moves a pin to a different line the
 * chainage has to be recomputed: the stored value belongs to the old line, and
 * keeping it would show the wrong distance and leave the map dot where the
 * old line snapped it.
 */
export async function updatePin(pin: FiberPin): Promise<void> {
  const existing = await db.pins.get(pin.id);
  let snapLat = pin.snapLat;
  let snapLon = pin.snapLon;
  let chainageM = pin.chainageM;

  if (existing && existing.lineId !== pin.lineId) {
    const lineRow = pin.lineId ? await db.lines.get(pin.lineId) : undefined;
    if (lineRow) {
      const snap = snapPointToPolyline(
        { lat: pin.lat, lon: pin.lon },
        decodeGeometryFromBlob(lineRow.geometry),
      );
      if (snap && snap.distanceToLineM <= 50) {
        snapLat = snap.snapPoint.lat;
        snapLon = snap.snapPoint.lon;
        chainageM = snap.chainageM;
      } else {
        // Reassigned to a line but too far from it to snap.
        snapLat = pin.lat;
        snapLon = pin.lon;
        chainageM = null;
      }
    } else {
      // Moved off any line.
      snapLat = pin.lat;
      snapLon = pin.lon;
      chainageM = null;
    }
  }

  await db.pins.put({
    id: pin.id,
    lineId: pin.lineId,
    type: pin.type.toLowerCase(),
    lat: pin.lat,
    lon: pin.lon,
    snapLat,
    snapLon,
    chainageM,
    gpsAccuracyM: pin.gpsAccuracyM,
    label: pin.label,
    notes: pin.notes,
    state: pin.state.toLowerCase(),
    spliceLossDbm: pin.spliceLossDbm,
    coilLengthM: pin.coilLengthM,
    createdAt: pin.createdAt,
    updatedAt: Date.now(),
    deletedAt: pin.deletedAt,
  });
}

export async function deletePin(pinId: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.pins, db.pinEvents, db.repairLogs, async () => {
    await db.pins.update(pinId, { deletedAt: now, updatedAt: now });
    await db.pinEvents.where("pinId").equals(pinId).modify({ deletedAt: now });
    await db.repairLogs.where("pinId").equals(pinId).modify({ deletedAt: now });
  });
}

export type { GeoPoint };
