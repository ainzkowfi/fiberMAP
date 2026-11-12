// Dexie needs a real IndexedDB to talk to. This one lives in memory, so the
// tests can write rows without a browser.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  applyBundleImport,
  buildBundleJson,
  planBundleImport,
  validateBundle,
  BundleError,
} from "./exportImport";

const T0 = 1_700_000_000_000;

const line = (over: Record<string, unknown> = {}) => ({
  id: "line-1",
  name: "Trento Feeder",
  colorKey: "blue",
  status: "ACTIVE",
  fiberType: "G.652D Single Mode",
  coreCount: 24,
  notes: "",
  lengthMapM: 500,
  slackPercent: 3,
  vertices: [
    [8.04, 126.06],
    [8.05, 126.07],
  ],
  createdAt: T0,
  updatedAt: T0,
  ...over,
});

const bundle = (rows: Record<string, unknown>, version = 2) =>
  JSON.stringify({
    format: "fiberMAP-bundle",
    version,
    exportedAt: T0,
    lines: [],
    pins: [],
    events: [],
    repairLogs: [],
    placeLabels: [],
    ...rows,
  });

async function putLocalLine(over: Record<string, unknown> = {}) {
  const row = line(over);
  await db.lines.put({
    id: row.id as string,
    name: row.name as string,
    colorKey: row.colorKey as string,
    status: row.status as string,
    fiberType: row.fiberType as string,
    coreCount: row.coreCount as number,
    notes: row.notes as string,
    geometry: new Uint8Array([1, 2, 3]),
    lengthMapM: row.lengthMapM as number,
    slackPercent: row.slackPercent as number,
    measuredLengthM: null,
    parentLineId: null,
    branchChainageM: null,
    createdAt: row.createdAt as number,
    updatedAt: row.updatedAt as number,
    deletedAt: (over.deletedAt as number | null) ?? null,
  });
}

async function putLocalPin(over: Record<string, unknown> = {}) {
  await db.pins.put({
    id: "pin-1",
    lineId: "line-1",
    type: "cut_repair",
    lat: 8.05,
    lon: 126.06,
    snapLat: 8.05,
    snapLon: 126.06,
    chainageM: 100,
    gpsAccuracyM: null,
    label: "",
    notes: "",
    state: "open",
    spliceLossDbm: null,
    coilLengthM: 0,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...over,
  });
}

async function putLocalEvent(over: Record<string, unknown> = {}) {
  await db.pinEvents.put({
    id: "event-1",
    pinId: "pin-1",
    kind: "cut",
    eventDate: T0,
    repairMethod: null,
    spliceLossDbm: null,
    note: "",
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...over,
  });
}

beforeEach(async () => {
  await db.lines.clear();
  await db.pins.clear();
  await db.pinEvents.clear();
  await db.repairLogs.clear();
  await db.placeLabels.clear();
});

