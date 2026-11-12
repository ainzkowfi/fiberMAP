import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { readPmTilesHeader, TILE_TYPE_DESCRIPTION } from "../core/pmtiles";
import {
  BUNDLED_BASEMAP,
  downloadBundledBasemap,
  importArchive,
  isBundledBasemapStored,
  type DownloadProgress,
} from "./pmtilesStore";
import { ConfirmSheet } from "./ConfirmSheet";

export interface MapManagerProps {
  mapFiles: Array<{
    id: string;
    displayName: string;
    path: string;
    sizeBytes: number;
    minZoom: number;
    maxZoom: number;
    bounds: string;
    active: number;
  }>;
  onSetActive: (id: string) => void;
  onDelete: (id: string) => void;
  onArchiveImported: () => void;
  onBack: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function MapManager({
  mapFiles,
  onSetActive,
  onDelete,
  onArchiveImported,
  onBack,
}: MapManagerProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bundledStored, setBundledStored] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  useLiveQuery(
    async () => {
      setBundledStored(await isBundledBasemapStored());
    },
    [],
  );

  const download = async () => {
    setError(null);
    setStatus(null);
    setBusy(true);
    setProgress({ received: 0, total: BUNDLED_BASEMAP.sizeBytes });
    try {
      const info = await downloadBundledBasemap(setProgress);
      setStatus(
        `Basemap stored on this device. z${info.minZoom} to z${info.maxZoom}, ${(info.sizeBytes / 1_048_576).toFixed(1)} MB. It works with no signal from now on.`,
      );
      onArchiveImported();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const pick = async (file: File) => {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      // Validate the header before committing the file to storage.
      const header = readPmTilesHeader(await file.arrayBuffer());
      const info = await importArchive(file);
      setStatus(
        `${file.name} stored. ${TILE_TYPE_DESCRIPTION[header.tileType]}, z${info.minZoom} to z${info.maxZoom}, ${(file.size / 1_048_576).toFixed(1)} MB.`,
      );
      onArchiveImported();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scroll" style={{ padding: 14 }}>
      <div className="stack">
        <button className="btn ghost" onClick={onBack} style={{ alignSelf: "flex-start" }}>
          ← Settings
        </button>

        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <strong>Agusan del Sur basemap</strong>
            {bundledStored ? (
              <span className="tag repaired">On device</span>
            ) : (
              <span className="tag planned">Not downloaded</span>
            )}
          </div>
          <p className="small muted" style={{ margin: "0 0 12px" }}>
            Full province coverage: San Francisco, Prosperidad, Bayugan,
            Rosario, Trento, Bunawan and the rest, with real street names down
            to z15. It is installed on this device when the app starts and
            read in small pieces, so the map keeps working with no signal and
            never loads the whole file at once.
          </p>
          <button
            className="btn primary block"
            disabled={busy}
            onClick={() => void download()}
          >
            {busy
              ? "Downloading..."
              : bundledStored
                ? "Re-download basemap"
                : `Download basemap (${(BUNDLED_BASEMAP.sizeBytes / 1_048_576).toFixed(0)} MB)`}
          </button>
          {progress && busy && (
            <div style={{ marginTop: 10 }}>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.received}
                aria-label="Basemap download progress"
                style={{
                  height: 8,
                  background: "var(--surface-variant)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "var(--jacket)",
                    transform: `scaleX(${
                      progress.total ? Math.min(1, progress.received / progress.total) : 0
                    })`,
                    transformOrigin: "left",
                    transition: "transform 120ms linear",
                  }}
                />
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                {formatBytes(progress.received)} of {formatBytes(progress.total)} downloaded
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <strong>Import another archive</strong>
          <p className="small muted" style={{ margin: "4px 0 12px" }}>
            Any .pmtiles vector archive works. The header is checked before
            the file is stored, and nothing is uploaded.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pmtiles"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
              e.target.value = "";
            }}
          />
          <button
            className="btn block"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Choose .pmtiles file
          </button>
          {status && (
            <div className="small" style={{ marginTop: 10, color: "var(--repaired)" }}>
              {status}
            </div>
          )}
          {error && (
            <div className="small" style={{ marginTop: 10, color: "var(--cut)" }}>
              {error}
            </div>
          )}
        </div>

        <div className="card">
          <strong>Registered maps ({mapFiles.length})</strong>
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            {mapFiles.map((m) => (
              <div key={m.id} className="row between">
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{m.displayName}</div>
                  <div className="small muted">
                    z{m.minZoom} to z{m.maxZoom}
                    {m.sizeBytes > 0 && ` · ${(m.sizeBytes / 1_048_576).toFixed(1)} MB`}
                  </div>
                </div>
                {m.path.startsWith("builtin://") ? (
                  <span className="tag">Built in</span>
                ) : m.active ? (
                  <span className="tag jacket">Active</span>
                ) : (
                  <button
                    className="btn"
                    onClick={() => void onSetActive(m.id)}
                  >
                    Use this
                  </button>
                )}
                {!m.path.startsWith("builtin://") && (
                  <button
                    className="btn danger"
                    onClick={() => setPendingDelete({ id: m.id, name: m.displayName })}
                    aria-label={`Delete ${m.displayName}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card small muted">
          <strong style={{ color: "var(--ink)" }}>Where the basemap comes from</strong>
          <p style={{ margin: "6px 0 0" }}>
            OpenStreetMap data, built into vector tiles for this province with
            planetiler and stored in the PMTiles format. The older{" "}
            <code>agusan-del-sur.pmtiles</code> in the repo only covers lat
            7.94 to 8.20 and misses San Francisco, Prosperidad and Bayugan.
          </p>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmSheet
          title={`Delete ${pendingDelete.name}?`}
          body="The archive is removed from this device and the map goes back to no basemap. You can download it again later."
          confirmLabel="Delete basemap"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const id = pendingDelete.id;
            setPendingDelete(null);
            await onDelete(id);
          }}
        />
      )}
    </div>
  );
}
