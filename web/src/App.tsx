import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { MapView } from "./ui/MapView";
import { pinColor } from "./ui/pinShapes";
import { LinesList } from "./ui/LinesList";
import { LineDetail, type OtherWire } from "./ui/LineDetail";
import { PinSheet } from "./ui/PinSheet";
import { WiresSheet, type WiresRow } from "./ui/WiresSheet";
import { OtdrDialog } from "./ui/OtdrDialog";
import { Share } from "./ui/Share";
import { Settings } from "./ui/Settings";
import { MapManager } from "./ui/MapManager";
import { ensureBasemap, mountStoredArchive } from "./ui/pmtilesStore";
import { getMountedKey } from "./ui/pmtilesLoader";
import { useGpsTracker } from "./ui/useGpsTracker";
import { useEscape } from "./ui/useEscape";
import { useDialog } from "./ui/useDialog";
import { useEnter } from "./ui/useEnter";
import { ConfirmSheet } from "./ui/ConfirmSheet";
import { PlaceLabelSheet } from "./ui/PlaceLabelSheet";
import { requestPersistence } from "./core/storage";
import type { LineBubbleData } from "./ui/LineBubble";
import { useEvents, useLines, useLinesWithStats, usePins, usePlaceLabels, useRepairLogs, useSetting } from "./data/hooks";
import { db, ensureSeedData } from "./data/db";
import {
  deleteLine,
  deletePin,
  deletePlaceLabel,
  dropPin,
  markPinRepaired,
  pinToDomain,
  saveLine,
  savePlaceLabel,
  updatePin,
  uid,
} from "./data/repo";
import { computeCumulativeDistances, formatChainage, getPointAtChainage, snapPointToPolyline, type GeoPoint, type OtdrMapMatch } from "./core/geometry";
import { routeBetween, type RoadFeature } from "./core/routing";
import { wiresOnPath } from "./core/overlap";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { FiberLine, FiberPin, LineStatus, PinType, RepairMethod } from "./domain/models";

type Tab = "MAP" | "LINES" | "SHARE";
type Overlay = "NONE" | "LINE_DETAIL" | "SETTINGS" | "MAPS_MANAGER" | "OTDR";

interface Focus {
  lat: number;
  lon: number;
  zoom: number;
}

const FIBER_COLORS = [
  "blue", "orange", "green", "brown", "slate", "white",
  "red", "black", "yellow", "violet", "rose", "aqua",
];

/**
 * Navigation icons drawn for this app rather than pulled from an icon set:
 * a folded map, a fibre route with its two endpoints, an export arrow and a
 * gear. Hand drawn so they render the same on every phone.
 */
const NAV_ICONS: Record<string, ReactNode> = {
  map: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3.5 3 6.5v14l6-3 6 3 6-3v-14l-6 3-6-3Z" />
      <path d="M9 3.5v14M15 6.5v14" />
    </svg>
  ),
  lines: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 18c4.5 0 4-11 8.5-11S16 15 19 15" />
      <circle cx="5" cy="18" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="15" r="2.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3M8 6.5 12 3l4 3.5" />
      <path d="M5 12.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9" />
    </svg>
  ),
};