describe("bundle import", () => {
  it("takes the incoming row when it is newer", async () => {
    await putLocalLine({ name: "Old name", updatedAt: T0 });
    const plan = await planBundleImport(
      bundle({ lines: [line({ name: "New name", updatedAt: T0 + 1000 })] }),
    );

    expect(plan.preview.lines.updated).toBe(1);
    expect(plan.preview.lines.skipped).toBe(0);

    await applyBundleImport(plan);
    const stored = await db.lines.get("line-1");
    expect(stored?.name).toBe("New name");
    expect(stored?.updatedAt).toBe(T0 + 1000);
  });

  it("keeps the local row when the incoming one is older", async () => {
    await putLocalLine({ name: "Local name", updatedAt: T0 + 1000 });
    const plan = await planBundleImport(
      bundle({ lines: [line({ name: "Old name", updatedAt: T0 })] }),
    );

    expect(plan.preview.lines.skipped).toBe(1);
    expect(plan.preview.lines.updated).toBe(0);
    expect(plan.preview.totals.new).toBe(0);

    await applyBundleImport(plan);
    const stored = await db.lines.get("line-1");
    expect(stored?.name).toBe("Local name");
    expect(stored?.updatedAt).toBe(T0 + 1000);
  });

  it("inserts a row that is not on the device yet", async () => {
    const plan = await planBundleImport(bundle({ lines: [line()] }));
    expect(plan.preview.lines.new).toBe(1);
    await applyBundleImport(plan);
    expect((await db.lines.get("line-1"))?.name).toBe("Trento Feeder");
  });

  it("keeps a deleted record deleted when the incoming row is older", async () => {
    await putLocalLine({ deletedAt: T0 + 2000, updatedAt: T0 + 2000 });
    const plan = await planBundleImport(
      bundle({ lines: [line({ updatedAt: T0 })] }),
    );

    expect(plan.preview.lines.skipped).toBe(1);

    await applyBundleImport(plan);
    const stored = await db.lines.get("line-1");
    expect(stored?.deletedAt).toBe(T0 + 2000);
  });

  it("marks a row deleted when a newer tombstone arrives", async () => {
    await putLocalLine({ updatedAt: T0 });
    const plan = await planBundleImport(
      bundle({ lines: [line({ deletedAt: T0 + 1000, updatedAt: T0 + 1000 })] }),
    );

    expect(plan.preview.lines.deleted).toBe(1);
    expect(plan.preview.lines.updated).toBe(0);

    await applyBundleImport(plan);
    const stored = await db.lines.get("line-1");
    expect(stored?.deletedAt).toBe(T0 + 1000);
  });

  it("imports a version 1 bundle", async () => {
    const v1 = bundle(
      {
        lines: [
          {
            id: "line-1",
            name: "From the APK",
            colorKey: "blue",
            status: "ACTIVE",
            fiberType: "G.652D Single Mode",
            coreCount: 24,
            notes: "",
            lengthMapM: 500,
            slackPercent: 3,
            vertices: [
              [8.04, 126.06],
              [8.05, 126.07],
            ],
            createdAt: T0,
          },
        ],
      },
      1,
    );

    const plan = await planBundleImport(v1);
    expect(plan.preview.lines.new).toBe(1);

    await applyBundleImport(plan);
    const stored = await db.lines.get("line-1");
    expect(stored?.name).toBe("From the APK");
    expect(stored?.deletedAt).toBeNull();
  });

  it("does not let a version 1 bundle delete anything", async () => {
    await putLocalLine({ deletedAt: T0 + 2000, updatedAt: T0 + 2000 });
    const v1 = bundle(
      {
        lines: [
          {
            id: "line-1",
            name: "From the APK",
            colorKey: "blue",
            status: "ACTIVE",
            fiberType: "G.652D Single Mode",
            coreCount: 24,
            notes: "",
            lengthMapM: 500,
            slackPercent: 3,
            vertices: [
              [8.04, 126.06],
              [8.05, 126.07],
            ],
            createdAt: T0,
          },
        ],
      },
      1,
    );

    const plan = await planBundleImport(v1);
    expect(plan.preview.lines.deleted).toBe(0);
    await applyBundleImport(plan);

    expect((await db.lines.get("line-1"))?.deletedAt).toBe(T0 + 2000);
  });

  it("refuses a malformed bundle and writes nothing", async () => {
    await expect(
      planBundleImport(
        bundle({
          pins: [
            {
              id: "pin-1",
              lineId: "line-1",
              type: "CUT_REPAIR",
              lat: 999,
              lon: 126.06,
              chainageM: 100,
              label: "",
              notes: "",
              state: "OPEN",
              coilLengthM: 0,
              createdAt: T0,
            },
          ],
        }),
      ),
    ).rejects.toThrow(BundleError);

    expect(await db.pins.count()).toBe(0);
    expect(await db.lines.count()).toBe(0);
  });

  it("names the first bad field", () => {
    try {
      validateBundle(bundle({ pins: [{ id: "pin-1", lat: 999 }] }));
      throw new Error("should have been refused");
    } catch (err) {
      expect(err).toBeInstanceOf(BundleError);
      // The latitude is checked before the type, so that is the first field
      // the crew has to fix.
      expect((err as BundleError).field).toBe("pins[0].lat");
      expect((err as Error).message).toContain("pins[0].lat");
    }
  });

  it("refuses a bundle that is not a bundle", () => {
    expect(() => validateBundle('{"hello":"world"}')).toThrow(BundleError);
    expect(() => validateBundle("not json at all")).toThrow(BundleError);
  });

  it("refuses a bundle from a newer version of the app", () => {
    expect(() => validateBundle(bundle({}, 3))).toThrow(BundleError);
  });

  it("exports the tombstones so a deletion travels", async () => {
    await putLocalLine({ deletedAt: T0 + 500, updatedAt: T0 + 500 });
    const json = await (async () => {
      const { exportFmapBundle } = await import("./exportImport");
      return exportFmapBundle();
    })();

    const parsed = JSON.parse(json) as {
      version: number;
      lines: Array<{ id: string; deletedAt: number | null }>;
    };
    expect(parsed.version).toBe(2);
    expect(parsed.lines[0].deletedAt).toBe(T0 + 500);
  });

  it("builds a bundle the validator accepts", async () => {
    await putLocalLine();
    const json = buildBundleJson(
      {
        lines: (await db.lines.toArray()) as never,
        pins: [],
        events: [],
        repairLogs: [],
        placeLabels: [],
      },
      T0,
    );
    expect(() => validateBundle(json)).not.toThrow();
  });
});

