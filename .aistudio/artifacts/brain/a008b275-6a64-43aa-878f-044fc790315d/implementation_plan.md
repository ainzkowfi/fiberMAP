# fiberMAP: Fluid Dragging, Snap-to-Location, Hold-to-Drop Pins & Splice Loss Logging

A field-first update to fiberMAP ensuring effortless map dragging, tap-to-focus navigation from line and pin lists, direct long-press pin placement anywhere (including off-street client compounds), and streamlined repair logging featuring optical splice loss metrics (e.g., `0.01 dBm` / `0.02 dB`).

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following core interaction improvements have been synthesized from your field workflow requirements:

- **Confirmed Decision 1: Hold-to-Drop Anywhere (Off-Street & On-Line)**: Technicians can long-press anywhere on the map to drop a pin directly at that touch location. If the point is near a fiber line, it presents an optional snap with chainage, but technicians can freely save pins at off-road client premises or remote customer drops without being forced to align with streets.
- **Confirmed Decision 2: Direct Repair & Splice Loss Logging**: Incidents can be entered directly as completed repairs (representing a cut that has been found and spliced), including optical fusion splice loss details (`0.01 dBm` / `0.02 dB`), splice closure type, and timestamp. Pins can still toggle between open cut and repaired at any time.
- **Confirmed Decision 3: Snap & Zoom from Lists**: Tapping any line or pin entry in the Lines list, Line Detail view, or hardware table immediately switches to the Map and smoothly centers and zooms the camera onto that exact pin coordinate or line route.
- **Confirmed Decision 4: Fluid Map Dragging**: The map gesture handler is refactored to ensure high-framerate drag and fling movement without hit-testing conflicts between single taps, drags, and long-presses.

---

### 1. Overview & Core Concept

Field fiber restoration in Agusan del Sur occurs outdoors, often in poor lighting or adverse weather. Technicians rarely need a theoretical cut entry before fixing a broken span; rather, once an incident is located and spliced in the field, they log the repair with its optical attenuation (e.g. `0.01 dBm` splice loss). Furthermore, fiber lines frequently deviate from roads to reach rural client compounds, requiring arbitrary off-street pin placement and custom line drawing.

This upgrade enhances the app with:
1. **Unconstrained Dragging & Panning**: Zero-lag canvas gestures for continuous map navigation.
2. **List-to-Map Snapping**: Selecting a line or pin anywhere in the app immediately centers and focuses the camera on its geographical position.
3. **Long-Press Pin Placement**: Hold anywhere on the map to drop a cut, repair, pole, NAP box, or note at the exact touch location.
4. **Optical Splice Loss Logging**: Support for logging fusion/mechanical splice losses in `dBm` / `dB` directly on repair pins.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Hold to Place Pin**:
   - Long-press any location on the map (on-road or off-road).
   - A haptic tick triggers and a quick-placement sheet opens at that exact coordinate.
   - Select pin type (Repair / Splice, NAP, Pole, Coil, or Cut) with optional optical splice loss field (e.g., `0.01 dBm`).
2. **Click Entry to Snap**:
   - In the Lines tab, tap a fiber line or expand a specific pin (e.g. "NAP-08" or "Cut at Km 1+240").
   - The app switches to the Map tab and smoothly shifts `cameraCenter` and `zoomLevel` directly onto that element, with an active highlight ring.
3. **Direct Repair Transition**:
   - Tap any pin on the map or list to view details.
   - Tap **"Mark Repaired / Spliced"** to log the repair method (Fusion Splice, Mechanical, Replaced Span), technician note, and measured optical loss (defaulting to clean `0.01 dBm` fusion loss).

#### Visual Design Tokens (Material 3)
- **Primary Field Accent (Jacket Teal)**: `#0A7C8C` (Light) / `#14A3B8` (Dark)
- **Repaired / Spliced Green**: `#2F8F5B` (Light) / `#38B26C` (Dark)
- **Emergency Cut Red**: `#C8372D` (Light) / `#E64A38` (Dark)
- **Splice Metric Badge**: High-contrast pill showing e.g. `0.01 dBm Loss` in bold typography.

---

### 3. Key Product Decisions & Trade-Offs

- **Map Gesture Architecture (`pointerInput` with `detectTapGestures` + `detectDragGestures`)**:
  - *Chosen Approach*: Unify touch handling into a dedicated drag & tap gesture detector that differentiates immediate drags from 400ms long-presses and single taps.
  - *Why*: Eliminates gesture interception stutter so users can drag smoothly anywhere on the screen while still supporting tap-to-select and hold-to-place.
- **Direct Repair Logging vs. Multi-Step Cut Lifecycle**:
  - *Chosen Approach*: Allow logging repairs directly from the pin drop sheet (type `CUT_REPAIR` with state `REPAIRED` and splice loss), while retaining full support for flagging open cuts when needed.
  - *Why*: Matches reality: technicians often record work *after* restoring service rather than entering pending tickets.
- **Coordinate-Based Camera Navigation**:
  - *Chosen Approach*: StateFlow for `cameraFocusTarget: Pair<GeoPoint, Float?>?` that triggers animated camera repositioning whenever an item is selected from a list.
  - *Why*: Provides instant spatial orientation from list records to the physical terrain.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      UI & Interaction                       │
│                                                             │
│  LinesListScreen / LineDetailScreen                         │
│         │ (tap line or pin)                                 │
│         ▼                                                   │
│  FiberMapApp (navigates to MapTab, sets cameraTarget)       │
│         │                                                   │
│         ▼                                                   │
│  OfflineVectorMapView                                       │
│    ├── Fluid Drag Gestures (pan without GPS lock)           │
│    ├── Long-Press Gesture (hold click -> target GeoPoint)   │
│    └── Camera Snap (re-centers on selected pin/line bounds) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Data Model & Persistence                    │
│                                                             │
│  PinEntity:                                                 │
│    - spliceLossDbm: Double? (e.g. 0.01)                     │
│    - state: "repaired" | "open" | "none"                    │
│                                                             │
│  PinEventEntity:                                            │
│    - kind: "repaired"                                       │
│    - spliceLossDbm: Double?                                 │
│    - repairMethod: "fusion" | "mechanical"                  │
│                                                             │
│  Room DB -> FiberRepository -> CalculateLineStatsUseCase    │
└─────────────────────────────────────────────────────────────┘
```

#### Entities & Schema Updates
1. **`PinEntity` & `PinEventEntity`**:
   - Add `spliceLossDbm: Double? = null` (e.g., `0.01` for `0.01 dBm`).
   - Add formatted string accessor (e.g. `0.01 dBm` or `0.02 dB`).
2. **`OfflineVectorMapView`**:
   - Refactor `detectTapGestures(onLongPress = { ... }, onTap = { ... })` and `detectDragGestures` to run concurrently without swallowing drag offsets.
   - Accept `focusLocation: GeoPoint?` and `focusZoom: Float?` to smoothly animate map position when navigating from lists.
3. **`DropPinSheet`**:
   - Support direct "Repaired / Spliced" selection with input field for Optical Splice Loss (`0.01 dBm`).
   - Remove mandatory GPS or road snapping requirements, allowing arbitrary coordinates for rural customer drops.
4. **`CalculateLineStatsUseCase`**:
   - Continues providing accurate MTTR, total cuts, total repairs, and cuts/km even when repairs are logged directly.

---