export default function App() {
  const lines = useLines();
  const pins = usePins();
  const events = useEvents();
  const repairLogs = useRepairLogs();
  const placeLabels = usePlaceLabels();
  const linesWithStats = useLinesWithStats();

  const [theme, setTheme] = useSetting("theme", "system");
  const [handedness, setHandedness] = useSetting("handedness", "right");
  const [units, setUnits] = useSetting("units", "chainage");

  const [tab, setTab] = useState<Tab>("MAP");
  const [overlay, setOverlay] = useState<Overlay>("NONE");
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  // The line the crew picked on the map: it gets the chainage tape, the end
  // marks and the highlight.
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  // Wires that share one path, when the crew taps a road that carries more
  // than one cable.
  const [wiresAtPoint, setWiresAtPoint] = useState<string[] | null>(null);
  const [selectedPin, setSelectedPin] = useState<FiberPin | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const isNewPinRef = useRef(false);
  const [drawMode, setDrawMode] = useState(false);
  const [followMe, setFollowMe] = useState(false);
  const [hasCentredOnGps, setHasCentredOnGps] = useState(false);
  const [drawMethod, setDrawMethod] = useState<"MANUAL" | "DRIVE_GPS" | "AUTO_PATH">("MANUAL");
  const [continueLineId, setContinueLineId] = useState<string | null>(null);
  const [drawVertices, setDrawVertices] = useState<GeoPoint[]>([]);
  const [showLineForm, setShowLineForm] = useState(false);
  const [slackDraft, setSlackDraft] = useState<{
    lineId: string;
    lineName: string;
    chainageM: number;
    lat: number;
    lon: number;
    source: "GPS" | "MIDPOINT";
  } | null>(null);
  // The crew arms NAP placement, taps the map, and the pin snaps to the wire
  // under the tap. Same idea as naming a place, different payload.
  const [napMode, setNapMode] = useState(false);
  const [otdrMatch, setOtdrMatch] = useState<OtdrMapMatch | null>(null);
  const [otdrLineId, setOtdrLineId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [basemapKey, setBasemapKey] = useState<string | null>(null);
  const [basemapVersion, setBasemapVersion] = useState(0);
  const [basemapProgress, setBasemapProgress] = useState<{
    received: number;
    total: number;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "LINE"; id: string; name: string; pins: number; repairs: number }
    | { kind: "PIN"; id: string }
    | null
  >(null);
  // Naming a place: the crew arms it, taps the map, and writes the name.
  const [placeMode, setPlaceMode] = useState(false);
  const [labelDraft, setLabelDraft] = useState<{
    id: string | null;
    name: string;
    lat: number;
    lon: number;
  } | null>(null);

  // The GPS watch runs while the map is on screen, because that is when the
  // crew needs to know where they are. It stops when they leave the map tab
  // and are not following or tracing, so a phone left on the seat is not
  // holding the radio open.
  const [gpsOnDemand, setGpsOnDemand] = useState(true);
  const gps = useGpsTracker(
    gpsOnDemand || followMe || drawMode || tab === "MAP",
    followMe || drawMode,
  );
  const chainageStyle = units === "chainage";

  useEffect(() => {
    if (gps.fix || gps.error) setGpsOnDemand(false);
  }, [gps.fix, gps.error]);

  // Opening a line arms the Add slack loop action, which needs the crew's
  // position. Wake the watch now instead of making them tap twice.
  useEffect(() => {
    if (overlay === "LINE_DETAIL") setGpsOnDemand(true);
  }, [overlay]);

  useEffect(() => {
    void ensureSeedData();
    // Ask the browser to keep the records when the phone runs out of room.
    void requestPersistence();
  }, []);

  // Mount the basemap. If the device has none yet the province archive is
  // installed and mounted, so the map is whole on the first open instead of
  // waiting for the crew to find a download button.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const info = await ensureBasemap((progress) => {
          if (alive) setBasemapProgress({ received: progress.received, total: progress.total });
        });
        if (!alive) return;
        setBasemapProgress(null);
        if (info) setBasemapKey(info.key);
      } catch (err) {
        if (!alive) return;
        setBasemapProgress(null);
        setToast(`Basemap not available: ${(err as Error).message}`);
      }
    })();
    return () => {
      alive = false;
    };
  }, [basemapVersion]);

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      const next = dark ? "dark" : "light";
      setResolvedTheme(next);
      document.documentElement.dataset.theme = next;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#0F171B" : "#0A7C8C");
    };
    apply();
    // The system theme can change while the app is open, so listen for it.
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // The crew is usually nowhere near San Francisco. The first fix pulls the
  // map to where they actually are, so the map opens on the job site.
  // The old gate was 100 m, which a cold fix under trees never beats, and the
  // map sat on San Francisco. Anything inside half a kilometre counts, and
  // follow mode keeps correcting it as the fix sharpens.
  useEffect(() => {
    if (!gps.fix || hasCentredOnGps) return;
    if (gps.fix.accuracyM > 500) return;
    setHasCentredOnGps(true);
    setFollowMe(true);
    // Zoom to a working level, not the province view. A tech standing at a
    // pole needs street level on the first frame.
    setFocus({ lat: gps.fix.point.lat, lon: gps.fix.point.lon, zoom: 15 });
  }, [gps.fix, hasCentredOnGps]);

  // GPS-recorded vertices feed the draw flow when the drive method is active.
  const activeVertices = useMemo(
    () => (drawMethod === "DRIVE_GPS" ? gps.vertices : drawVertices),
    [drawMethod, gps.vertices, drawVertices],
  );

  const startDraw = (
    method: "MANUAL" | "DRIVE_GPS" | "AUTO_PATH",
    continueLineId?: string,
  ) => {
    setDrawMethod(method);
    setDrawVertices([]);
    setContinueLineId(continueLineId ?? null);
    setDrawMode(true);
    setNapMode(false);
    setFocusedLineId(continueLineId ?? null);
    // Following the GPS while the crew is placing corners would move the map
    // out from under them.
    setFollowMe(false);
    setTab("MAP");
    setOverlay("NONE");
    if (method === "DRIVE_GPS") {
      gps.start();
      setToast("GPS recording started. Drive or walk the route.");
    } else if (method === "AUTO_PATH") {
      setToast("Tap the start of the route, then the end. The path follows the roads.");
    } else if (continueLineId) {
      setToast("Tap the map to add corners to the line.");
    } else {
      setToast("Tap the map to place corners. Tap a corner again to remove it.");
    }
  };

  const cancelDraw = () => {
    setDrawMode(false);
    setDrawVertices([]);
    setContinueLineId(null);
    gps.reset();
  };
  const removeDrawVertex = (index: number) => {
    setDrawVertices((v) => v.filter((_, i) => i !== index));
  };

  const openLine = (id: string) => {
    setSelectedLineId(id);
    setFocusedLineId(id);
    setOverlay("LINE_DETAIL");
  };

  const snapToMap = (line: FiberLine) => {
    setSelectedLineId(line.id);
    setFocusedLineId(line.id);
    setFollowMe(false);
    const mid = line.vertices[Math.floor(line.vertices.length / 2)] ?? line.vertices[0];
    if (mid) setFocus({ lat: mid.lat, lon: mid.lon, zoom: 14.5 });
    setTab("MAP");
    setOverlay("NONE");
  };

  const focusPin = (pin: FiberPin) => {
    setSelectedPin(pin);
    setFollowMe(false);
    setFocus({ lat: pin.lat, lon: pin.lon, zoom: 16.5 });
    setTab("MAP");
    setOverlay("NONE");
  };

  const dropNap = async (pt: GeoPoint) => {
    const pin = await dropPin({
      lineId: null,
      type: "SPLITTER_NAP",
      lat: pt.lat,
      lon: pt.lon,
      label: "",
      notes: "",
    });
    isNewPinRef.current = true;
    setSelectedPin(pin);
    const line = pin.lineId ? lines.find((l) => l.id === pin.lineId) : undefined;
    setToast(
      line && pin.chainageM !== null
        ? `NAP snapped to "${line.name}" at ${formatChainage(pin.chainageM, chainageStyle)}.`
        : "NAP added off-line. Tap Save to keep it where you tapped.",
    );
  };

  const onMapClick = (pt: GeoPoint) => {
    if (napMode) {
      setNapMode(false);
      void dropNap(pt);
      return;
    }
    if (!drawMode) return;
    if (drawMethod === "MANUAL") {
      setDrawVertices((v) => [...v, pt]);
    } else if (drawMethod === "AUTO_PATH") {
      setDrawVertices((v) => {
        if (v.length === 0) return [pt];
        if (v.length === 1) {
          // Second tap: route between the two points.
          const map = (window as unknown as { __map?: MapLibreMap }).__map;
          if (map) {
            try {
              const features = map.querySourceFeatures("pmtiles", {
                sourceLayer: "roads",
              }) as unknown as RoadFeature[];
              const result = routeBetween(features, { lat: v[0].lat, lon: v[0].lon }, pt);
              if (result && result.path.length >= 2) {
                const routed: GeoPoint[] = result.path.map(([lon, lat]) => ({ lat, lon }));
                setDrawVertices(routed);
                setToast(`Routed ${Math.round(result.lengthM)} m along the roads.`);
                return routed;
              }
              setToast("No road path found between those points.");
            } catch {
              setToast("Routing failed. Try again.");
            }
          }
          return [v[0], pt];
        }
        // Third tap onwards: re-route from the same start to the new end.
        const map = (window as unknown as { __map?: MapLibreMap }).__map;
        if (map) {
          try {
            const features = map.querySourceFeatures("pmtiles", {
              sourceLayer: "roads",
            }) as unknown as RoadFeature[];
            const result = routeBetween(features, { lat: v[0].lat, lon: v[0].lon }, pt);
            if (result && result.path.length >= 2) {
              const routed: GeoPoint[] = result.path.map(([lon, lat]) => ({ lat, lon }));
              setToast(`Routed ${Math.round(result.lengthM)} m along the roads.`);
              return routed;
            }
            setToast("No road path found between those points.");
          } catch {
            setToast("Routing failed. Try again.");
          }
        }
        return [v[0], pt];
      });
    }
  };
  const onLongPress = (pt: GeoPoint) => {
    // Hold anywhere drops a cut pin; the sheet lets the tech refine it.
    // No line is named here on purpose: the pin takes the line it is
    // physically on, not the one that happened to be open in the app.
    void dropPin({
      lineId: null,
      type: "CUT_REPAIR",
      lat: pt.lat,
      lon: pt.lon,
      label: "",
      notes: "",
    }).then((pin) => {
      isNewPinRef.current = true;
      setSelectedPin(pin);
      setToast("Cut pin dropped. Tap Save to adjust it.");
    });
  };
  const beginAddSlackLoop = (line: FiberLine) => {
    // A loop is a field note, not a survey point, so a loose fix never blocks
    // it. If the fix is nowhere near this line, the middle of the line beats
    // snapping the loop onto an endpoint hundreds of metres away.
    setGpsOnDemand(true);
    let snap = gps.fix ? snapPointToPolyline(gps.fix.point, line.vertices) : null;
    const useGps = snap !== null && snap.distanceToLineM <= 200;
    if (!useGps) {
      const middle = getPointAtChainage(line.lengthMapM / 2, line.vertices);
      snap = middle ? snapPointToPolyline(middle, line.vertices) : null;
    }
    if (!snap) {
      setToast("This line has no path to attach a loop to.");
      return;
    }
    setSlackDraft({
      lineId: line.id,
      lineName: line.name,
      chainageM: snap.chainageM,
      lat: snap.snapPoint.lat,
      lon: snap.snapPoint.lon,
      source: useGps ? "GPS" : "MIDPOINT",
    });
  };

  const saveSlackLoop = async (totalM: number) => {
    if (!slackDraft) return;
    await dropPin({
      lineId: slackDraft.lineId,
      type: "SLACK_COIL",
      lat: slackDraft.lat,
      lon: slackDraft.lon,
      label: "",
      notes: "",
      coilLengthM: totalM,
      gpsAccuracyM: gps.fix?.accuracyM ?? null,
    });
    setToast(
      `Slack loop added: ${Math.round(totalM)} m at ${formatChainage(
        slackDraft.chainageM,
        chainageStyle,
      )}.`,
    );
    setSlackDraft(null);
  };

  const extendLine = async () => {
    if (!continueLineId) return;
    const existing = lines.find((l) => l.id === continueLineId);
    if (!existing) {
      setToast("That line is no longer on the map.");
      return;
    }
    if (activeVertices.length < 1) {
      setToast("Add at least one corner to continue the line.");
      return;
    }
    const vertices = [...existing.vertices, ...activeVertices];
    await saveLine({
      ...existing,
      vertices,
      lengthMapM: computeCumulativeDistances(vertices).pop() ?? 0,
      updatedAt: Date.now(),
    });
    cancelDraw();
    setTab("MAP");
    setToast(`Extended "${existing.name}".`);
  };

  const saveNewLine = async (form: {
    name: string;
    fiberType: string;
    coreCount: number | null;
    notes: string;
    colorKey: string;
    status: LineStatus;
  }) => {
    const newVertices = drawVertices.length >= 2 ? drawVertices : activeVertices;
    if (newVertices.length < 1) {
      setToast("Need at least one point on the route.");
      return;
    }

    const vertices = newVertices;
    if (vertices.length < 2) {
      setToast("Need at least two points on the route.");
      return;
    }
    const line: FiberLine = {
      id: crypto.randomUUID(),
      name: form.name,
      colorKey: form.colorKey,
      status: form.status,
      fiberType: form.fiberType,
      coreCount: form.coreCount,
      notes: form.notes,
      vertices,
      lengthMapM: computeCumulativeDistances(vertices).pop() ?? 0,
      slackPercent: 3,
      measuredLengthM: null,
      parentLineId: null,
      branchChainageM: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    };
    await saveLine(line);
    cancelDraw();
    setShowLineForm(false);
    setSelectedLineId(line.id);
    setTab("MAP");
    setToast(`Saved "${line.name}".`);
  };

  const handleDropPinFromOtdr = async (match: OtdrMapMatch) => {
    const lineId = otdrLineId;
    const pin = await dropPin({
      lineId,
      type: "CUT_REPAIR",
      lat: match.point.lat,
      lon: match.point.lon,
      label: "",
      notes: `OTDR reading at ${formatChainage(match.targetMapDistanceM, chainageStyle)}`,
    });
    setOtdrMatch(null);
    setTab("MAP");
    setOverlay("NONE");
    isNewPinRef.current = true;
    setSelectedPin(pin);
    setToast("Cut pin dropped at the OTDR location.");
  };
  const mapFiles =
    useLiveQuery(async () => db.mapFiles.orderBy("buildDate").reverse().toArray(), [], []) ??
    [];

  const selectedStats = linesWithStats.find((s) => s.line.id === selectedLineId) ?? null;
  // Other cables recorded along the same road as the open line.
  const otherWires = selectedStats
    ? wiresOnPath(lines, selectedStats.line.id)
        .map((id) => {
          const l = lines.find((x) => x.id === id);
          if (!l) return null;
          return {
            id,
            name: l.name,
            lengthLabel: formatChainage(l.lengthMapM, chainageStyle),
          };
        })
        .filter((w): w is OtherWire => w !== null)
    : [];
  const otdrLine = lines.find((l) => l.id === otdrLineId) ?? null;

  // What the map shows in the bubble when a line is tapped.
  const lineBubbles: LineBubbleData[] = linesWithStats.map((s) => ({
    id: s.line.id,
    name: s.line.name,
    status: s.line.status,
    lengthLabel: formatChainage(s.line.lengthMapM, chainageStyle),
    cores: s.line.coreCount ?? 0,
    pins: s.totalPinsCount,
    openCuts: s.openCuts,
    repairs: s.totalRepairs,
  }));

  // Settings and the base-map manager are full-screen overlays, so they close
  // the same way the sheets do.
  useEscape(
    () => setOverlay("NONE"),
    overlay === "SETTINGS" || overlay === "MAPS_MANAGER",
  );

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <h1>fiberMAP</h1>
        <p className="sub">Agusan del Sur · offline field mapping</p>
      </header>

      <main className="app-body" id="main">
        <div
          className={`map-layer${tab === "MAP" && overlay === "NONE" ? "" : " off"}`}
        >
          <MapView
            lines={lines}
            pins={pins}
            lineBubbles={lineBubbles}
            selectedLineId={selectedLineId}
            focusedLineId={focusedLineId}
            onWiresAtPoint={(ids) => setWiresAtPoint(ids)}
            onFocusLine={(id) => setFocusedLineId(id)}
            selectedPinId={selectedPin?.id ?? null}
            focus={focus}
            drawMode={drawMode}
            drawVertices={activeVertices}
            userLocation={gps.fix ? { ...gps.fix.point, accuracyM: gps.fix.accuracyM } : null}
            otdrBand={
              otdrMatch
                ? {
                    min: otdrMatch.minPoint,
                    target: otdrMatch.point,
                    max: otdrMatch.maxPoint,
                    label: formatChainage(otdrMatch.targetMapDistanceM, chainageStyle),
                  }
                : null
            }
            handedness={handedness === "left" ? "left" : "right"}
            basemapKey={basemapKey}
            theme={resolvedTheme}
            followMe={followMe}
            onToggleFollow={() => setFollowMe((v) => !v)}
            onTogglePlaceMode={() => {
              setPlaceMode((v) => !v);
              setDrawMode(false);
              setNapMode(false);
            }}
            onUserMovedMap={() => setFollowMe(false)}
            locationError={gps.error}
            onMapClick={onMapClick}
            onDrawVertexRemove={removeDrawVertex}
            onLongPress={onLongPress}
            onPinClick={(pin) => { isNewPinRef.current = false; setSelectedPin(pin); }}
            placeLabels={placeLabels}
            placingPlace={placeMode}
            placingPin={napMode}
            chainageStyle={chainageStyle}
            onPlaceTapped={(pt) => {
              setPlaceMode(false);
              setLabelDraft({ id: null, name: "", lat: pt.lat, lon: pt.lon });
            }}
            onPlaceZoom={(id) => {
              const label = placeLabels.find((l) => l.id === id);
              if (!label) return;
              setFocus({ lat: label.lat, lon: label.lon, zoom: 16 });
            }}
            onPlaceLabelClick={(id) => {
              const label = placeLabels.find((l) => l.id === id);
              if (!label) return;
              setLabelDraft({ id: label.id, name: label.name, lat: label.lat, lon: label.lon });
            }}
            onLineOpen={(id) => openLine(id)}
            onFocusConsumed={() => setFocus(null)}
          />

          {placeMode && (
            <div className="draw-banner">
              Tap the map where the name goes
            </div>
          )}

          {napMode && (
            <div className="draw-banner">
              Tap the map to place the NAP
            </div>
          )}

          {drawMode && (
            <>
                <div className="draw-banner">
                {drawMethod === "AUTO_PATH"
                  ? (activeVertices.length === 0
                      ? "Tap the start of the route"
                      : activeVertices.length === 1
                        ? "Tap the end of the route"
                        : `${activeVertices.length} points along the road`)
                  : drawMethod === "MANUAL"
                    ? continueLineId
                      ? `Tap the map to add corners - ${activeVertices.length} new (tap a number to remove)`
                      : `Tap the map to place corners - ${activeVertices.length} placed (tap a number to remove)`
                    : `GPS recording - ${(gps.distanceM / 1000).toFixed(2)} km - ${activeVertices.length} points`}
                 </div>

               <div className="map-hud bottom" style={{ justifyContent: "space-between" }}>
                 <div className="dock">
                   {drawMethod === "DRIVE_GPS" && (
                     <>
                       <button
                         className="btn"
                         onClick={gps.isPaused ? gps.resume : gps.pause}
                       >
                         {gps.isPaused ? "Resume" : "Pause"}
                       </button>
                       <button className="btn" onClick={gps.undo}>
                         Undo
                       </button>
                     </>
                   )}
                   <button className="btn" onClick={cancelDraw}>
                     Cancel
                   </button>
                 </div>
                 <div className="dock">
                   <button
                     className="btn primary"
                     disabled={activeVertices.length < (continueLineId ? 1 : 2)}
                     onClick={() =>
                       continueLineId ? void extendLine() : setShowLineForm(true)
                     }
                   >
                     Save line
                   </button>
                 </div>
               </div>
            </>
          )}

           {!drawMode && (
             <div className="map-hud bottom" style={{ justifyContent: "flex-end" }}>
               <div className="dock">
                 <button
                   className="btn"
                   onClick={() => startDraw("AUTO_PATH")}
                   aria-label="Auto path along roads"
                   title="Auto path along roads"
                 >
                   Auto
                 </button>
                 <button
                   className="btn"
                   onClick={() => startDraw("DRIVE_GPS")}
                   aria-label="Record a GPS track"
                   title="GPS track"
                 >
                   GPS
                 </button>
                 <button
                   className="btn"
                   onClick={() => {
                     setNapMode((v) => !v);
                     setPlaceMode(false);
                   }}
                   aria-pressed={napMode}
                   aria-label="Place a NAP box"
                   title="Place a NAP box"
                 >
                   NAP
                 </button>
                 <button
                   className="btn primary"
                   onClick={() => startDraw("MANUAL")}
                   aria-label="Draw new fiber line"
                 >
                   + Draw
                 </button>
               </div>
             </div>
           )}

          {basemapProgress && (
            <div
              className="map-readout"
              role="status"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 5 }}
            >
              Adding the province basemap{" "}
              {(basemapProgress.received / 1_048_576).toFixed(1)} of{" "}
              {(basemapProgress.total / 1_048_576).toFixed(1)} MB
            </div>
          )}
        </div>

        {(overlay !== "NONE" || tab !== "MAP") && (
          <div className="panel">
            {overlay === "SETTINGS" && (
              <Settings
                theme={theme}
                handedness={handedness}
                units={units}
                onThemeChanged={setTheme}
                onHandednessChanged={setHandedness}
                onUnitsChanged={setUnits}
                onOpenMapsManager={() => setOverlay("MAPS_MANAGER")}
                onBack={() => setOverlay("NONE")}
              />
            )}

            {overlay === "MAPS_MANAGER" && (
              <MapManager
                mapFiles={mapFiles}
                onSetActive={async (id) => {
                  try {
                    await db.mapFiles.toCollection().modify({ active: 0 });
                    await db.mapFiles.update(id, { active: 1 });
                    // The map only swaps archives when its key changes, so the
                    // new archive has to be mounted and the key pushed into
                    // the map. Setting the flag in the database alone left the
                    // map showing the old archive.
                    const info = await mountStoredArchive(id);
                    setBasemapKey(info.key);
                    setToast("Basemap switched.");
                  } catch (err) {
                    setToast(`Could not switch basemap: ${(err as Error).message}`);
                  }
                }}
                onDelete={async (id) => {
                  const wasActive = mapFiles.find((m) => m.id === id)?.active === 1;
                  await db.archiveBlobs.delete(id);
                  await db.mapFiles.delete(id);
                  if (wasActive) {
                    // The map was reading a blob that no longer exists.
                    setBasemapKey(null);
                    setToast("Basemap removed from this device.");
                  }
                }}
                onArchiveImported={() => {
                  setBasemapKey(getMountedKey());
                  setBasemapVersion((v) => v + 1);
                  setOverlay("NONE");
                  setToast("Basemap stored on this device.");
                }}
                onBack={() => setOverlay("SETTINGS")}
              />
            )}

            {overlay === "LINE_DETAIL" && selectedStats && (
              <LineDetail
                stats={selectedStats}
                pins={pins.filter((p) => p.lineId === selectedStats.line.id)}
                repairLogs={repairLogs.filter((r) => r.lineId === selectedStats.line.id)}
                chainageStyle={chainageStyle}
                pinColor={pinColor}
                otherWires={otherWires}
                onOpenOtherWire={(id) => openLine(id)}
                onBack={() => setOverlay("NONE")}
                onViewOnMap={() => snapToMap(selectedStats.line)}
                onFindByDistance={() => {
                  setOtdrLineId(selectedStats.line.id);
                  setOverlay("OTDR");
                }}
                onContinueLine={() => startDraw("MANUAL", selectedStats.line.id)}
                onAddSlackLoop={() => beginAddSlackLoop(selectedStats.line)}
                onPinClicked={focusPin}
                onDeleteLine={() => {
                  const s = selectedStats;
                  setPendingDelete({
                    kind: "LINE",
                    id: s.line.id,
                    name: s.line.name,
                    pins: s.totalPinsCount,
                    repairs: s.totalRepairs,
                  });
                }}
              />
            )}

            {overlay === "OTDR" && otdrLine && (
              <OtdrDialog
                line={otdrLine}
                pins={pins}
                chainageStyle={chainageStyle}
                onClose={() => setOverlay("NONE")}
                onLocateOnMap={(m) => {
                  setOtdrMatch(m);
                  setFollowMe(false);
                  setFocus({ lat: m.point.lat, lon: m.point.lon, zoom: 16 });
                  setTab("MAP");
                  setOverlay("NONE");
                }}
                onDropCutPinAtOtdr={(m) => void handleDropPinFromOtdr(m)}
              />
            )}

            {overlay === "NONE" && tab === "LINES" && (
              <LinesList
                lines={linesWithStats}
                chainageStyle={chainageStyle}
                onLineClick={(s) => openLine(s.line.id)}
                onSnapToMap={(s) => snapToMap(s.line)}
                onDeleteLine={(s) =>
                  setPendingDelete({
                    kind: "LINE",
                    id: s.line.id,
                    name: s.line.name,
                    pins: s.totalPinsCount,
                    repairs: s.totalRepairs,
                  })
                  }
              />
            )}

            {overlay === "NONE" && tab === "SHARE" && (
              <Share
                lines={lines}
                pins={pins}
                events={events}
                repairLogs={repairLogs}
                placeLabels={placeLabels}
                onOpenSettings={() => setOverlay("SETTINGS")}
              />
            )}
          </div>
        )}
      </main>

      <nav className="app-nav">
        {(
          [
            ["MAP", NAV_ICONS.map, "Map"],
            ["LINES", NAV_ICONS.lines, "Lines"],
            ["SHARE", NAV_ICONS.share, "Share"],
          ] as Array<[Tab, ReactNode, string]>
        ).map(([key, icon, label]) => (
          <button
            key={key}
            aria-current={tab === key && overlay === "NONE" ? "page" : undefined}
            onClick={() => {
              setTab(key);
              setOverlay("NONE");
              setNapMode(false);
            }}
          >
            <span className="icon" aria-hidden="true">
              {icon}
            </span>
            {label}
          </button>
        ))}
        <button
          aria-current={overlay === "SETTINGS" ? "page" : undefined}
          onClick={() => setOverlay(overlay === "SETTINGS" ? "NONE" : "SETTINGS")}
        >
          <span className="icon" aria-hidden="true">
            {NAV_ICONS.settings}
          </span>
          Settings
        </button>
      </nav>

      {wiresAtPoint && (
        <WiresSheet
          rows={wiresAtPoint
            .map((id) => {
              const s = linesWithStats.find((x) => x.line.id === id);
              if (!s) return null;
              return {
                id,
                name: s.line.name,
                status: s.line.status,
                colorKey: s.line.colorKey,
                lengthLabel: formatChainage(s.line.lengthMapM, chainageStyle),
                pins: s.totalPinsCount,
                openCuts: s.openCuts,
              };
            })
            .filter((r): r is WiresRow => r !== null)}
          tappedId={wiresAtPoint[0] ?? null}
          onPick={(id) => {
            setFocusedLineId(id);
            setWiresAtPoint(null);
          }}
          onClose={() => setWiresAtPoint(null)}
        />
      )}

      {selectedPin && (
        <PinSheet
          pin={selectedPin}
          lines={lines}
          events={events}
          chainageStyle={chainageStyle}
          isNew={isNewPinRef.current}
          onClose={() => {
            const pin = selectedPin;
            setSelectedPin(null);
            if (isNewPinRef.current && pin) {
              isNewPinRef.current = false;
              void deletePin(pin.id);
            }
          }}
          onSave={async (patch) => {
            isNewPinRef.current = false;
            await updatePin({ ...selectedPin, ...patch });
            setSelectedPin(null);
            setToast("Pin updated.");
          }}
          onMarkRepaired={async (method: RepairMethod, loss, note) => {
            await markPinRepaired(selectedPin.id, method, loss, note);
            const fresh = await db.pins.get(selectedPin.id);
            if (fresh) setSelectedPin(pinToDomain(fresh));
            setToast("Repair logged.");
          }}
          onDelete={() => setPendingDelete({ kind: "PIN", id: selectedPin.id })}
        />
      )}
      {labelDraft && (
        <PlaceLabelSheet
          name={labelDraft.name}
          lat={labelDraft.lat}
          lon={labelDraft.lon}
          isNew={labelDraft.id === null}
          onCancel={() => setLabelDraft(null)}
          onSave={async (name) => {
            const draft = labelDraft;
            setLabelDraft(null);
            if (draft.id) {
              const existing = placeLabels.find((l) => l.id === draft.id);
              if (existing) await savePlaceLabel({ ...existing, name });
              setToast("Name updated.");
            } else {
              await savePlaceLabel({
                id: uid(),
                name,
                lat: draft.lat,
                lon: draft.lon,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                deletedAt: null,
              });
              setToast(`"${name}" added to the map.`);
            }
          }}
          onDelete={async () => {
            const id = labelDraft.id;
            setLabelDraft(null);
            if (id) {
              await deletePlaceLabel(id);
              setToast("Name removed from the map.");
            }
          }}
        />
      )}

      {pendingDelete?.kind === "LINE" && (
        <ConfirmSheet
          title={`Delete "${pendingDelete.name}"?`}
          body={`The line, its ${pendingDelete.pins} pins and its ${pendingDelete.repairs} repair records come off the map and out of the list.`}
          confirmLabel="Delete line"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const id = pendingDelete.id;
            setPendingDelete(null);
            await deleteLine(id);
            setOverlay("NONE");
            setSelectedLineId(null);
            setToast("Line deleted.");
          }}
        />
      )}

      {pendingDelete?.kind === "PIN" && (
        <ConfirmSheet
          title="Delete this pin?"
          body="The cut, its repair log and its events come off the line."
          confirmLabel="Delete pin"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const id = pendingDelete.id;
            setPendingDelete(null);
            await deletePin(id);
            setSelectedPin(null);
            setToast("Pin deleted.");
          }}
        />
      )}

      {showLineForm && (
        <LineForm
          onCancel={() => setShowLineForm(false)}
          onSave={saveNewLine}
        />
      )}

      {slackDraft && (
        <SlackLoopSheet
          lineName={slackDraft.lineName}
          chainageM={slackDraft.chainageM}
          chainageStyle={chainageStyle}
          source={slackDraft.source}
          onCancel={() => setSlackDraft(null)}
          onSave={saveSlackLoop}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

function LineForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (form: {
    name: string;
    fiberType: string;
    coreCount: number | null;
    notes: string;
    colorKey: string;
    status: LineStatus;
  }) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [fiberType, setFiberType] = useState("G.652D Single Mode");
  const [coreCount, setCoreCount] = useState("24");
  const [notes, setNotes] = useState("");
  const [colorKey, setColorKey] = useState("blue");
  const [status, setStatus] = useState<LineStatus>("ACTIVE");
  const sheetRef = useRef<HTMLDivElement>(null);

  const submit = () =>
    onSave({
      name,
      fiberType,
      coreCount: Number(coreCount) || 0,
      notes,
      colorKey,
      status,
    });

  useDialog(sheetRef);
  useEnter(submit);

  return (
    <div className="scrim" onClick={onCancel}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="grow" id="line-form-title">
            Save fiber line
          </h2>
          <button className="btn ghost" onClick={onCancel} aria-label="Close line form">
            ✕
          </button>
        </div>
        <div className="sheet-body">
          <div className="field">
            <label htmlFor="line-name">Line name</label>
            <input
              id="line-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sulop - Prosperidad Trunk"
            />
          </div>
          <div className="field">
            <label htmlFor="line-type">Fiber type</label>
            <input
              id="line-type"
              value={fiberType}
              onChange={(e) => setFiberType(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="line-cores">Core count</label>
            <input
              id="line-cores"
              inputMode="numeric"
              value={coreCount}
              onChange={(e) => setCoreCount(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Color</label>
            <div className="chips">
              {FIBER_COLORS.map((c) => (
                <button
                  key={c}
                  className="chip"
                  aria-pressed={colorKey === c}
                  onClick={() => setColorKey(c)}
                  style={
                    colorKey === c
                      ? { background: c, borderColor: c, color: "#fff" }
                      : undefined
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Status</label>
            <div className="chips">
              {(["ACTIVE", "PLANNED", "DAMAGED", "RETIRED"] as LineStatus[]).map((s) => (
                <button
                  key={s}
                  className="chip"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="line-notes">Notes (optional)</label>
            <textarea
              id="line-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="sheet-foot">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={() =>
              void onSave({
                name: name.trim(),
                fiberType: fiberType.trim(),
                coreCount: parseInt(coreCount, 10) || null,
                notes: notes.trim(),
                colorKey,
                status,
              })
            }
          >
            Save line
          </button>
        </div>
      </div>
    </div>
  );
}

function SlackLoopSheet({
  lineName,
  chainageM,
  chainageStyle,
  source,
  onCancel,
  onSave,
}: {
  lineName: string;
  chainageM: number;
  chainageStyle: boolean;
  source: "GPS" | "MIDPOINT";
  onCancel: () => void;
  onSave: (totalM: number) => void | Promise<void>;
}) {
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const parsed = parseFloat(total);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSave(parsed);
    } finally {
      setBusy(false);
    }
  };

  useDialog(sheetRef);
  useEnter(() => {
    void submit();
  });

  return (
    <div className="scrim" onClick={onCancel}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slack-loop-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="grow" id="slack-loop-title">
            Add slack loop
          </h2>
          <button className="btn ghost" onClick={onCancel} aria-label="Close slack loop form">
            ✕
          </button>
        </div>
        <div className="sheet-body">
          <div className="card stack" style={{ gap: 4 }}>
            <span className="small muted">{lineName}</span>
            <strong>{formatChainage(chainageM, chainageStyle)}</strong>
            <span className="small muted">
              {source === "GPS"
                ? "Your GPS position, snapped to the line."
                : "Middle of the line — no GPS fix near this route."}
            </span>
          </div>
          <div className="field">
            <label htmlFor="slack-total">Total slack (m)</label>
            <input
              id="slack-total"
              autoFocus
              inputMode="decimal"
              placeholder="300"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
        </div>
        <div className="sheet-foot">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!valid || busy}
            onClick={() => void submit()}
          >
            Add loop
          </button>
        </div>
      </div>
    </div>
  );
}

export type { PinType };
