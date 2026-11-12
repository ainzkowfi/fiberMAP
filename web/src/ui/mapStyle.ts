import type { StyleSpecification } from "maplibre-gl";

export type MapTheme = "light" | "dark";

/**
 * Every colour the map draws, in one place, for both themes.
 *
 * The basemap has to follow the app's theme or the crew gets a light map
 * inside a dark app, which is worse than either mode on its own. Each entry
 * is referenced by the layer table below, so adding a layer means adding one
 * colour and one table row.
 */
export const MAP_COLORS: Record<MapTheme, Record<string, string>> = {
  light: {
    background: "#eef1f3",
    muni: "#6f7f89",
    casing: "#ffffff",
    roadCasing: "#c9d2d8",
    otdr: "#ff9800",
    draw: "#0a7c8c",
    me: "#1e88e5",
    landuse: "#e7ede7",
    water: "#a9cfe8",
    boundary: "#a8814d",
  },
  dark: {
    background: "#0c1418",
    muni: "#93a4ad",
    casing: "#162228",
    roadCasing: "#2a353b",
    otdr: "#ffb74d",
    draw: "#35c4d8",
    me: "#5ab4ee",
    landuse: "#1b2620",
    water: "#1d3749",
    boundary: "#8a6a3f",
  },
};

export const BACKGROUND_EXPRESSION: Record<MapTheme, unknown[]> = {
  light: [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    "#dfe5e8",
    10,
    "#eef1f3",
    16,
    "#e8ecee",
  ],
  dark: [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    "#080e11",
    10,
    "#0c1418",
    16,
    "#111b20",
  ],
};

/**
 * Layer id, paint property, and the colour key it takes from MAP_COLORS.
 * Used to build the layers and to repaint them when the theme changes.
 */
/**
 * The paint properties the theme repaints. The names are spelled out rather
 * than typed as plain strings so the map library can check them.
 */
type ThemePaintName =
  | "circle-color"
  | "circle-stroke-color"
  | "fill-color"
  | "line-color";

export const THEME_PAINT: Array<[string, ThemePaintName, string]> = [
  ["ref-muni", "circle-color", "muni"],
  ["fib-line-casing", "line-color", "casing"],
  ["otdr-band", "line-color", "otdr"],
  ["draw-verts", "circle-color", "draw"],
  ["draw-verts", "circle-stroke-color", "casing"],
  ["fib-pin", "circle-stroke-color", "casing"],
  ["me-halo", "circle-color", "me"],
  ["me-dot", "circle-color", "me"],
  ["me-dot", "circle-stroke-color", "casing"],
  ["pmt-landuse", "fill-color", "landuse"],
  ["pmt-water", "fill-color", "water"],
  ["pmt-waterway", "line-color", "water"],
  ["pmt-roads-casing", "line-color", "roadCasing"],  ["pmt-roads", "line-color", "casing"],
  ["pmt-boundaries", "line-color", "boundary"],
];

export function paintValue(theme: MapTheme, key: string): string {
  return MAP_COLORS[theme][key];
}

/**
 * A deliberately dependency-free basemap style. Every source is inline GeoJSON
 * or a PMTiles archive the user mounted, so the map renders with no network.
 */
export const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  name: "fiberMAP Offline",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": BACKGROUND_EXPRESSION.light as never,
      },
    },
  ],
};

/**
 * Minimal style for the bundled archive's schema. Layer names match
 * web/basemap/schema.yml exactly: boundaries, landuse, places, roads, water,
 * waterway. A name that is absent from an archive simply does not render.
 */
export function pmtilesStyleLayers(theme: MapTheme): StyleSpecification["layers"] {
  const c = (key: string) => MAP_COLORS[theme][key];
  return [
    {
      id: "pmt-landuse",
      type: "fill",
      source: "pmtiles",
      "source-layer": "landuse",
      paint: { "fill-color": c("landuse") },
    },
    {
      id: "pmt-water",
      type: "fill",
      source: "pmtiles",
      "source-layer": "water",
      paint: { "fill-color": c("water") },
    },
    {
      id: "pmt-waterway",
      type: "line",
      source: "pmtiles",
      "source-layer": "waterway",
      paint: { "line-color": c("water"), "line-width": 1.5 },
    },
    {
      id: "pmt-roads-casing",
      type: "line",
      source: "pmtiles",
      "source-layer": "roads",
      paint: {
        "line-color": c("roadCasing"),
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 3, 18, 12],
      },
    },
    {
      id: "pmt-roads",
      type: "line",
      source: "pmtiles",
      "source-layer": "roads",
      paint: {
        "line-color": c("casing"),
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.4, 14, 2.2, 18, 10],
      },
    },
    {
      id: "pmt-boundaries",
      type: "line",
      source: "pmtiles",
      "source-layer": "boundaries",
      paint: {
        "line-color": c("boundary"),
        "line-width": 1.5,
        "line-dasharray": [3, 2],
      },
    },
  ];
}
