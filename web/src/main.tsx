import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./theme.css";

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
