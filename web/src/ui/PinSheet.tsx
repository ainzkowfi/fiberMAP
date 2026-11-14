import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FiberPin, FiberLine, PinEvent, PinState, PinType, RepairMethod } from "../domain/models";
import {
  PIN_STATE_TITLE,
  PIN_TYPE_INFO,
  REPAIR_METHOD_TITLE,
} from "../domain/models";
import { formatChainage } from "../core/geometry";
import { pinFullName } from "../domain/labels";
import { pinColor, pinShape } from "./pinShapes";
import { useEscape } from "./useEscape";
import { useDialog } from "./useDialog";
import { useEnter } from "./useEnter";

export interface PinSheetProps {
  pin: FiberPin;
  lines: FiberLine[];
  events: PinEvent[];
  chainageStyle: boolean;
  /** A pin that was just dropped has nothing to show yet, so it opens in the
   *  editor. An existing pin opens read-only. */
  isNew: boolean;
  onClose: () => void;
  onSave: (patch: Partial<FiberPin>) => void;
  onMarkRepaired: (method: RepairMethod, lossDbm: number | null, note: string) => void;
  onDelete: () => void;
}

const PIN_TYPES: PinType[] = [
  "CUT_REPAIR",
  "JOINT_CLOSURE",
  "SPLITTER_NAP",
  "POLE_HANDHOLE",
  "SLACK_COIL",
  "NOTE",
];

const REPAIR_METHODS: RepairMethod[] = ["FUSION", "MECHANICAL", "REPLACED_SECTION"];

