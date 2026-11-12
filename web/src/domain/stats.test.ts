import { describe, expect, it } from "vitest";
import { calculateLineStats } from "./stats";
import type { FiberLine, FiberPin, PinEvent } from "./models";

const line: FiberLine = {
  id: "test-line-1",
  name: "Test Feeder",
  colorKey: "blue",
  status: "ACTIVE",
  fiberType: "G.652D Single Mode",
  coreCount: 24,
  notes: "",
  vertices: [],
  lengthMapM: 5000,
  slackPercent: 3,
  measuredLengthM: null,
  parentLineId: null,
  branchChainageM: null,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
};

const pin = (
  id: string,
  state: "OPEN" | "REPAIRED" | "NONE",
  createdAt: number,
): FiberPin => ({
  id,
  lineId: line.id,
  type: "CUT_REPAIR",
  lat: 8.5,
  lon: 125.9,
  snapLat: 8.5,
  snapLon: 125.9,
  chainageM: null,
  gpsAccuracyM: null,
  label: id,
  notes: "",
  state,
  spliceLossDbm: 0.01,
  coilLengthM: 0,
  createdAt,
  updatedAt: createdAt,
  deletedAt: null,
});

const event = (
  id: string,
  pinId: string,
  kind: PinEvent["kind"],
  eventDate: number,
): PinEvent => ({
  id,
  pinId,
  kind,
  eventDate,
  repairMethod: null,
  spliceLossDbm: null,
  note: "",
  createdAt: eventDate,
  updatedAt: eventDate,
  deletedAt: null,
});

describe("line stats", () => {
  it("counts cuts, repairs and open cuts", () => {
    const p1 = pin("p1", "REPAIRED", 1_000_000);
    const p2 = pin("p2", "REPAIRED", 2_000_000);
    const p3 = pin("p3", "OPEN", 3_000_000);

    const stats = calculateLineStats(
      line,
      [p1, p2, p3],
      [
        event("e1", "p1", "cut", 1_000_000),
        event("e2", "p1", "repaired", 1_000_000 + 7_200_000),
        event("e3", "p2", "cut", 2_000_000),
        event("e4", "p2", "repaired", 2_000_000 + 14_400_000),
      ],
    );

    expect(stats.totalCuts).toBe(3);
    expect(stats.totalRepairs).toBe(2);
    expect(stats.openCuts).toBe(1);
    expect(stats.totalPinsCount).toBe(3);
  });

  it("adds slack coil length to the cable length", () => {
    const coil: FiberPin = { ...pin("c1", "NONE", 0), type: "SLACK_COIL", coilLengthM: 120 };
    const stats = calculateLineStats(line, [coil], []);
    expect(stats.totalCableLengthM).toBeCloseTo(5000 * 1.03 + 120, 5);
  });

  it("ignores soft-deleted pins", () => {
    const deleted = { ...pin("d1", "OPEN", 0), deletedAt: 1 };
    const stats = calculateLineStats(line, [deleted], []);
    expect(stats.totalPinsCount).toBe(0);
    expect(stats.openCuts).toBe(0);
  });
});
