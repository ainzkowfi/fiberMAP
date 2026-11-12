// Dexie needs a real IndexedDB to talk to. This one lives in memory, so the
// tests can write rows without a browser.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  deleteLine,
  deletePin,
  dropPin,
  markPinRepaired,
  saveLine,
} from "./repo";
import type { FiberLine } from "../domain/models";

const line: FiberLine = {
  id: "line-1",
  name: "Trento Feeder",
  colorKey: "blue",
  status: "ACTIVE",
  fiberType: "G.652D Single Mode",
  coreCount: 24,
  notes: "",
  vertices: [
    { lat: 8.04, lon: 126.06 },
    { lat: 8.05, lon: 126.07 },
  ],
  lengthMapM: 1400,
  slackPercent: 3,
  measuredLengthM: null,
  parentLineId: null,
  branchChainageM: null,
  createdAt: 1000,
  updatedAt: 1000,
  deletedAt: null,
};

async function seed() {
  await saveLine({ ...line });
  const pin = await dropPin({
    lineId: line.id,
    type: "CUT_REPAIR",
    lat: 8.045,
    lon: 126.065,
    label: "",
    notes: "",
  });
  await markPinRepaired(pin.id, "FUSION", 0.02, "Fusion at the NAP");
  return pin;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(async () => {
  await db.lines.clear();
  await db.pins.clear();
  await db.pinEvents.clear();
  await db.repairLogs.clear();
  await db.placeLabels.clear();
});

describe("deleting a line", () => {
  it("takes the line, its pins, its events and its repair logs with it", async () => {
    const pin = await seed();
    const before = {
      line: (await db.lines.get(line.id))!.updatedAt,
      pin: (await db.pins.get(pin.id))!.updatedAt,
      event: (await db.pinEvents.where("pinId").equals(pin.id).first())!.updatedAt,
      log: (await db.repairLogs.where("pinId").equals(pin.id).first())!.updatedAt,
    };
    await wait(5);

    await deleteLine(line.id);

    const after = {
      line: (await db.lines.get(line.id))!,
      pin: (await db.pins.get(pin.id))!,
      event: (await db.pinEvents.where("pinId").equals(pin.id).first())!,
      log: (await db.repairLogs.where("pinId").equals(pin.id).first())!,
    };

    expect(after.line.deletedAt).not.toBeNull();
    expect(after.pin.deletedAt).not.toBeNull();
    expect(after.event.deletedAt).not.toBeNull();
    expect(after.log.deletedAt).not.toBeNull();

    // Every row the cascade touches gets a new timestamp, so a bundle that
    // still carries the old row cannot bring it back.
    expect(after.line.updatedAt).toBeGreaterThan(before.line);
    expect(after.pin.updatedAt).toBeGreaterThan(before.pin);
    expect(after.event.updatedAt).toBeGreaterThan(before.event);
    expect(after.log.updatedAt).toBeGreaterThan(before.log);
  });
});

describe("deleting a pin", () => {
  it("takes the pin, its events and its repair logs with it", async () => {
    const pin = await seed();
    const before = {
      pin: (await db.pins.get(pin.id))!.updatedAt,
      event: (await db.pinEvents.where("pinId").equals(pin.id).first())!.updatedAt,
      log: (await db.repairLogs.where("pinId").equals(pin.id).first())!.updatedAt,
    };
    await wait(5);

    await deletePin(pin.id);

    const after = {
      pin: (await db.pins.get(pin.id))!,
      event: (await db.pinEvents.where("pinId").equals(pin.id).first())!,
      log: (await db.repairLogs.where("pinId").equals(pin.id).first())!,
    };

    expect(after.pin.deletedAt).not.toBeNull();
    expect(after.event.deletedAt).not.toBeNull();
    expect(after.log.deletedAt).not.toBeNull();
    expect(after.pin.updatedAt).toBeGreaterThan(before.pin);
    expect(after.event.updatedAt).toBeGreaterThan(before.event);
    expect(after.log.updatedAt).toBeGreaterThan(before.log);
  });

  it("leaves the line alone", async () => {
    const pin = await seed();
    await deletePin(pin.id);
    expect((await db.lines.get(line.id))?.deletedAt).toBeNull();
  });
});
