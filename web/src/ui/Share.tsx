import { useCallback, useEffect, useRef, useState } from "react";
import type { FiberLine, FiberPin, PinEvent, PlaceLabel, RepairLog } from "../domain/models";
import {
  applyBundleImport,
  exportFmapBundle,
  generateCsv,
  generateGeoJson,
  generateKml,
  planBundleImport,
  type BundleImportPlan,
} from "../data/exportImport";
import { chunkPayload, frameToDataUrl, reassembleFrames, type QrFrame } from "../core/qr";
import { useEscape } from "./useEscape";
import { useDialog } from "./useDialog";
import { ImportPreviewSheet } from "./ImportPreviewSheet";

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
  const [plan, setPlan] = useState<BundleImportPlan | null>(null);
  const [bundleJson, setBundleJson] = useState("");
  const [bundleRows, setBundleRows] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);

  // The bundle is read out of the database, tombstones included, so a line
  // deleted on one phone stays deleted on the next. The row count includes the
  // deleted rows: a bundle that only carries deletions is still worth
  // handing over.
  const refreshBundle = useCallback(async () => {
    const json = await exportFmapBundle();
    setBundleJson(json);
    const parsed = JSON.parse(json) as {
      lines?: unknown[];
      pins?: unknown[];
      events?: unknown[];
      repairLogs?: unknown[];
      placeLabels?: unknown[];
    };
    setBundleRows(
      (parsed.lines?.length ?? 0) +
        (parsed.pins?.length ?? 0) +
        (parsed.events?.length ?? 0) +
        (parsed.repairLogs?.length ?? 0) +
        (parsed.placeLabels?.length ?? 0),
    );
  }, []);

  const hasData = bundleRows > 0;

  useEffect(() => {
    void refreshBundle();
  }, [refreshBundle, lines, pins, events, repairLogs, placeLabels]);

  useEscape(() => setPreview(null), preview !== null);
  useDialog(previewRef, preview !== null);

  useEffect(() => {
    setFrames(hasData && bundleJson ? chunkPayload(bundleJson) : []);
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

  /**
   * Reads the bundle and works out what it would do. Nothing is written until
   * the tech has seen the counts and said yes.
   */
  const prepareImport = async (text: string, fromFrames: boolean) => {
    try {
      const next = await planBundleImport(text);
      setPlan(next);
      setImportStatus(null);
      setFrameStatus(null);
    } catch (err) {
      setPlan(null);
      const message = (err as Error).message;
      if (fromFrames) setFrameStatus(`Frames rejected: ${message}`);
      else setImportStatus(`Import refused: ${message}`);
    }
  };

  const confirmImport = async () => {
    if (!plan) return;
    const totals = plan.preview.totals;
    await applyBundleImport(plan);
    setPlan(null);
    setImportText("");
    setFrameText("");
    setImportStatus(
      `Imported ${totals.new} new, ${totals.updated} updated, ${totals.deleted} deleted.`,
    );
    await refreshBundle();
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
      await prepareImport(result.payload, true);
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
              onClick={() => setPreview({ kind: "bundle", content: bundleJson })}
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
            Android APK. You will see what it would change before anything is
            written.
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
            onClick={() => void prepareImport(importText, false)}
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

      {plan && (
        <ImportPreviewSheet
          preview={plan.preview}
          onImport={() => void confirmImport()}
          onCancel={() => setPlan(null)}
        />
      )}

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
