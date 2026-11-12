import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "./db";
import {
  eventToDomain,
  labelToDomain,
  lineToDomain,
  pinToDomain,
  repairLogToDomain,
} from "./repo";
import { calculateLineStats } from "../domain/stats";
import type { LineWithStats } from "../domain/models";

export function useLines() {
  return (
    useLiveQuery(async () => {
      const rows = await db.lines.filter((r) => r.deletedAt === null).toArray();
      return rows.sort((a, b) => b.updatedAt - a.updatedAt).map(lineToDomain);
    }, [], []) ?? []
  );
}

export function usePins() {
  return (
    useLiveQuery(async () => {
      const rows = await db.pins.filter((r) => r.deletedAt === null).toArray();
      return rows.sort((a, b) => (a.chainageM ?? 0) - (b.chainageM ?? 0)).map(pinToDomain);
    }, [], []) ?? []
  );
}

export function useEvents() {
  return (
    useLiveQuery(async () => {
      const rows = await db.pinEvents.filter((r) => r.deletedAt === null).toArray();
      return rows.sort((a, b) => b.eventDate - a.eventDate).map(eventToDomain);
    }, [], []) ?? []
  );
}

export function useRepairLogs() {
  return (
    useLiveQuery(async () => {
      const rows = await db.repairLogs.filter((r) => r.deletedAt === null).toArray();
      return rows.sort((a, b) => b.repairTimestamp - a.repairTimestamp).map(repairLogToDomain);
    }, [], []) ?? []
  );
}

/** The names the crew put on the map themselves. */
export function usePlaceLabels() {
  return (
    useLiveQuery(async () => {
      const rows = await db.placeLabels.filter((r) => r.deletedAt === null).toArray();
      return rows.sort((a, b) => b.updatedAt - a.updatedAt).map(labelToDomain);
    }, [], []) ?? []
  );
}

export function useLinesWithStats(): LineWithStats[] {  const lines = useLines();
  const pins = usePins();
  const events = useEvents();
  return lines.map((line) => calculateLineStats(line, pins, events));
}

export function useSetting(key: string, fallback: string) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    let alive = true;
    void db.settings.get(key).then((row) => {
      if (alive && row) setValue(row.value);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  const update = (next: string) => {
    setValue(next);
    void db.settings.put({ key, value: next });
  };
  return [value, update] as const;
}
