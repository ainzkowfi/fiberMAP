import type { LineStatus } from "../domain/models";
import { LINE_STATUS_TITLE } from "../domain/models";
import { getFiberColor } from "../data/reference";
import { useDialog } from "./useDialog";
import { useEscape } from "./useEscape";
import { useRef } from "react";

export interface WiresRow {
  id: string;
  name: string;
  status: LineStatus;
  colorKey: string;
  lengthLabel: string;
  pins: number;
  openCuts: number;
}

export interface WiresSheetProps {
  rows: WiresRow[];
  /** The wire the crew actually tapped. */
  tappedId: string | null;
  /** Focus this wire on the map without opening its record. */
  onPick: (id: string) => void;
  onClose: () => void;
}

/**
 * The wires that share one path.
 *
 * Two cables on the same road look like one line on a map. When the crew
 * taps that road, this lists every line recorded along it, so the right one
 * can be picked instead of guessed.
 */
export function WiresSheet({
  rows,
  tappedId,
  onPick,
  onClose,
}: WiresSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useDialog(sheetRef);

  return (
    <div className="scrim" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wires-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="grow" id="wires-title">
            Wires on this path
          </h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sheet-body">
          <div className="small muted">
            {rows.length} lines run this route. Pick one to show it on the map.
          </div>
          <div className="detail-group">
            {rows.map((row) => (
              <button
                key={row.id}
                className="list-item"
                onClick={() => onPick(row.id)}
              >
                <span
                  className="swatch"
                  style={{ background: getFiberColor(row.colorKey) }}
                />
                <span className="grow" style={{ textAlign: "left" }}>
                  <span style={{ fontWeight: 600, display: "block" }}>
                    {row.name}
                    {row.id === tappedId && (
                      <span className="small muted"> · tapped</span>
                    )}
                  </span>
                  <span className="small muted">
                    {row.lengthLabel} · {row.pins} pins
                    {row.openCuts > 0 && ` · ${row.openCuts} open`}
                  </span>
                </span>
                <span className={`tag${row.status === "DAMAGED" ? " cut" : row.status === "PLANNED" ? " planned" : ""}`}>
                  {LINE_STATUS_TITLE[row.status]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-foot">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
