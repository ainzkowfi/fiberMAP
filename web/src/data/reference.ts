import type { GeoPoint } from "../core/geometry";

export interface Municipality {
  name: string;
  point: GeoPoint;
  isCapitalOrHub: boolean;
}

/**
 * Place names only. The app does not ship hardcoded routes: the AH26 corridor
 * and the Agusan River used to be drawn as lines, but a baked-in route looks
 * exactly like a fibre line the crew owns. Real geography comes from the OSM
 * basemap archive.
 */
export const MUNICIPALITIES: Municipality[] = [
  { name: "San Francisco", point: { lat: 8.5085, lon: 125.9772 }, isCapitalOrHub: true },
  { name: "Prosperidad (Patin-ay)", point: { lat: 8.583, lon: 125.918 }, isCapitalOrHub: true },
  { name: "Bayugan City", point: { lat: 8.712, lon: 125.748 }, isCapitalOrHub: true },
  { name: "Rosario", point: { lat: 8.351, lon: 126.002 }, isCapitalOrHub: false },
  { name: "Bunawan", point: { lat: 8.175, lon: 125.998 }, isCapitalOrHub: false },
  { name: "Trento", point: { lat: 8.048, lon: 126.062 }, isCapitalOrHub: false },
  { name: "Talacogon", point: { lat: 8.452, lon: 125.789 }, isCapitalOrHub: false },
  { name: "Esperanza", point: { lat: 8.675, lon: 125.652 }, isCapitalOrHub: false },
  { name: "La Paz", point: { lat: 8.278, lon: 125.811 }, isCapitalOrHub: false },
];

/** 12-strand fiber color code. */
export const FIBER_COLORS: Record<string, string> = {
  blue: "#0066CC",
  orange: "#FF7A00",
  green: "#00A854",
  brown: "#8B5A2B",
  slate: "#708090",
  white: "#E2E8F0",
  red: "#D9383A",
  black: "#2D3748",
  yellow: "#F5A623",
  violet: "#8E44AD",
  rose: "#E84393",
  aqua: "#00B4D8",
};

export function getFiberColor(colorKey: string): string {
  return FIBER_COLORS[colorKey.toLowerCase()] ?? FIBER_COLORS.blue;
}
