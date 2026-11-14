import type { FiberPin } from "../domain/models";

/**
 * How a pin tells you what it is.
 *
 * A crew reads the map by shape first and colour second: a square is a NAP,
 * a diamond is a cut. Every pin type gets its own shape and its own colour,
 * and the legend on the map says which is which.
 */
export type PinShape = "diamond" | "square" | "hexagon" | "triangle" | "circle" | "dot";

export function pinShape(pin: FiberPin): PinShape {
  switch (pin.type) {
    case "CUT_REPAIR":
      return "diamond";
    case "SPLITTER_NAP":
      return "square";
    case "JOINT_CLOSURE":
      return "hexagon";
    case "POLE_HANDHOLE":
      return "triangle";
    case "SLACK_COIL":
      return "circle";
    default:
      return "dot";
  }
}

export function pinColor(pin: FiberPin): string {
  if (pin.type === "CUT_REPAIR" && pin.state === "OPEN") return "#c8372d";
  if (pin.type === "CUT_REPAIR" && pin.state === "REPAIRED") return "#2f8f5b";
  if (pin.type === "SLACK_COIL") return "#f5a623";
  if (pin.type === "SPLITTER_NAP") return "#00b4d8";
  if (pin.type === "JOINT_CLOSURE") return "#0a7c8c";
  if (pin.type === "POLE_HANDHOLE") return "#6b7a84";
  return "#8a99a2";
}

export interface LegendItem {
  label: string;
  shape: PinShape;
  color: string;
}

/** The key that floats on the map. Order matches how a crew scans a route. */
export const PIN_LEGEND: LegendItem[] = [
  { label: "Cut, open", shape: "diamond", color: "#c8372d" },
  { label: "Cut, repaired", shape: "diamond", color: "#2f8f5b" },
  { label: "Splitter / NAP", shape: "square", color: "#00b4d8" },
  { label: "Joint closure", shape: "hexagon", color: "#0a7c8c" },
  { label: "Pole / handhole", shape: "triangle", color: "#6b7a84" },
  { label: "Slack coil", shape: "circle", color: "#f5a623" },
  { label: "Field note", shape: "dot", color: "#8a99a2" },
];
