// Dexie needs a real IndexedDB to talk to. This one lives in memory, so the
// test can build a database the way the older build left it.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

/**
 * A version 1 database, built with the raw API so it looks exactly like the
 * one the shipped app left on the phone.
 *
 * Dexie multiplies the schema version by ten, so schema version 1 is Dexie
 * version 10 and the current schema (version 2) is Dexie version 20.
 */
async function buildVersion1Database(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("fibermap", 10);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = (name: string, keyPath: string, indexes: string[]) => {
        const created = database.createObjectStore(name, { keyPath });
        for (const index of indexes) created.createIndex(index, index);
      };
      store("lines", "id", ["name", "status", "deletedAt", "updatedAt"]);
      store("pins", "id", ["lineId", "type", "state", "deletedAt", "chainageM"]);
      store("pinEvents", "id", ["pinId", "kind", "deletedAt", "eventDate"]);
      store("repairLogs", "id", ["lineId", "pinId", "repairTimestamp", "deletedAt"]);
      store("mapFiles", "id", ["active", "buildDate"]);
      store("settings", "key", []);
      store("archiveBlobs", "id", []);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

describe("the database upgrade", () => {
  it("takes a version 1 database to version 2 and keeps the records", async () => {
    await buildVersion1Database();

    // The old rows, written before the upgrade.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("fibermap", 10);
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction("settings", "readwrite");
        tx.objectStore("settings").put({ key: "theme", value: "dark" });
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject(request.error);
      };
      request.onerror = () => reject(request.error);
    });

    // Opening it with the app's schema is what does the upgrade.
    const { db } = await import("./db");
    await db.open();

    const names = db.tables.map((table) => table.name);
    expect(names).toContain("placeLabels");
    expect(names).toContain("lines");

    // The records that were there before are still there.
    expect((await db.settings.get("theme"))?.value).toBe("dark");

    // And the new table works.
    await db.placeLabels.put({
      id: "place-1",
      name: "Purok 7",
      lat: 8.02,
      lon: 126.16,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    });
    expect((await db.placeLabels.get("place-1"))?.name).toBe("Purok 7");
  });
});