export function PinSheet({
  pin,
  lines,
  events,
  chainageStyle,
  isNew,
  onClose,
  onSave,
  onMarkRepaired,
  onDelete,
}: PinSheetProps) {
  const [mode, setMode] = useState<"read" | "edit">(isNew ? "edit" : "read");
  const [label, setLabel] = useState(pin.label);
  const [notes, setNotes] = useState(pin.notes);
  const [type, setType] = useState<PinType>(pin.type);
  const [state, setState] = useState<PinState>(pin.state);
  const [lineId, setLineId] = useState(pin.lineId ?? "");
  const [loss, setLoss] = useState(pin.spliceLossDbm?.toString() ?? "");
  const [coil, setCoil] = useState(pin.coilLengthM.toString());
  const [method, setMethod] = useState<RepairMethod>("FUSION");
  const [repairNote, setRepairNote] = useState("");
  const [showRepair, setShowRepair] = useState(false);

  const pinEvents = events.filter((e) => e.pinId === pin.id);
  const sheetRef = useRef<HTMLDivElement>(null);
  // Show where the pin actually sits: on the line when it snapped, otherwise
  // at the raw field point.
  const shownLat = pin.chainageM !== null ? pin.snapLat : pin.lat;
  const shownLon = pin.chainageM !== null ? pin.snapLon : pin.lon;
  const line = lines.find((l) => l.id === pin.lineId) ?? null;
  const typeInfo = PIN_TYPE_INFO[pin.type];

  const save = () =>
    onSave({
      label,
      notes,
      type,
      state,
      lineId: lineId || null,
      spliceLossDbm: parseFloat(loss) || null,
      coilLengthM: parseFloat(coil) || 0,
    });

  const confirmRepair = () => {
    const parsed = parseFloat(loss);
    onMarkRepaired(method, Number.isFinite(parsed) ? parsed : null, repairNote);
    setShowRepair(false);
  };

  // Enter in a field submits the action that is in front of the crew. When
  // the repair form is open, that is the repair; otherwise it is the save.
  useEnter(() => (showRepair ? confirmRepair() : save()));

  // A repair confirmed in the panel updates the stored pin. The chips read
  // the stored state, never a local guess.
  useEffect(() => setState(pin.state), [pin.state]);

  useEscape(onClose);
  useDialog(sheetRef);

  const stateTagClass =
    pin.state === "OPEN" ? "tag cut" : pin.state === "REPAIRED" ? "tag repaired" : "tag";

  return (
    <div className="scrim" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <span
            className={`pin pin-${pinShape(pin)}`}
            style={{ "--pin-color": pinColor(pin) } as CSSProperties}
            aria-hidden="true"
          >
            <span className="pin-core" />
          </span>
          <h2 className="grow" id="pin-sheet-title">
            {typeInfo.title}
          </h2>
          <span className={stateTagClass}>{PIN_STATE_TITLE[pin.state]}</span>
          <button className="btn ghost" onClick={onClose} aria-label="Close pin detail">
            ✕
          </button>
        </div>

        {mode === "read" ? (
          <>
            <div className="sheet-body">
              <div>
                <h3 className="detail-title">
                  {pin.label || pinFullName(pin, chainageStyle)}
                </h3>
                <div className="small muted">{typeInfo.title}</div>
              </div>

              <div className="detail-group">
                <div className="detail-label">Where</div>
                <div className="kv">
                  <span className="muted">Fiber line</span>
                  <strong>{line?.name ?? "Off-road point"}</strong>
                </div>
                <div className="kv">
                  <span className="muted">Chainage from start</span>
                  <strong>
                    {pin.chainageM !== null
                      ? formatChainage(pin.chainageM, chainageStyle)
                      : "Not on a line"}
                  </strong>
                </div>
                <div className="kv">
                  <span className="muted">Coordinates</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {shownLat.toFixed(5)}°N, {shownLon.toFixed(5)}°E
                  </span>
                </div>
              </div>

              <div className="detail-group">
                <div className="detail-label">Details</div>
                <div className="kv">
                  <span className="muted">Type</span>
                  <strong>
                    {typeInfo.title} ({typeInfo.shortCode})
                  </strong>
                </div>
                <div className="kv">
                  <span className="muted">State</span>
                  <strong>{PIN_STATE_TITLE[pin.state]}</strong>
                </div>
                {pin.spliceLossDbm !== null && (
                  <div className="kv">
                    <span className="muted">Splice loss</span>
                    <strong>{pin.spliceLossDbm.toFixed(2)} dB</strong>
                  </div>
                )}
                {pin.coilLengthM > 0 && (
                  <div className="kv">
                    <span className="muted">Slack length</span>
                    <strong>{Math.round(pin.coilLengthM)} m</strong>
                  </div>
                )}
                {pin.gpsAccuracyM !== null && (
                  <div className="kv">
                    <span className="muted">GPS accuracy</span>
                    <strong>±{pin.gpsAccuracyM.toFixed(0)} m</strong>
                  </div>
                )}
              </div>

              {pin.notes && (
                <div className="detail-group">
                  <div className="detail-label">Field notes</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{pin.notes}</div>
                </div>
              )}

              {pinEvents.length > 0 && (
                <div className="detail-group">
                  <div className="detail-label">History</div>
                  <div className="timeline">
                    {pinEvents.map((ev) => (
                      <div key={ev.id}>
                        <span
                          className="dot"
                          style={{
                            background:
                              ev.kind === "repaired"
                                ? "var(--repaired)"
                                : ev.kind === "cut"
                                  ? "var(--cut)"
                                  : "var(--jacket)",
                          }}
                        />
                        <div className="small">
                          <strong>{ev.kind.toUpperCase()}</strong>{" "}
                          <span className="muted">
                            {new Date(ev.eventDate).toLocaleString()}
                          </span>
                          {ev.note && <div className="muted">{ev.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sheet-foot">
              <button className="btn danger" onClick={onDelete} aria-label="Delete pin">
                Delete
              </button>
              {pin.type === "CUT_REPAIR" && pin.state === "OPEN" && (
                <button className="btn" onClick={() => { setMode("edit"); setShowRepair(true); }}>
                  Log repair
                </button>
              )}
              <button className="btn primary" onClick={() => setMode("edit")}>
                Edit
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sheet-body">
              <div className="field">
                <label htmlFor="pin-label">Label / title</label>
                <input
                  id="pin-label"
                  placeholder={pinFullName(pin, chainageStyle)}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="pin-type">Type</label>
                <select
                  id="pin-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as PinType)}
                >
                  {PIN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PIN_TYPE_INFO[t].title} ({PIN_TYPE_INFO[t].shortCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="pin-line">Assign to line</label>
                <select
                  id="pin-line"
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                >
                  <option value="">Off-road point</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>State</label>
                <div className="chips">
                  <button
                    className="chip"
                    aria-pressed={state === "OPEN"}
                    onClick={() => setState("OPEN")}
                  >
                    Open break / cut
                  </button>
                  <button
                    className="chip"
                    aria-pressed={state === "REPAIRED"}
                    onClick={() => setShowRepair(true)}
                    title="A repair needs its method and splice loss, so this opens the repair form"
                  >
                    Repaired / spliced
                  </button>
                  <button
                    className="chip"
                    aria-pressed={state === "NONE"}
                    onClick={() => setState("NONE")}
                  >
                    Normal
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="pin-loss">Measured optical splice loss (dB)</label>
                <input
                  id="pin-loss"
                  inputMode="decimal"
                  placeholder="0.01"
                  value={loss}
                  onChange={(e) => setLoss(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="pin-coil">Slack coil length (m)</label>
                <input
                  id="pin-coil"
                  inputMode="decimal"
                  value={coil}
                  onChange={(e) => setCoil(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="pin-notes">Field notes / landmarks / client</label>
                <textarea
                  id="pin-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {showRepair && (
                <div className="card stack" style={{ gap: 10 }}>
                  <strong>Log splice repair</strong>
                  <div className="field">
                    <label>Repair method</label>
                    <div className="chips">
                      {REPAIR_METHODS.map((m) => (
                        <button
                          key={m}
                          className="chip"
                          aria-pressed={method === m}
                          onClick={() => setMethod(m)}
                        >
                          {REPAIR_METHOD_TITLE[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="repair-loss">Splice loss (dB)</label>
                    <input
                      id="repair-loss"
                      inputMode="decimal"
                      placeholder="0.01"
                      value={loss}
                      onChange={(e) => setLoss(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="repair-note">Technician note / closure tag</label>
                    <input
                      id="repair-note"
                      value={repairNote}
                      onChange={(e) => setRepairNote(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn primary block"
                    onClick={() => {
                      const parsed = parseFloat(loss);
                      onMarkRepaired(method, Number.isFinite(parsed) ? parsed : null, repairNote);
                      setShowRepair(false);
                    }}
                  >
                    Confirm repair
                  </button>
                </div>
              )}
            </div>

            <div className="sheet-foot">
              <button className="btn" onClick={() => setMode("read")}>
                Cancel
              </button>
              <button className="btn primary" onClick={save}>
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
