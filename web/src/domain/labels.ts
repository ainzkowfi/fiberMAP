import { PIN_TYPE_INFO, type FiberPin } from "./models";
import { formatChainage } from "../core/geometry";

/**
 * The name and the detail line of a pin.
 *
 * A crew can name their own pins. When they have not, the type stands in for
 * the name and the place goes on the detail line, so a pin is never labelled
 * with the raw enum and the chainage is never printed twice.
 */
export function pinLabelParts(
  pin: FiberPin,
  chainageStyle: boolean,
): { title: string; detail: string } {
  const own = pin.label.trim();
  const title = own || PIN_TYPE_INFO[pin.type].title;
  const detail = [
    own ? PIN_TYPE_INFO[pin.type].title : null,
    pin.chainageM !== null ? formatChainage(pin.chainageM, chainageStyle) : null,
    pin.spliceLossDbm !== null ? `${pin.spliceLossDbm.toFixed(2)} dB` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { title, detail };
}

/** The full name of a pin, for places where it has to stand on its own. */
export function pinFullName(pin: FiberPin, chainageStyle = true): string {
  const own = pin.label.trim();
  if (own) return own;
  const where =
    pin.chainageM !== null
      ? formatChainage(pin.chainageM, chainageStyle)
      : `${pin.lat.toFixed(5)}, ${pin.lon.toFixed(5)}`;
  return `${PIN_TYPE_INFO[pin.type].title} at ${where}`;
}
