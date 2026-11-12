import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Map as MapLibreMapClass,
  Marker,
  Popup,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MUNICIPALITIES } from "../data/reference";
import { getFiberColor } from "../data/reference";
import type { FiberLine, FiberPin, PlaceLabel } from "../domain/models";
import type { GeoPoint } from "../core/geometry";
import {
  BACKGROUND_EXPRESSION,
  MAP_COLORS,
  OFFLINE_STYLE,
  THEME_PAINT,
  pmtilesStyleLayers,
  type MapTheme,
} from "./mapStyle";
import { addPmTilesSource, ensurePmTilesProtocol } from "./pmtilesLoader";
import { LineBubble, type LineBubbleData } from "./LineBubble";
import { useEscape } from "./useEscape";

const SRC_MUNI = "ref-muni";
const SRC_LINES = "fib-lines";
const SRC_PINS = "fib-pins";
const SRC_DRAW = "draw-verts";
const SRC_OTDR = "otdr-band";
const SRC_ME = "me";

function featureCollection(features: unknown[]) {
  return { type: "FeatureCollection", features } as never;
}

function lineFeature(coords: GeoPoint[], props: Record<string, unknown>) {
  return {
    type: "Feature",
    properties: props,
    geometry: { type: "LineString", coordinates: coords.map((c) => [c.lon, c.lat]) },
  };
}

export interface MapViewProps {
  lines: FiberLine[];
  pins: FiberPin[];
  /** The numbers the tap bubble shows, one entry per line. */
  lineBubbles: LineBubbleData[];
  selectedLineId: string | null;
  selectedPinId: string | null;
  focus: { lat: number; lon: number; zoom: number } | null;
  drawMode: boolean;
  drawVertices: GeoPoint[];
  userLocation: { lat: number; lon: number; accuracyM: number } | null;
  otdrBand: { min: GeoPoint; target: GeoPoint; max: GeoPoint; label: string } | null;
  handedness: "left" | "right";
  /** Key of the mounted PMTiles archive, or null for the synthetic basemap. */
  basemapKey: string | null;
  /** Theme the map paints in. It follows the app theme, not its own. */
  theme: MapTheme;
  /**
   * When true the map keeps itself centred on the GPS position. Panning the
   * map by hand turns this off, which is what every field map does.
   */
  followMe: boolean;
  onMapClick: (pt: GeoPoint) => void;
  onLongPress: (pt: GeoPoint) => void;
  onPinClick: (pin: FiberPin) => void;
  /** The names the crew put on the map themselves. */
  placeLabels: PlaceLabel[];
  /** True while the crew is choosing where to put a name. */
  placingPlace: boolean;
  /** The crew tapped the map to put a name down. */
  onPlaceTapped: (pt: GeoPoint) => void;
  /** The crew tapped one of their own names. */
  onPlaceLabelClick: (id: string) => void;
  /** Opens the full record of a line tapped on the map. */
  onLineOpen: (lineId: string) => void;
  onFocusConsumed: () => void;
  /** Fired when the crew pans the map by hand, so follow mode can switch off. */
  onUserMovedMap: () => void;
  /** Turns follow mode on or off. */
  onToggleFollow: () => void;
  /** Arms or disarms the "name a place" mode. */
  onTogglePlaceMode: () => void;
  /** Geolocation failure. A declined prompt is the common one, and it used to be silent. */
  locationError: string | null;
}

