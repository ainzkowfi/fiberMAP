import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeCumulativeDistances,
  haversineDistance,
  type GeoPoint,
} from "../core/geometry";

export interface GpsFix {
  point: GeoPoint;
  accuracyM: number;
  speedKmh: number;
  timestamp: number;
}

const MAX_ACCURACY_M = 35;
const MIN_STEP_M = 8;

/**
 * Browser equivalent of the Android GpsRouteTracker: watchPosition feed,
 * accuracy gate at 35 m, and an 8 m jitter filter before a vertex is recorded.
 */
/**
 * `highAccuracy` is the difference between "show me roughly where I am" and
 * "trace the route I am driving". The high-accuracy mode keeps the GNSS
 * receiver on continuously and is worth it while recording a line; for the map
 * dot and the location button it drains a field phone for no visible gain.
 */
export function useGpsTracker(enabled: boolean, highAccuracy = false) {
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [vertices, setVertices] = useState<GeoPoint[]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const verticesRef = useRef<GeoPoint[]>([]);
  const trackingRef = useRef(false);
  const pausedRef = useRef(false);

  const appendPoint = useCallback((point: GeoPoint) => {
    const current = verticesRef.current;
    if (current.length === 0) {
      verticesRef.current = [point];
      setVertices([point]);
      setDistanceM(0);
      return;
    }
    const last = current[current.length - 1];
    if (haversineDistance(last, point) < MIN_STEP_M) return;
    const updated = [...current, point];
    verticesRef.current = updated;
    setVertices(updated);
    const cum = computeCumulativeDistances(updated);
    setDistanceM(cum[cum.length - 1] ?? 0);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // The phone will not hand over a position over plain http on a LAN
    // address. Geolocation is a secure-context-only API, so the map would
    // sit on its fallback centre with no explanation. Say why instead.
    if (!window.isSecureContext) {
      setError("This phone will not share a position over http. Open the app over https.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not available in this browser");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        const next: GpsFix = {
          point: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          accuracyM: pos.coords.accuracy,
          speedKmh: (pos.coords.speed ?? 0) * 3.6,
          timestamp: pos.timestamp,
        };
        setFix(next);
        if (trackingRef.current && !pausedRef.current && next.accuracyM <= MAX_ACCURACY_M) {
          appendPoint(next.point);
        }
      },
      (err) => setError(err.message),
      {
        enableHighAccuracy: highAccuracy,
        // A 30 second old fix is plenty for centring the map, and letting the
        // browser reuse one is much kinder to the battery than reacquiring.
        maximumAge: highAccuracy ? 1000 : 30_000,
        timeout: highAccuracy ? 15_000 : 45_000,
      },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, highAccuracy, appendPoint]);

  const start = useCallback(() => {
    trackingRef.current = true;
    pausedRef.current = false;
    verticesRef.current = [];
    setVertices([]);
    setDistanceM(0);
    setIsTracking(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setIsPaused(false);
  }, []);

  const undo = useCallback(() => {
    const updated = verticesRef.current.slice(0, -1);
    verticesRef.current = updated;
    setVertices(updated);
    const cum = computeCumulativeDistances(updated);
    setDistanceM(cum[cum.length - 1] ?? 0);
  }, []);

  const reset = useCallback(() => {
    trackingRef.current = false;
    pausedRef.current = false;
    verticesRef.current = [];
    setVertices([]);
    setDistanceM(0);
    setIsTracking(false);
    setIsPaused(false);
  }, []);

  return {
    fix,
    isTracking,
    isPaused,
    vertices,
    distanceM,
    error,
    start,
    pause,
    resume,
    undo,
    reset,
  };
}
