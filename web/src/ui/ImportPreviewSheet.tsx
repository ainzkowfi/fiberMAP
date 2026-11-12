import { useRef } from "react";
import type { ImportPreview } from "../data/exportImport";
import { useEscape } from "./useEscape";
import { useDialog } from "./useDialog";

export interface ImportPreviewSheetProps {
  preview: ImportPreview;
  onImport: () => void;
  onCancel: () => void;
}

const TABLES: Array<[keyof ImportPreview, string]> = [
  ["lines", "Lines"],
  ["pins", "Pins"],
  ["events", "Events"],
  ["repairLogs", "Repair logs"],
  ["placeLabels", "Names"],
];

/**
 * What an import would do, before it does it.
 *
 * A bundle can be newer than the phone or older than the phone, and the two
 * cases should not look the same. This shows the counts so the tech can see
 * whether the bundle is worth importing before anything is written.
 */
export function ImportPreviewSheet({
  preview,
  onImport,
  onCancel,
}: ImportPreviewSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useEscape(onCancel);
  useDialog(sheetRef);

  const totals = preview.totals;

  return (
    <div className="scrim" onClick={onCancel}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="grow" id="import-preview-title">
            Import this bundle?
          </h2>
          <button className="btn ghost" onClick={onCancel} aria-label="Cancel">
            ✕
          </button>
        </div>

        <div className="sheet-body">
          <div className="stack" style={{ gap: 8 }}>
            {TABLES.map(([key, label]) => {
              const counts = preview[key];
              if (
                !counts.new &&
                !counts.updated &&
                !counts.skipped &&
                !counts.deleted &&
                !counts.restored &&
                !counts.orphaned
              ) {
                return null;
              }
              return (
                <div key={key} className="row between" style={{ gap: 10 }}>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <span className="small muted" style={{ textAlign: "right" }}>
                    {counts.new} new · {counts.updated} updated · {counts.skipped} older ·{" "}
                    {counts.deleted} deleted
                    {counts.restored > 0 && ` · ${counts.restored} brought back`}
                    {counts.orphaned > 0 && ` · ${counts.orphaned} taken down`}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="small muted" style={{ margin: "12px 0 0" }}>
            {totals.new} new, {totals.updated} updated, {totals.skipped} left alone
            because this phone is newer, {totals.deleted} deleted
            {totals.restored > 0 && `, ${totals.restored} parents brought back`}
            {totals.orphaned > 0 && `, ${totals.orphaned} children taken down`}
            {totals.stillDeleted > 0 &&
              `, ${totals.stillDeleted} rows still deleted`}.
          </p>

          {preview.lines.restored > 0 && preview.pins.stillDeleted > 0 && (
            <p className="small muted" style={{ margin: "8px 0 0" }}>
              The line is back, but {preview.pins.stillDeleted} of its pins are
              still deleted and will not come back. Only the pins that were
              edited after the deletion survived.
            </p>
          )}
        </div>

        <div className="sheet-foot">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={onImport}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
