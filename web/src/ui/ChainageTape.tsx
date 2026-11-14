import type { FiberPin } from "../domain/models";
import { formatChainage } from "../core/geometry";
import { pinFullName } from "../domain/labels";

const STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];

/** A graduation spacing that lands between six and twelve marks on the tape. */
function niceStep(lengthM: number): number {
  const raw = lengthM / 8;
  for (const step of STEPS) if (raw <= step) return step;
  return STEPS[STEPS.length - 1];
}

export interface ChainageTapeProps {
  lengthM: number;
  pins: FiberPin[];
  pinColor: (pin: FiberPin) => string;
  lineColor: string;
  chainageStyle: boolean;
  onPinClick?: (pin: FiberPin) => void;
  /** The map strip shows the total in its own header, so the caption is off. */
  hideCaption?: boolean;
}

/**
 * The line as a measuring tape.
 *
 * Chainage is the spine of every record in this app: the OTDR reads it, the
 * cable total is built from it, and every pin carries one. Drawing the line
 * as a ruler puts the pins at their true distance instead of in a list, so a
 * tech sees "the cut is two thirds along" without reading anything.
 */
export function ChainageTape({
  lengthM,
  pins,
  pinColor,
  lineColor,
  chainageStyle,
  onPinClick,
  hideCaption,
}: ChainageTapeProps) {
  const total = Math.max(1, lengthM);
  const pct = (m: number) => Math.min(100, Math.max(0, (m / total) * 100));
  const step = niceStep(total);
  const ticks: number[] = [];
  for (let m = 0; m <= total + 0.001; m += step) ticks.push(m);

  const marked = pins
    .filter((p) => p.chainageM !== null)
    .sort((a, b) => (a.chainageM ?? 0) - (b.chainageM ?? 0));

  return (
    <div>
      <div className="tape" style={{ height: 62 }}>
        <div className="tape-track" />
        <div className="tape-line" style={{ background: lineColor }} />
        {ticks.map((m) => (
          <div
            key={m}
            className={`tape-tick${m % (step * 2) === 0 ? " major" : ""}`}
            style={{ left: `${pct(m)}%` }}
          />
        ))}
        {ticks
          .filter((m) => m % (step * 2) === 0 && m > 0 && m < total)
          .map((m) => (
            <div
              key={`l${m}`}
              className="tape-label"
              style={{ left: `${pct(m)}%`, transform: "translateX(-50%)" }}
            >
              {formatChainage(m, chainageStyle)}
            </div>
          ))}
        {marked.map((pin) => {
          const open = pin.type === "CUT_REPAIR" && pin.state === "OPEN";
          const style = {
            left: `${pct(pin.chainageM ?? 0)}%`,
            background: pinColor(pin),
          };
          if (!onPinClick) {
            return (
              <div
                key={pin.id}
                className={`tape-mark${open ? "" : " round"}`}
                style={style}
                title={pinFullName(pin, chainageStyle)}
              />
            );
          }
          return (
            <button
              key={pin.id}
              type="button"
              className={`tape-mark${open ? "" : " round"}`}
              style={style}
              aria-label={pinFullName(pin, chainageStyle)}
              title={pinFullName(pin, chainageStyle)}
              onClick={() => onPinClick(pin)}
            />
          );
        })}
      </div>
      {!hideCaption && (
        <div className="tape-caption">
          <span>{formatChainage(0, chainageStyle)}</span>
          <span>{formatChainage(total, chainageStyle)}</span>
        </div>
      )}
    </div>
  );
}