describe("bundle import and orphans", () => {
  it("brings a deleted line back when a pin under it is newer", async () => {
    await putLocalLine({ deletedAt: T0, updatedAt: T0 });
    const plan = await planBundleImport(
      bundle({
        pins: [
          {
            id: "pin-1",
            lineId: "line-1",
            type: "CUT_REPAIR",
            lat: 8.05,
            lon: 126.06,
            chainageM: 100,
            label: "",
            notes: "",
            state: "OPEN",
            coilLengthM: 0,
            createdAt: T0 + 1000,
            updatedAt: T0 + 1000,
          },
        ],
      }),
    );

    expect(plan.preview.lines.restored).toBe(1);
    expect(plan.preview.pins.orphaned).toBe(0);

    await applyBundleImport(plan);
    expect((await db.lines.get("line-1"))?.deletedAt).toBeNull();
    expect((await db.pins.get("pin-1"))?.deletedAt).toBeNull();
  });

  it("takes a child down when the parent under it is deleted", async () => {
    await putLocalLine({ deletedAt: T0, updatedAt: T0 });
    await putLocalPin({ updatedAt: T0 - 1000 });

    const plan = await planBundleImport(bundle({}));
    expect(plan.preview.pins.orphaned).toBe(1);
    expect(plan.preview.lines.restored).toBe(0);

    await applyBundleImport(plan);
    expect((await db.pins.get("pin-1"))?.deletedAt).not.toBeNull();
  });

  it("brings the line back when a locally edited pin is newer than the tombstone", async () => {
    await putLocalLine({ updatedAt: T0 });
    await putLocalPin({ updatedAt: T0 + 3000 });

    const plan = await planBundleImport(
      bundle({
        lines: [line({ deletedAt: T0 + 2000, updatedAt: T0 + 2000 })],
      }),
    );

    expect(plan.preview.lines.deleted).toBe(1);
    expect(plan.preview.lines.restored).toBe(1);

    await applyBundleImport(plan);
    expect((await db.lines.get("line-1"))?.deletedAt).toBeNull();
    expect((await db.pins.get("pin-1"))?.deletedAt).toBeNull();
  });

  it("keeps an edit made between the preview and the import", async () => {
    await putLocalLine({ name: "Local name", updatedAt: T0 });
    const plan = await planBundleImport(
      bundle({ lines: [line({ name: "Incoming name", updatedAt: T0 + 1000 })] }),
    );
    expect(plan.preview.lines.updated).toBe(1);

    // The crew edits the row while the preview is still on screen.
    await db.lines.update("line-1", {
      name: "Edited on the phone",
      updatedAt: T0 + 5000,
    });

    await applyBundleImport(plan);
    const stored = await db.lines.get("line-1");
    expect(stored?.name).toBe("Edited on the phone");
    expect(stored?.updatedAt).toBe(T0 + 5000);
  });

  it("takes a local event down when the pin under it is deleted", async () => {
    await putLocalLine();
    await putLocalPin({ deletedAt: T0, updatedAt: T0 });
    await putLocalEvent({ updatedAt: T0 - 1000 });

    const plan = await planBundleImport(bundle({}));
    expect(plan.preview.events.orphaned).toBe(1);

    await applyBundleImport(plan);
    expect((await db.pinEvents.get("event-1"))?.deletedAt).not.toBeNull();
  });

  it("brings a deleted pin back when an event under it is newer", async () => {
    await putLocalLine();
    await putLocalPin({ deletedAt: T0, updatedAt: T0 });

    const plan = await planBundleImport(
      bundle({
        events: [
          {
            id: "event-1",
            pinId: "pin-1",
            kind: "cut",
            eventDate: T0 + 1000,
            repairMethod: "",
            note: "",
            updatedAt: T0 + 1000,
          },
        ],
      }),
    );

    expect(plan.preview.pins.restored).toBe(1);
    expect(plan.preview.events.orphaned).toBe(0);

    await applyBundleImport(plan);
    expect((await db.pins.get("pin-1"))?.deletedAt).toBeNull();
    expect((await db.pinEvents.get("event-1"))?.deletedAt).toBeNull();
  });
});
