import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  type LineRow,
  type PinEventRow,
  type PinRow,
  type RepairLogRow,
  type SettingRow,
} from "../data/db";
import { ConfirmSheet } from "./ConfirmSheet";

export interface SettingsProps {
  theme: string;
  handedness: string;
  units: string;
  onThemeChanged: (v: string) => void;
  onHandednessChanged: (v: string) => void;
  onUnitsChanged: (v: string) => void;
  onOpenMapsManager: () => void;
  onBack: () => void;
}

export function Settings({
  theme,
  handedness,
  units,
  onThemeChanged,
  onHandednessChanged,
  onUnitsChanged,
  onOpenMapsManager,
  onBack,
}: SettingsProps) {
  const mapFiles =
    useLiveQuery(async () => db.mapFiles.orderBy("buildDate").reverse().toArray(), [], []) ??
    [];
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<File | null>(null);

  const backup = async () => {
    const payload = {
      format: "fibermap-snapshot",
      version: 1,
      lines: await db.lines.toArray(),
      pins: await db.pins.toArray(),
      pinEvents: await db.pinEvents.toArray(),
      repairLogs: await db.repairLogs.toArray(),
      settings: await db.settings.toArray(),
      exportedAt: Date.now(),
    };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fibermap-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * The snapshot has to be restorable or it is not a backup. The base map
   * archive is deliberately excluded: it is 9 MB and re-downloading it is
   * cheaper than carrying it through a JSON file.
   */
  const restore = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text()) as Record<string, unknown>;
      const rows = ["lines", "pins", "pinEvents", "repairLogs", "settings"] as const;
      if (!rows.every((key) => Array.isArray(payload[key]))) {
        setRestoreStatus("Not a fiberMAP snapshot.");
        return;
      }
      await db.transaction(
        "rw",
        [db.lines, db.pins, db.pinEvents, db.repairLogs, db.settings],
        async () => {
          await Promise.all([
            db.lines.clear(),
            db.pins.clear(),
            db.pinEvents.clear(),
            db.repairLogs.clear(),
            db.settings.clear(),
          ]);
          await db.lines.bulkPut(payload.lines as LineRow[]);
          await db.pins.bulkPut(payload.pins as PinRow[]);
          await db.pinEvents.bulkPut(payload.pinEvents as PinEventRow[]);
          await db.repairLogs.bulkPut(payload.repairLogs as RepairLogRow[]);
          await db.settings.bulkPut(payload.settings as SettingRow[]);
        },
      );
      // The theme, units and handedness live in the database as well, so the
      // app has to read them again rather than keep the ones it had.
      window.location.reload();
    } catch (err) {
      setRestoreStatus(`Restore failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="scroll" style={{ padding: 14 }}>
      <div className="stack">
        <button className="btn ghost" onClick={onBack} style={{ alignSelf: "flex-start" }}>
          ← Map
        </button>

        <div className="card">
          <strong>Appearance</strong>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Theme</label>
            <div className="chips">
              {["system", "light", "dark"].map((t) => (
                <button
                  key={t}
                  className="chip"
                  aria-pressed={theme === t}
                  onClick={() => onThemeChanged(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <strong>Handedness mode</strong>
          <p className="small muted" style={{ margin: "4px 0 10px" }}>
            Positions primary map controls for one-handed thumb use.
          </p>
          <div className="chips">
            <button
              className="chip"
              aria-pressed={handedness === "right"}
              onClick={() => onHandednessChanged("right")}
            >
              Right-hand mode
            </button>
            <button
              className="chip"
              aria-pressed={handedness === "left"}
              onClick={() => onHandednessChanged("left")}
            >
              Left-hand mode
            </button>
          </div>
        </div>

        <div className="card">
          <strong>Chainage &amp; distance notation</strong>
          <div className="chips" style={{ marginTop: 10 }}>
            <button
              className="chip"
              aria-pressed={units === "chainage"}
              onClick={() => onUnitsChanged("chainage")}
            >
              Chainage (1+240 m)
            </button>
            <button
              className="chip"
              aria-pressed={units === "metric"}
              onClick={() => onUnitsChanged("metric")}
            >
              Metric (1.24 km)
            </button>
          </div>
        </div>

        <div className="card">
          <strong>Base maps</strong>
          <p className="small muted" style={{ margin: "4px 0 10px" }}>
            {mapFiles.length} registered ·{" "}
            {mapFiles.find((m) => m.active)?.displayName ?? "none active"}
          </p>
          <button className="btn block" onClick={onOpenMapsManager}>
            Manage PMTiles base maps
          </button>
        </div>

        <div className="card">
          <strong>Backup</strong>
          <p className="small muted" style={{ margin: "4px 0 10px" }}>
            All lines, cuts and repairs live in this browser&apos;s local
            database (IndexedDB). Nothing is sent to a server. A snapshot
            carries the records and the preferences; the base map archive is
            not included and can be downloaded again.
          </p>
          <button className="btn block" onClick={() => void backup()}>
            Export snapshot
          </button>
          <label className="btn block" style={{ marginTop: 8, textAlign: "center" }}>
            Restore snapshot
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPendingRestore(file);
                e.target.value = "";
              }}
            />
          </label>
          {restoreStatus && (
            <div className="small" role="status" style={{ marginTop: 10 }}>
              {restoreStatus}
            </div>
          )}
        </div>

        <div className="card small muted">
          <strong style={{ color: "var(--ink)" }}>fiberMAP v1.0 (web)</strong>
          <p style={{ margin: "6px 0 0" }}>
            Agusan del Sur Offline Fiber Infrastructure Map. Designed for field
            line teams &amp; cable records.
          </p>
        </div>
      </div>

      {pendingRestore && (
        <ConfirmSheet
          title="Restore this snapshot?"
          body="The lines, pins, repairs and preferences on this device are replaced by the snapshot. Export a snapshot first if you are not sure."
          confirmLabel="Restore"
          onCancel={() => setPendingRestore(null)}
          onConfirm={() => {
            const file = pendingRestore;
            setPendingRestore(null);
            void restore(file);
          }}
        />
      )}
    </div>
  );
}
