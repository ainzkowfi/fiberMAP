import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../data/db";
import { exportFmapBundle } from "../data/exportImport";
import { getLastBackupAt, setLastBackupAt } from "../data/repo";
import {
  backupFileName,
  gunzipText,
  gzipText,
  isPersisted,
  requestPersistence,
  shareOrDownload,
} from "../core/storage";
import { ImportPreviewSheet } from "./ImportPreviewSheet";
import { useImportPreview } from "./useImportPreview";

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

function formatWhen(timestamp: number): string {
  if (!timestamp) return "never";
  return new Date(timestamp).toLocaleString();
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
  const [protectedData, setProtectedData] = useState<boolean | null>(null);
  const [lastBackupAt, setLastBackup] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const importFlow = useImportPreview();

  useEffect(() => {
    void isPersisted().then(setProtectedData);
    void getLastBackupAt().then(setLastBackup);
  }, []);

  const protect = async () => {
    const granted = await requestPersistence();
    setProtectedData(granted);
    setStatus(
      granted
        ? "This phone will not clear the app's data on its own."
        : "The browser declined. Keep a backup file somewhere safe.",
    );
  };

  /**
   * A backup file is the whole bundle, gzipped. It is the one copy that
   * survives the browser clearing its storage, so it is handed to the share
   * sheet where the phone has one and downloaded where it does not.
   */
  const saveBackup = async () => {
    setStatus(null);
    try {
      const json = await exportFmapBundle();
      const gz = await gzipText(json);
      const file = new File([gz], backupFileName(), { type: "application/gzip" });
      const result = await shareOrDownload(file, "fiberMAP backup");
      if (result === "cancelled") return;
      const now = Date.now();
      await setLastBackupAt(now);
      setLastBackup(now);
      setStatus(
        result === "shared"
          ? "Backup handed over."
          : "Backup file saved to this phone.",
      );
    } catch (err) {
      setStatus(`Backup failed: ${(err as Error).message}`);
    }
  };

  const openBackup = async (file: File) => {
    setStatus(null);
    try {
      const text = file.name.endsWith(".fmap")
        ? await gunzipText(file)
        : await file.text();
      const ok = await importFlow.prepare(text);
      if (!ok) setStatus(`That file was refused: ${importFlow.error}`);
    } catch (err) {
      setStatus(`Could not read that file: ${(err as Error).message}`);
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
          <div className="row between" style={{ marginBottom: 8 }}>
            <strong>Backup</strong>
            <span className="tag">Last: {formatWhen(lastBackupAt)}</span>
          </div>
          <p className="small muted" style={{ margin: "0 0 10px" }}>
            All lines, cuts and repairs live in this browser&apos;s local
            database. Nothing is sent to a server. A backup file carries them
            to another phone; the base map archive is not included and can be
            downloaded again.
          </p>
          <button className="btn primary block" onClick={() => void saveBackup()}>
            Save backup file
          </button>
          <button
            className="btn block"
            style={{ marginTop: 8 }}
            onClick={() => fileRef.current?.click()}
          >
            Open backup file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".fmap,.json,application/gzip,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void openBackup(file);
              e.target.value = "";
            }}
          />
          {status && (
            <div className="small" role="status" style={{ marginTop: 10 }}>
              {status}
            </div>
          )}
        </div>

        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <strong>Storage</strong>
            {protectedData === null ? (
              <span className="tag">Checking</span>
            ) : protectedData ? (
              <span className="tag repaired">Protected</span>
            ) : (
              <span className="tag planned">At risk</span>
            )}
          </div>
          <p className="small muted" style={{ margin: "0 0 10px" }}>
            {protectedData
              ? "The browser will not clear this app's data when the phone runs out of room."
              : "Browser may clear this. A phone that runs out of room can take the records with it."}
          </p>
          <button className="btn block" onClick={() => void protect()}>
            {protectedData ? "Check again" : "Protect this data"}
          </button>
        </div>

        <div className="card small muted">
          <strong style={{ color: "var(--ink)" }}>fiberMAP v1.0 (web)</strong>
          <p style={{ margin: "6px 0 0" }}>
            Agusan del Sur Offline Fiber Infrastructure Map. Designed for field
            line teams &amp; cable records.
          </p>
        </div>
      </div>

      {importFlow.plan && (
        <ImportPreviewSheet
          preview={importFlow.plan.preview}
          onImport={() => {
            void importFlow.apply().then((totals) => {
              setStatus(
                totals
                  ? `Imported ${totals.new} new, ${totals.updated} updated, ${totals.deleted} deleted.`
                  : null,
              );
            });
          }}
          onCancel={importFlow.cancel}
        />
      )}
    </div>
  );
}
