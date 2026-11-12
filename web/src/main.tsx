import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { setWorkerUrl } from "maplibre-gl";
// MapLibre v6 ships as ES modules only and loads its map worker as a real
// URL. Under a bundler that URL does not resolve on its own, so the worker has
// to be handed over explicitly. Without it the worker fails to load and the
// map comes up blank, because the worker is what fetches the vector tiles.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import App from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./theme.css";

setWorkerUrl(maplibreWorkerUrl);

registerSW({ immediate: true });

// A new build is precached by a fresh service worker. When it takes control,
// reload so the crew is never left running a stale shell. The first install
// is skipped: there is no old build to replace and reloading would just
// interrupt the first time they open the app.
let hadController = false;
let refreshing = false;

navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (!hadController) {
    hadController = true;
    return;
  }
  if (refreshing) return;
  refreshing = true;
  window.location.reload();
});

if (navigator.serviceWorker?.controller) hadController = true;

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
