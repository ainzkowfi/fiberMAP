import { useMemo, useRef, useState } from "react";
import type { FiberLine, FiberPin } from "../domain/models";
import {
  computeCumulativeDistances,
  formatChainage,
  otdrToMapLocation,
  type OtdrMapMatch,
} from "../core/geometry";
import { useEscape } from "./useEscape";
import { useDialog } from "./useDialog";
import { useSetting } from "../data/hooks";
import { useEnter } from "./useEnter";

export interface OtdrDialogProps {
  line: FiberLine;
  pins: FiberPin[];
  chainageStyle: boolean;
  onClose: () => void;
  onLocateOnMap: (match: OtdrMapMatch) => void;
  onDropCutPinAtOtdr: (match: OtdrMapMatch) => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

export function OtdrDialog({
  line,
  pins,
  chainageStyle,
  onClose,
  onLocateOnMap,
  onDropCutPinAtOtdr,
}: OtdrDialogProps) {
  const [input, setInput] = useState("");
  const [fromEnd, setFromEnd] = useState(false);
  // The launch cable is the same on every job, so the last one is kept.
  const [offset, setOffset] = useSetting("otdrOffset", "0");
  const sheetRef = useRef<HTMLDivElement>(null);

  const otdrM = parseFloat(input) || 0;
  const offsetM = parseFloat(offset) || 0;

  const match = useMemo(() => {
    if (otdrM <= 0 || line.vertices.length < 2) return null;
    const coils = pins
      .filter((p) => p.chainageM !== null && p.coilLengthM > 0)
      .map((p) => [p.chainageM as number, p.coilLengthM] as [number, number]);
    return otdrToMapLocation(
      otdrM,
      fromEnd,
      line.slackPercent,
      coils,
      line.vertices,
      computeCumulativeDistances(line.vertices),
      0.03,
      offsetM,
    );
  }, [otdrM, fromEnd, line, pins, offsetM]);

  const press = (key: string) => setInput((v) => v + key);

  useEscape(onClose);
  useDialog(sheetRef);
  // Enter shows the solved location, which is the first thing to check.
  useEnter(() => {
    if (match) onLocateOnMap(match);
  });

  return (
    <div className="scrim" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="otdr-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="grow" id="otdr-title">
            Find by OTDR distance
          </h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close OTDR dialog">
            ✕
          </button>
        </div>

        <div className="sheet-body">
          <div className="small muted">{line.name}</div>

          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {input || "0"} <span className="small muted">m</span>
            </div>            <div className="small muted">
              Map chainage{" "}
              <strong style={{ color: "var(--ink)" }}>
                {match ? formatChainage(match.targetMapDistanceM, chainageStyle) : "n/a"}
              </strong>
            </div>
            {match && match.coilsPassedM > 0 && (
              <div className="small muted">
                Subtracted {match.coilsPassedM.toFixed(0)} m from intermediate slack coils
              </div>
            )}
            {match && (
              <div className="small muted">
                ±{((match.maxMapDistanceM - match.minMapDistanceM) / 2).toFixed(0)} m uncertainty
              </div>
            )}
          </div>

          <div className="chips">
            <button
              className="chip"
              aria-pressed={!fromEnd}
              onClick={() => setFromEnd(false)}
            >
              From start
            </button>
            <button
              className="chip"
              aria-pressed={fromEnd}
              onClick={() => setFromEnd(true)}
            >
              From end
            </button>
          </div>

          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="otdr-offset">Launch cable / pigtail offset (m)</label>
            <input
              id="otdr-offset"
              inputMode="decimal"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
              placeholder="0"
            />
            <div className="small muted" style={{ marginTop: 4 }}>
              Cable between the OTDR and the fiber under test. It is taken off
              the reading before the solve.
            </div>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {[KEYS.slice(0, 3), KEYS.slice(3, 6), KEYS.slice(6, 9)].map((row, i) => (
              <div className="row" key={i} style={{ gap: 8 }}>
                {row.map((k) => (
                  <button
                    key={k}
                    className="btn grow"
                    style={{ fontSize: 18 }}
                    onClick={() => press(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            ))}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn grow" onClick={() => setInput("")}>
                Clear
              </button>
              <button className="btn grow" onClick={() => setInput((v) => v + "0")}>
                0
              </button>
              <button className="btn grow" onClick={() => setInput((v) => v.slice(0, -1))}>
                ⌫
              </button>
            </div>
          </div>
        </div>

        <div className="sheet-foot">
          <button
            className="btn"
            disabled={!match}
            onClick={() => match && onLocateOnMap(match)}
          >
            Show on map
          </button>
          <button
            className="btn primary"
            disabled={!match}
            onClick={() => match && onDropCutPinAtOtdr(match)}
          >
            Drop cut pin
          </button>
        </div>
      </div>
    </div>
  );
}