export function MapView({
  lines,
  pins,
  lineBubbles,
  selectedLineId,
  selectedPinId,
  focus,
  drawMode,
  drawVertices,
  userLocation,
  otdrBand,
  handedness,
  basemapKey,
  theme,
  followMe,
  onMapClick,
  onLongPress,
  onPinClick,
  placeLabels,
  placingPlace,
  onPlaceTapped,
  onPlaceLabelClick,
  onLineOpen,
  onFocusConsumed,
  onUserMovedMap,
  onToggleFollow,
  onTogglePlaceMode,
  locationError,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(13);
  const [center, setCenter] = useState({ lat: 8.5085, lon: 125.9772 });

  // The bubble that opens when a crew taps one of their own lines.
  const [lineBubble, setLineBubble] = useState<{
    data: LineBubbleData;
    lngLat: [number, number];
  } | null>(null);
  const bubbleRef = useRef<{
    popup: Popup;
    root: ReturnType<typeof createRoot>;
  } | null>(null);
  const bubblesRef = useRef(lineBubbles);
  bubblesRef.current = lineBubbles;

  useEscape(() => setLineBubble(null), lineBubble !== null);

  // Latest callbacks for the map event handlers, which are registered once.
  const handlers = useRef({
    onMapClick,
    onLongPress,
    onPinClick,
    onPlaceTapped,
    onPlaceLabelClick,
    onUserMovedMap,
    drawMode,
    placingPlace,
  });
  handlers.current = {
    onMapClick,
    onLongPress,
    onPinClick,
    onPlaceTapped,
    onPlaceLabelClick,
    onUserMovedMap,
    drawMode,
    placingPlace,
  };

  // The map event handlers are registered once, so they read the current pins
  // through a ref. Reading the prop directly would search the empty list the
  // map was created with, and tapping a pin would do nothing.
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  // The map is created once, so it reads the theme through a ref and repaints
  // from the effect below when the theme changes.
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const c = (key: string) => MAP_COLORS[themeRef.current][key];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // The PMTiles protocol has to exist before the map is created, so the
    // archive can be served the moment the style asks for it.
    ensurePmTilesProtocol();

    const map = new MapLibreMapClass({
      container: containerRef.current,
      style: OFFLINE_STYLE as never,
      center: [125.9772, 8.5085],
      zoom: 13,
      minZoom: 8,
      maxZoom: 18,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      // Only the crew's own fibre lines and pins are drawn from local data.
      // Real geography comes from the OSM basemap archive, so the app does
      // not hardcode its own copies of the AH26 corridor or the Agusan River:
      // a hardcoded route looks exactly like a fibre line and the crew does
      // not own it.
      map.addSource(SRC_MUNI, {
        type: "geojson",
        data: featureCollection(
          MUNICIPALITIES.map((m) => ({
            type: "Feature",
            properties: { name: m.name, hub: m.isCapitalOrHub },
            geometry: { type: "Point", coordinates: [m.point.lon, m.point.lat] },
          })),
        ),
      });
      map.addSource(SRC_LINES, { type: "geojson", data: featureCollection([]) });
      map.addSource(SRC_PINS, { type: "geojson", data: featureCollection([]) });
      map.addSource(SRC_DRAW, { type: "geojson", data: featureCollection([]) });
      map.addSource(SRC_OTDR, { type: "geojson", data: featureCollection([]) });
      map.addSource(SRC_ME, { type: "geojson", data: featureCollection([]) });

      map.addLayer({
        id: "ref-muni",
        type: "circle",
        source: SRC_MUNI,
        paint: {
          "circle-radius": ["case", ["==", ["get", "hub"], true], 4.5, 3],
          "circle-color": c("muni"),
          "circle-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "fib-line-casing",
        type: "line",
        source: SRC_LINES,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c("casing"),
          "line-width": ["case", ["==", ["get", "selected"], 1], 7, 4.5],
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "fib-line",
        type: "line",
        source: SRC_LINES,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["case", ["==", ["get", "selected"], 1], 4.5, 2.5],
          "line-dasharray": [
            "case",
            ["==", ["get", "planned"], 1],
            ["literal", [2, 2]],
            ["literal", [1, 0]],
          ] as never,
        },
      });
      map.addLayer({
        id: "otdr-band",
        type: "line",
        source: SRC_OTDR,
        paint: { "line-color": c("otdr"), "line-width": 12, "line-opacity": 0.55 },
      });
      map.addLayer({
        id: "draw-verts",
        type: "circle",
        source: SRC_DRAW,
        paint: {
          "circle-radius": 7,
          "circle-color": c("draw"),
          "circle-stroke-color": c("casing"),
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "fib-pin",
        type: "circle",
        source: SRC_PINS,
        paint: {
          "circle-radius": ["case", ["==", ["get", "selected"], 1], 9, 6],
          "circle-color": ["get", "color"],
          "circle-stroke-color": c("casing"),
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "me-halo",
        type: "circle",
        source: SRC_ME,
        paint: {
          "circle-radius": 16,
          "circle-color": c("me"),
          "circle-opacity": 0.18,
          "circle-stroke-color": c("me"),
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({
        id: "me-dot",
        type: "circle",
        source: SRC_ME,
        paint: {
          "circle-radius": 6.5,
          "circle-color": c("me"),
          "circle-stroke-color": c("casing"),
          "circle-stroke-width": 2,
        },
      });
      // Municipality names as DOM markers: MapLibre symbol layers would need a
      // glyph server, which would break offline use.
      for (const m of MUNICIPALITIES) {
        const el = document.createElement("div");
        el.className = "map-label";
        el.textContent = m.name;
        if (m.isCapitalOrHub) el.classList.add("hub");
        new Marker({ element: el, anchor: "left", offset: [8, -4] })
          .setLngLat([m.point.lon, m.point.lat])
          .addTo(map);
      }

      setReady(true);
    });

    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressStart: { x: number; y: number } | null = null;

    const onMouseDown = (e: MouseEvent) => {
      pressStart = { x: e.clientX, y: e.clientY };
      pressTimer = setTimeout(() => {
        pressTimer = null;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || !mapRef.current) return;
        const pt = mapRef.current.unproject([e.clientX - rect.left, e.clientY - rect.top]);
        handlers.current.onLongPress({ lat: pt.lat, lon: pt.lng });
      }, 500);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!pressStart) return;
      const dx = e.clientX - pressStart.x;
      const dy = e.clientY - pressStart.y;
      if (Math.hypot(dx, dy) > 8 && pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    const cancelPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
    };

    containerRef.current.addEventListener("mousedown", onMouseDown);
    containerRef.current.addEventListener("mousemove", onMouseMove);
    containerRef.current.addEventListener("mouseup", cancelPress);
    containerRef.current.addEventListener("mouseleave", cancelPress);

    const onClick = (e: MapLayerMouseEvent) => {
      const map = mapRef.current;
      if (!map) return;
      // Putting a name down wins over everything else while it is armed.
      if (handlers.current.placingPlace) {
        handlers.current.onPlaceTapped({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        return;
      }
      const hits = map.queryRenderedFeatures(e.point, { layers: ["fib-pin"] });
      if (hits.length > 0) {
        const id = hits[0].properties?.id as string | undefined;
        const pin = pinsRef.current.find((p) => p.id === id);
        if (pin) {
          handlers.current.onPinClick(pin);
          return;
        }
      }
      // A fibre line is two or three pixels wide on screen, which is not a
      // thing a thumb can hit. Look inside a small box around the tap instead.
      const pad = 14;
      const box: [[number, number], [number, number]] = [
        [e.point.x - pad, e.point.y - pad],
        [e.point.x + pad, e.point.y + pad],
      ];
      const lineHits = map.queryRenderedFeatures(box, { layers: ["fib-line"] });
      if (lineHits.length > 0 && !handlers.current.drawMode) {
        const id = lineHits[0].properties?.id as string | undefined;
        const data = bubblesRef.current.find((b) => b.id === id);
        if (data) {
          setLineBubble({ data, lngLat: [e.lngLat.lng, e.lngLat.lat] });
          return;
        }
      }
      if (!handlers.current.drawMode) setLineBubble(null);
      if (handlers.current.drawMode) {
        handlers.current.onMapClick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      }
    };

    map.on("click", onClick);
    map.on("zoomend", () => setZoom(map.getZoom()));
    map.on("idle", () => refreshOsmNames());
    map.on("moveend", () => {
      const c = map.getCenter();
      setCenter({ lat: c.lat, lon: c.lng });
    });
    // A drag is the crew saying "I know where I am". MapLibre reports it as a
    // gesture, which keeps follow mode from fighting the user.
    map.on("dragstart", () => handlers.current.onUserMovedMap());

    return () => {
      cancelPress();
      containerRef.current?.removeEventListener("mousedown", onMouseDown);
      containerRef.current?.removeEventListener("mousemove", onMouseMove);
      containerRef.current?.removeEventListener("mouseup", cancelPress);
      containerRef.current?.removeEventListener("mouseleave", cancelPress);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- The line tap bubble ---

  // MapLibre owns the popup so it tracks the camera while it animates. The
  // content is React, so the popup holds a tiny React root.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !lineBubble) return;

    const node = document.createElement("div");
    const root = createRoot(node);
    root.render(
      <LineBubble
        data={lineBubble.data}
        onOpen={() => {
          setLineBubble(null);
          onLineOpen(lineBubble.data.id);
        }}
      />,
    );
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      maxWidth: "260px",
    })
      .setLngLat(lineBubble.lngLat)
      .setDOMContent(node)
      .addTo(map);
    bubbleRef.current = { popup, root };

    return () => {
      root.unmount();
      popup.remove();
      bubbleRef.current = null;
    };
  }, [lineBubble, ready]);

  // Close the bubble if its line was deleted underneath it.
  useEffect(() => {
    if (!lineBubble) return;
    if (!bubblesRef.current.some((b) => b.id === lineBubble.data.id)) {
      setLineBubble(null);
    }
  }, [lineBubble, lineBubbles]);

  // --- Place names ---

  // The province archive carries the OSM place names: the villages, barangays
  // and sitios the crew works in. MapLibre cannot draw text without a glyph
  // server, which would break offline use, so the names are read out of the
  // tiles and drawn as DOM markers, the same way the municipality names are.
  const osmMarkersRef = useRef<Marker[]>([]);

  const refreshOsmNames = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("pmtiles")) return;
    for (const marker of osmMarkersRef.current) marker.remove();
    osmMarkersRef.current = [];

    const zoom = map.getZoom();
    if (zoom < 11) return;

    // Bigger places first, so when the list is cut short the towns survive.
    const rank: Record<string, number> = {
      city: 0,
      town: 1,
      municipality: 2,
      village: 3,
      suburb: 4,
      hamlet: 5,
    };
    const maxRank = zoom >= 13 ? 5 : zoom >= 12 ? 3 : 1;

    const bounds = map.getBounds();
    const features = map.querySourceFeatures("pmtiles", { sourceLayer: "places" });
    const seen = new Set<string>();
    const found: { name: string; rank: number; lon: number; lat: number }[] = [];
    for (const f of features) {
      const name = f.properties?.name as string | undefined;
      const cls = (f.properties?.class as string | undefined) ?? "village";
      const geometry = f.geometry as { type?: string; coordinates?: number[] };
      if (!name || geometry.type !== "Point" || !geometry.coordinates) continue;
      const placeRank = rank[cls] ?? 3;
      if (placeRank > maxRank) continue;
      const [lon, lat] = geometry.coordinates;
      if (lon < bounds.getWest() || lon > bounds.getEast()) continue;
      if (lat < bounds.getSouth() || lat > bounds.getNorth()) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      found.push({ name, rank: placeRank, lon, lat });
    }
    found.sort((a, b) => a.rank - b.rank);

    for (const place of found.slice(0, 40)) {
      const el = document.createElement("div");
      el.className = "map-label place";
      el.textContent = place.name;
      osmMarkersRef.current.push(
        new Marker({ element: el, anchor: "top", offset: [0, 4] })
          .setLngLat([place.lon, place.lat])
          .addTo(map),
      );
    }
  }, []);

  // The names the crew put on the map themselves. They are buttons, because
  // a name the crew wrote has to be editable.
  const placeMarkersRef = useRef<Map<string, Marker>>(new Map());

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const label of placeLabels) {
      seen.add(label.id);
      let marker = placeMarkersRef.current.get(label.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "map-label crew";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          handlers.current.onPlaceLabelClick(label.id);
        });
        marker = new Marker({ element: el, anchor: "top", offset: [0, 10] })
          .setLngLat([label.lon, label.lat])
          .addTo(map);
        placeMarkersRef.current.set(label.id, marker);
      }
      marker.getElement().textContent = label.name;
    }
    for (const [id, marker] of placeMarkersRef.current) {
      if (seen.has(id)) continue;
      marker.remove();
      placeMarkersRef.current.delete(id);
    }
  }, [placeLabels, ready]);

  // --- Basemap mount/unmount ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const teardown = () => {
      // The map effect that owns this map cleans up first and calls
      // map.remove(), so skip anything that touches a dead style.
      if (mapRef.current !== map) return;
      for (const layer of pmtilesStyleLayers(themeRef.current)) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
      }
      if (map.getSource("pmtiles")) map.removeSource("pmtiles");
      for (const marker of osmMarkersRef.current) marker.remove();
      osmMarkersRef.current = [];
    };

    if (!basemapKey) {
      teardown();
      return;
    }

    // Adding a vector source with bounds makes MapLibre fit the whole archive
    // into view, which throws away the crew's camera (and their zoom). Keep
    // where they were looking.
    const camera = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };

    addPmTilesSource(map, basemapKey);
    // Insert below the crew's own lines so the fibre routes stay on top.
    const anchor = map.getLayer("ref-muni") ? "ref-muni" : undefined;
    for (const layer of pmtilesStyleLayers(themeRef.current)) {
      if (map.getLayer(layer.id)) continue;
      map.addLayer(layer, anchor);
    }

    map.jumpTo({
      center: camera.center,
      zoom: camera.zoom,
      bearing: camera.bearing,
      pitch: camera.pitch,
    });

    return teardown;
  }, [basemapKey, ready]);

  // --- Theme ---

  // The map follows the app theme. Repainting the layers in place keeps the
  // WebGL context and the decoded tiles, which a setStyle would throw away.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    map.setPaintProperty(
      "background",
      "background-color",
      BACKGROUND_EXPRESSION[theme] as never,
    );
    for (const [layerId, prop, key] of THEME_PAINT) {
      if (!map.getLayer(layerId)) continue;
      map.setPaintProperty(layerId, prop, MAP_COLORS[theme][key]);
    }
  }, [theme, ready]);

  // --- Data syncing ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SRC_LINES) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      featureCollection(
        lines
          .filter((l) => l.vertices.length >= 2)
          .map((l) =>
            lineFeature(l.vertices, {
              id: l.id,
              color: getFiberColor(l.colorKey),
              selected: l.id === selectedLineId ? 1 : 0,
              planned: l.status === "PLANNED" ? 1 : 0,
            }),
          ),
      ),
    );
  }, [lines, selectedLineId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SRC_PINS) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      featureCollection(
        pins.map((p) => ({
          type: "Feature",
          properties: {
            id: p.id,
            color: pinColor(p),
            selected: p.id === selectedPinId ? 1 : 0,
          },
          geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        })),
      ),
    );
  }, [pins, selectedPinId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SRC_DRAW) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      featureCollection(
        drawVertices.map((v) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [v.lon, v.lat] },
        })),
      ),
    );
  }, [drawVertices, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SRC_OTDR) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      featureCollection(
        otdrBand
          ? [
              lineFeature([otdrBand.min, otdrBand.target, otdrBand.max], {
                label: otdrBand.label,
              }),
            ]
          : [],
      ),
    );
  }, [otdrBand, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SRC_ME) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      featureCollection(
        userLocation
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "Point",
                  coordinates: [userLocation.lon, userLocation.lat],
                },
              },
            ]
          : [],
      ),
    );
  }, [userLocation, ready]);

  // --- Follow the crew's own position ---

  // The crew is out in the field, often nowhere near San Francisco. The map
  // follows the GPS position, and only stops when the crew pans the map
  // themselves.
  const lastFollowed = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !followMe || !userLocation) return;

    const previous = lastFollowed.current;
    // A 2 m deadband stops the map from twitching on a noisy fix.
    if (
      previous &&
      Math.abs(previous.lat - userLocation.lat) < 0.00002 &&
      Math.abs(previous.lon - userLocation.lon) < 0.00002
    ) {
      return;
    }
    lastFollowed.current = { lat: userLocation.lat, lon: userLocation.lon };

    map.easeTo({
      center: [userLocation.lon, userLocation.lat],
      duration: 600,
      essential: true,
    });
  }, [followMe, userLocation, ready]);

  // --- Camera focus from list navigation ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    map.flyTo({
      center: [focus.lon, focus.lat],
      zoom: focus.zoom,
      duration: 700,
      essential: true,
    });
    onFocusConsumed();
  }, [focus, ready, onFocusConsumed]);

  const readout = useMemo(
    () => `${center.lat.toFixed(5)}°N, ${center.lon.toFixed(5)}°E • z${zoom.toFixed(1)}`,
    [center, zoom],
  );

  const zoomBy = (delta: number) =>
    mapRef.current?.easeTo({
      zoom: Math.min(18, Math.max(8, (mapRef.current?.getZoom() ?? 13) + delta)),
      duration: 220,
    });

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    // Prefer the crew's own position. San Francisco is only the fallback for
    // when the phone has no fix yet.
    const target = userLocation
      ? { lon: userLocation.lon, lat: userLocation.lat }
      : { lon: 125.9772, lat: 8.5085 };
    map.easeTo({ center: [target.lon, target.lat], zoom: 15, duration: 500 });
  };

  const hudSide = handedness === "left" ? "left" : "right";

  return (
    <div className="map-wrap">
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      <div className={`map-hud ${hudSide}`}>
        <button className="fab" onClick={() => zoomBy(1)} aria-label="Zoom in">
          +
        </button>
        <button className="fab" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          −
        </button>
        <button
          className="fab"
          onClick={recenter}
          aria-label={
            userLocation ? "Center on my location" : "Center on Agusan del Sur"
          }
        >
          ◎
        </button>
        <button
          className={`fab${followMe ? " primary" : ""}`}
          onClick={onToggleFollow}
          aria-pressed={followMe}
          aria-label={followMe ? "Stop following my position" : "Follow my position"}
          title={followMe ? "Following your position" : "Follow your position"}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
        <button
          className={`fab${placingPlace ? " primary" : ""}`}
          onClick={onTogglePlaceMode}
          aria-pressed={placingPlace}
          aria-label={placingPlace ? "Cancel naming a place" : "Name a place on the map"}
          title="Name a place"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 12.5V4.5h8l8 8-8 8-8-8Z" />
            <circle cx="7.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      <div className="map-readout" style={{ position: "absolute", bottom: 12, left: 12 }}>
        {readout}
      </div>

      {/* The basemap is built from OpenStreetMap data, so the credit has to
          be on the map. It sits above the readout, out of the way of the
          thumb controls. */}
      <div className="map-attrib">© OpenStreetMap contributors</div>

      {locationError && (
        <div
          className="map-readout"
          role="status"
          style={{
            position: "absolute",
            top: 12,
            left: hudSide === "right" ? "auto" : 12,
            right: hudSide === "right" ? "auto" : undefined,
            maxWidth: "calc(100% - 24px)",
            color: "var(--cut)",
            borderColor: "var(--cut)",
          }}
        >
          Location unavailable: {locationError}
        </div>
      )}
    </div>
  );
}

export function pinColor(pin: FiberPin): string {
  if (pin.type === "CUT_REPAIR" && pin.state === "OPEN") return "#c8372d";
  if (pin.type === "CUT_REPAIR" && pin.state === "REPAIRED") return "#2f8f5b";
  if (pin.type === "SLACK_COIL") return "#f5a623";
  if (pin.type === "SPLITTER_NAP") return "#00b4d8";
  return "#0a7c8c";
}
