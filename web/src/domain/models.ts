import type { GeoPoint } from "../core/geometry";

export type LineStatus = "ACTIVE" | "PLANNED" | "DAMAGED" | "RETIRED";

export const LINE_STATUS_TITLE: Record<LineStatus, string> = {
  ACTIVE: "Active",
  PLANNED: "Planned",
  DAMAGED: "Damaged",
  RETIRED: "Retired",
};

export type PinType =
  | "CUT_REPAIR"
  | "JOINT_CLOSURE"
  | "SPLITTER_NAP"
  | "POLE_HANDHOLE"
  | "SLACK_COIL"
  | "NOTE";

export interface PinTypeInfo {
  title: string;
  shortCode: string;
}

export const PIN_TYPE_INFO: Record<PinType, PinTypeInfo> = {
  CUT_REPAIR: { title: "Cut / Repair", shortCode: "CUT" },
  JOINT_CLOSURE: { title: "Joint Closure", shortCode: "FOSC" },
  SPLITTER_NAP: { title: "Splitter / NAP", shortCode: "NAP" },
  POLE_HANDHOLE: { title: "Pole / Handhole", shortCode: "POLE" },
  SLACK_COIL: { title: "Slack Coil", shortCode: "COIL" },
  NOTE: { title: "Field Note", shortCode: "NOTE" },
};

export type PinState = "OPEN" | "REPAIRED" | "NONE";

export const PIN_STATE_TITLE: Record<PinState, string> = {
  OPEN: "Open Cut",
  REPAIRED: "Repaired",
  NONE: "Normal",
};

export type RepairMethod = "FUSION" | "MECHANICAL" | "REPLACED_SECTION";

export const REPAIR_METHOD_TITLE: Record<RepairMethod, string> = {
  FUSION: "Fusion Splice",
  MECHANICAL: "Mechanical Splice",
  REPLACED_SECTION: "Replaced Section / Span",
};

export interface FiberLine {
  id: string;
  name: string;
  colorKey: string;
  status: LineStatus;
  fiberType: string;
  coreCount: number | null;
  notes: string;
  vertices: GeoPoint[];
  lengthMapM: number;
  slackPercent: number;
  measuredLengthM: number | null;
  parentLineId: string | null;
  branchChainageM: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface FiberPin {
  id: string;
  lineId: string | null;
  type: PinType;
  lat: number;
  lon: number;
  snapLat: number;
  snapLon: number;
  chainageM: number | null;
  gpsAccuracyM: number | null;
  label: string;
  notes: string;
  state: PinState;
  spliceLossDbm: number | null;
  coilLengthM: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

/**
 * A name the crew put on the map themselves: a purok, a site, a customer's
 * house, anything OSM does not know about.
 */
export interface PlaceLabel {
  id: string;
  name: string;
  lat: number;
  lon: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type PinEventKind = "cut" | "repaired" | "inspected" | "note";
export interface PinEvent {
  id: string;
  pinId: string;
  kind: PinEventKind;
  eventDate: number;
  repairMethod: RepairMethod | null;
  spliceLossDbm: number | null;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface RepairLog {
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
  repairMethod: RepairMethod;
  closureTag: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface LineWithStats {
  line: FiberLine;
  totalCuts: number;
  totalRepairs: number;
  openCuts: number;
  totalPinsCount: number;
  totalCableLengthM: number;
}
