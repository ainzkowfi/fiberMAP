import type { FiberPin, LineWithStats } from "../domain/models";
import { getFiberColor } from "../data/reference";
import { formatChainage } from "../core/geometry";
import { pinFullName } from "../domain/labels";

export interface StripViewProps {
  stats: LineWithStats;
  pins: FiberPin[];
  pinColor: (pin: FiberPin) => string;
  chainageStyle: boolean;
}

/**
 * Linear schematic of a fiber line: the horizontal axis is chainage, the marks
 * are the pins along the route. Mirrors the APK's LinearStripView.
 */
export function StripView({ stats, pins, pinColor, chainageStyle }: StripViewProps) {
  const line = stats.line;
  const total = Math.max(1, line.lengthMapM);
  const pct = (m: number) => Math.min(100, Math.max(0, (m / total) * 100));

  return (
    <div>
      <div
        style={{
          position: "relative",
          height: 72,
          background: "var(--surface-variant)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            top: 38,
            height: 5,
            borderRadius: 3,
            background: getFiberColor(line.colorKey),
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 8,
            fontSize: 10,
            fontWeight: 700,
            color: "var(--muted)",
          }}
        >
          {formatChainage(0, chainageStyle)}
        </div>
        <div
          style={{
            position: "absolute",
            right: 14,
            top: 8,
            fontSize: 10,
            fontWeight: 700,
            color: "var(--muted)",
          }}
        >
          {formatChainage(total, chainageStyle)}
        </div>

        {pins.map((pin) => {
          const left = 14 + (pct(pin.chainageM ?? 0) / 100) * (100 - 2.8);
          const color = pinColor(pin);
          return (
            <div
              key={pin.id}
              title={pinFullName(pin, chainageStyle)}
              style={{
                position: "absolute",
                left: `${left}%`,
                top: pin.type === "CUT_REPAIR" && pin.state === "OPEN" ? 26 : 30,
                width: 20,
                height: 20,
                marginLeft: -10,
                borderRadius: pin.type === "CUT_REPAIR" ? 3 : "50%",
                background: color,
                border: "2px solid var(--surface)",
                transform: "rotate(45deg)",
                boxShadow: "0 0 0 1px rgba(0,0,0,.25)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
