import type { FiberPin, LineWithStats, RepairLog } from "../domain/models";
import { LINE_STATUS_TITLE, REPAIR_METHOD_TITLE } from "../domain/models";
import { formatChainage } from "../core/geometry";
import { pinLabelParts } from "../domain/labels";
import { getFiberColor } from "../data/reference";
import { ChainageTape } from "./ChainageTape";

export interface OtherWire {
  id: string;
  name: string;
  lengthLabel: string;
}

export interface LineDetailProps {
  stats: LineWithStats;
  pins: FiberPin[];
  repairLogs: RepairLog[];
  chainageStyle: boolean;
  pinColor: (pin: FiberPin) => string;
  /** Other lines recorded along the same path as this one. */
  otherWires: OtherWire[];
  onBack: () => void;
  onViewOnMap: () => void;
  onFindByDistance: () => void;
  onContinueLine: () => void;
  onAddSlackLoop: () => void;
  onPinClicked: (pin: FiberPin) => void;
  onOpenOtherWire: (lineId: string) => void;
  onDeleteLine: () => void;
}

/**
 * The line record.
 *
 * A tech opening a line in the field wants three things: what is this route,
 * how long is it, and what is broken on it. Everything else is a scroll away
 * in the pins and the repair log. The old screen answered with nine numbers
 * and two timelines, which is a spreadsheet, not a record sheet.
 */
export function LineDetail({
  stats,
  pins,
  repairLogs,
  chainageStyle,
  pinColor,
  otherWires,
  onBack,
  onViewOnMap,
  onFindByDistance,
  onContinueLine,
  onAddSlackLoop,
  onPinClicked,
  onOpenOtherWire,
  onDeleteLine,
}: LineDetailProps) {
  const line = stats.line;
  const slackLoops = pins.filter((p) => p.type === "SLACK_COIL");
  const otherPins = pins.filter((p) => p.type !== "SLACK_COIL");
  const totalSlackM = slackLoops.reduce((sum, p) => sum + p.coilLengthM, 0);

  return (
    <div className="scroll" style={{ padding: 14 }}>
      <div className="stack">
        <div className="row between">
          <button className="btn ghost" onClick={onBack}>
            ← Back
          </button>
          <span className="tag">{LINE_STATUS_TITLE[line.status]}</span>
        </div>

        <div className="card">
          <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.2 }}>{line.name}</h2>
          <p className="small muted" style={{ margin: "3px 0 12px" }}>
            {line.fiberType} · {line.coreCount ?? 24} cores
          </p>

          <ChainageTape
            lengthM={line.lengthMapM}
            pins={pins}
            pinColor={pinColor}
            lineColor={getFiberColor(line.colorKey)}
            chainageStyle={chainageStyle}
            onPinClick={onPinClicked}
          />

          <div className="figures" style={{ marginTop: 12 }}>
            <div>
              <div className="k">Length</div>
              <div className="v">{formatChainage(line.lengthMapM, chainageStyle)}</div>
            </div>
            <div>
              <div className="k">Cable</div>
              <div className="v">
                {formatChainage(stats.totalCableLengthM, chainageStyle)}
              </div>
            </div>
            <div>
              <div className="k">Cuts</div>
              <div className="v">{stats.totalCuts}</div>
            </div>
            <div>
              <div className="k">Open</div>
              <div
                className="v"
                style={stats.openCuts > 0 ? { color: "var(--cut)" } : undefined}
              >
                {stats.openCuts}
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary grow" onClick={onViewOnMap}>
              View on map
            </button>
            <button className="btn grow" onClick={onFindByDistance}>
              Find by OTDR
            </button>
          </div>
          <button className="link-action" onClick={onContinueLine}>
            Extend this line
            <span className="small muted">draw more corners onto the same route</span>
          </button>
        </div>

        {otherWires.length > 0 && (
          <div className="card">
            <div className="section-head">
              <h3>Other wires on this path ({otherWires.length})</h3>
            </div>
            <div className="detail-group">
              {otherWires.map((wire) => (
                <button
                  key={wire.id}
                  className="list-item"
                  onClick={() => onOpenOtherWire(wire.id)}
                >
                  <span className="grow" style={{ textAlign: "left" }}>
                    <span style={{ fontWeight: 600, display: "block" }}>{wire.name}</span>
                    <span className="small muted">{wire.lengthLabel}</span>
                  </span>
                  <span className="small muted">Open</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {line.notes && (
          <div className="card">
            <div style={{ whiteSpace: "pre-wrap" }}>{line.notes}</div>
          </div>
        )}

        <div className="card">
          <div className="section-head">
            <h3>Slack loops ({slackLoops.length})</h3>
            <span className="small muted">{Math.round(totalSlackM)} m spare</span>
          </div>
          {slackLoops.length === 0 ? (
            <div className="small muted">No slack loops recorded.</div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {slackLoops.map((pin) => (
                <button
                  key={pin.id}
                  className="list-item"
                  onClick={() => onPinClicked(pin)}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: pinColor(pin),
                      flex: "none",
                    }}
                  />
                  <span className="grow" style={{ textAlign: "left" }}>
                    <span style={{ fontWeight: 600, display: "block" }}>
                      {pin.coilLengthM.toFixed(0)} m of slack
                    </span>
                    <span className="small muted">
                      {pin.chainageM !== null
                        ? formatChainage(pin.chainageM, chainageStyle)
                        : "Off-line point"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <button className="btn block" style={{ marginTop: 12 }} onClick={onAddSlackLoop}>
            Add slack loop
          </button>
        </div>

        <div className="card">
          <div className="section-head">
            <h3>Pins ({otherPins.length})</h3>
          </div>
          {otherPins.length === 0 ? (
            <div className="small muted">No other pins on this line yet.</div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {otherPins.map((pin) => {
                const { title, detail } = pinLabelParts(pin, chainageStyle);
                return (
                  <button
                    key={pin.id}
                    className="list-item"
                    onClick={() => onPinClicked(pin)}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        background: pinColor(pin),
                        flex: "none",
                      }}
                    />
                    <span className="grow" style={{ textAlign: "left" }}>
                      <span style={{ fontWeight: 600, display: "block" }}>{title}</span>
                      {detail && <span className="small muted">{detail}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-head">
            <h3>Repair log ({repairLogs.length})</h3>
          </div>
          {repairLogs.length === 0 ? (
            <div className="small muted" style={{ marginTop: 6 }}>
              No closed repairs recorded.
            </div>
          ) : (
            <div className="timeline" style={{ marginTop: 10 }}>
              {repairLogs.map((log) => (
                <div key={log.id}>
                  <span className="dot" />
                  <div className="small">
                    <strong>{log.fiberCutLocation}</strong>
                    <div className="muted">
                      {new Date(log.repairTimestamp).toLocaleString()} ·{" "}
                      {log.spliceLossDbm.toFixed(2)} dB ·{" "}
                      {REPAIR_METHOD_TITLE[log.repairMethod]}
                      {log.closureTag && ` · ${log.closureTag}`}
                    </div>
                    {log.notes && <div className="muted">{log.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn danger block" onClick={onDeleteLine}>
          Delete fiber line
        </button>
      </div>
    </div>
  );
}
