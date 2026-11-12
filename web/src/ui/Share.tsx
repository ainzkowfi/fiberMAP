import { useEffect, useRef, useState } from "react";
import type { FiberLine, FiberPin, PinEvent, PlaceLabel, RepairLog } from "../domain/models";
import {
  generateCsv,
  generateFmapBundleJson,
  generateGeoJson,
  generateKml,
  importFmapBundle,
} from "../data/exportImport";
import { chunkPayload, frameToDataUrl, reassembleFrames, type QrFrame } from "../core/qr";
import { useEscape } from "./useEscape";
import { useDialog } from "./useDialog";

export interface ShareProps {
  lines: FiberLine[];
  pins: FiberPin[];
  events: PinEvent[];
  repairLogs: RepairLog[];
  placeLabels: PlaceLabel[];
}

type Preview =
  | { kind: "bundle" | "geojson" | "kml" | "csv"; content: string }
  | null;

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Share({ lines, pins, events, repairLogs, placeLabels }: ShareProps) {
  const [preview, setPreview] = useState<Preview>(null);
  const [frames, setFrames] = useState<QrFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [frameText, setFrameText] = useState("");
  const [frameStatus, setFrameStatus] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // The export timestamp has to be stable across renders. If it were
  // Date.now() on every render the bundle string would change every render,
  // and the effect that turns it into QR frames would set state from it, and
  // the two would feed each other forever.
  const [exportedAt, setExportedAt] = useState(() => Date.now());

  const bundleJson = generateFmapBundleJson(
    lines,
    pins,
    events,
    repairLogs,
    exportedAt,
    placeLabels,
  );
  const hasData = lines.length > 0 || pins.length > 0 || placeLabels.length > 0;

  useEscape(() => setPreview(null), preview !== null);
  useDialog(previewRef, preview !== null);

  useEffect(() => {
    setFrames(hasData ? chunkPayload(bundleJson) : []);
    setFrameIndex(0);
  }, [bundleJson, hasData]);

  useEffect(() => {
    const frame = frames[frameIndex];
    if (!frame) {
      setQrImage(null);
      return;
    }
    let alive = true;
    void frameToDataUrl(frame).then((url) => {
      if (alive) setQrImage(url);
    });
    return () => {
      alive = false;
    };
  }, [frames, frameIndex]);

  const runImport = async () => {
    try {
      const result = await importFmapBundle(importText);
      setImportStatus(
        `Imported ${result.lines} lines, ${result.pins} pins, ${result.events} events, ${result.repairLogs} repair logs${
          result.placeLabels ? `, ${result.placeLabels} names` : ""
        }.`,
      );
      setImportText("");
    } catch (err) {
      setImportStatus(`Import failed: ${(err as Error).message}`);
    }
  };

  /**
   * The QR frames are compact JSON envelopes. Any phone QR reader can show that
   * text, so the receiving crew pastes the frames here instead of needing a
   * camera scanner inside fiberMAP. Every frame is checksum-verified before a
   * single record is written.
   */
  const runFrameImport = async () => {
    try {
      const envelopes = frameText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { t: string; i: number; n: number; c: number; p: string });
      const result = reassembleFrames(
        envelopes.map((f) => ({
          transferId: f.t,
          index: f.i,
          totalCount: f.n,
          crc32: f.c,
          payload: f.p,
        })),
      );
      if (!result.ok) {
        setFrameStatus(`Frames rejected: ${result.error}`);
        return;
      }
      const imported = await importFmapBundle(result.payload);
      setFrameStatus(
        `Imported ${imported.lines} lines, ${imported.pins} pins, ${imported.events} events, ${imported.repairLogs} repair logs${
          imported.placeLabels ? `, ${imported.placeLabels} names` : ""
        }.`,
      );
      setFrameText("");
    } catch (err) {
      setFrameStatus(`Frames rejected: ${(err as Error).message}`);
    }
  };

  return (
    <div className="scroll" style={{ padding: 14 }}>
      <div className="stack">
        <div className="card">
          <strong>Export</strong>
          <p className="small muted" style={{ margin: "4px 0 12px" }}>
            Everything stays on this device. Exports download as files you can
            hand over or archive.
          </p>
          {!hasData && (
            <div className="empty" style={{ padding: "20px 12px" }}>
              Nothing to export yet. Draw a line or drop a pin and the exports
              will carry it.
            </div>
          )}
          <div className="stack" style={{ gap: 8 }}>
            <button
              className="btn"
              disabled={!hasData}
              onClick={() => {
                // Stamp the export at the moment the crew asks for it.
                const stamp = Date.now();
                setExportedAt(stamp);
                setPreview({
                  kind: "bundle",
                  content: generateFmapBundleJson(
                    lines,
                    pins,
                    events,
                    repairLogs,
                    stamp,
                    placeLabels,
                  ),
                });
              }}
            >
              fiberMAP bundle (JSON)
            </button>
            <button
              className="btn"
              disabled={!hasData}
              onClick={() =>
                setPreview({
                  kind: "geojson",
                  content: generateGeoJson(lines, pins),
                })
              }
            >
              GeoJSON (QGIS / ArcGIS)
            </button>
            <button
              className="btn"
              disabled={!hasData}
              onClick={() =>
                setPreview({ kind: "kml", content: generateKml(lines, pins) })
              }
            >
              KML (Google Earth)
            </button>
            <button
              className="btn"
              disabled={!hasData}
              onClick={() =>
                setPreview({ kind: "csv", content: generateCsv(pins) })
              }
            >
              CSV (pins)
            </button>
          </div>
        </div>

        <div className="card">
          <strong>Technician QR transfer</strong>
          <p className="small muted" style={{ margin: "4px 0 12px" }}>
            {!hasData
              ? "Nothing to transfer yet."
              : frames.length === 0
                ? "Nothing to transfer yet."
                : `Frame ${frames[frameIndex]?.index ?? 0} of ${frames.length}. Scan each frame in order with any QR reader, then paste the decoded text under Import below.`}
          </p>
          <div className="qr-frame">
            {qrImage ? (
              <img
                src={qrImage}
                width={512}
                height={512}
                alt={`QR frame ${frameIndex + 1} of ${frames.length}`}
              />
            ) : (
              <div className="empty">No data</div>
            )}
            <div className="small muted">
              Transfer {frames[frameIndex]?.transferId ?? "n/a"} ·{" "}
              {frames[frameIndex]?.crc32?.toString(16) ?? ""}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn"
                disabled={frameIndex === 0}
                onClick={() => setFrameIndex((i) => Math.max(0, i - 1))}
              >
                ‹ Prev
              </button>
              <button
                className="btn"
                disabled={frameIndex >= frames.length - 1}
                onClick={() => setFrameIndex((i) => Math.min(frames.length - 1, i + 1))}
              >
                Next ›
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <strong>Import bundle</strong>
          <p className="small muted" style={{ margin: "4px 0 12px" }}>
            Paste a fiberMAP bundle JSON, exported from this app or from the
            Android APK. Existing records with the same id are overwritten.
          </p>
          <div className="field">
            <label htmlFor="import-json">Bundle JSON</label>
            <textarea
              id="import-json"
              rows={5}
              placeholder='{ "format": "fiberMAP-bundle", ... }'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          <button
            className="btn primary block"
            disabled={!importText.trim()}
            onClick={() => void runImport()}
            style={{ marginTop: 10 }}
          >
            Import bundle
          </button>
          {importStatus && (
            <div className="small" role="status" style={{ marginTop: 10, color: "var(--jacket)" }}>
              {importStatus}
            </div>
          )}

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="import-frames">Technician QR frames</label>
            <textarea
              id="import-frames"
              rows={4}
              placeholder="Paste one scanned frame per line"
              value={frameText}
              onChange={(e) => setFrameText(e.target.value)}
            />
          </div>
          <button
            className="btn block"
            disabled={!frameText.trim()}
            onClick={() => void runFrameImport()}
          >
            Import scanned frames
          </button>
          {frameStatus && (
            <div className="small" role="status" style={{ marginTop: 10, color: "var(--jacket)" }}>
              {frameStatus}
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div className="scrim" onClick={() => setPreview(null)}>
          <div
            ref={previewRef}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-head">
              <h2 className="grow" id="preview-title">
                {preview.kind.toUpperCase()} preview
              </h2>
              <button
                className="btn ghost"
                onClick={() => setPreview(null)}
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
            <div className="sheet-body">
              <pre className="code">{preview.content}</pre>
            </div>
            <div className="sheet-foot">
              <button
                className="btn primary"
                onClick={() =>
                  download(
                    `fibermap-export.${preview.kind === "bundle" ? "json" : preview.kind}`,
                    preview.content,
                    "text/plain",
                  )
                }
              >
                Download
              </button>
              <button
                className="btn"
                onClick={() => void navigator.clipboard?.writeText(preview.content)}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
