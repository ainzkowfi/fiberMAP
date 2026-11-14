# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Field technicians who maintain the fibre network in Agusan del Sur, Philippines. They work outdoors, one-handed, in sunlight, often while walking or driving a route. Secondary audience: the office engineer who reviews the line record and the repair log.

## Product Purpose

fiberMAP is the field record of the fibre network: where each line runs, what is attached to it (cuts, joints, NAPs, slack coils), and what was repaired. Success is a technician finding the right span, in the right place, in seconds, with no signal and no server.

## Positioning

Offline-first and serverless. Every record lives in the phone's own database, so the crew keeps working where there is no network, and the record never depends on somebody else's uptime. Chainage is the spine: every pin knows its distance along its line, which is what an OTDR trace and a splice sheet speak in.

## Operating Context

- Walking or driving the actual route, phone in one hand, in direct sun.
- Base map is a downloaded province archive (PMTiles), so the map works with the radio off.
- Cable work vocabulary: chainage, slack loop, NAP, FOSC joint, splice loss, OTDR distance.
- A cut is found by OTDR distance, then walked to; the app locates it on the line and drops a pin.

## Capabilities and Constraints

- Fully offline PWA: React + Vite, IndexedDB (Dexie), MapLibre GL with a local PMTiles basemap.
- No server, no account, no sync. Data lives on the device only.
- Light and dark themes; the app must stay legible in daylight.
- Touch targets at least 48 px; one-handed use, no hover-only affordances.
- Native browser `alert`/`confirm` are not used; every confirmation is an in-app sheet.
- No animations or transitions anywhere in the UI (confirmed constraint).
- Chainage is shown either as metres or as station notation (0+457 m), by user setting.
- Units of measurement, handedness and theme are user settings.

## Brand Commitments

- Name: fiberMAP. Voice: plain, field-technician language. No marketing tone, no exclamation marks.
- The map is the product; panels and controls must never fight it for attention.
- Icons are hand-drawn SVG in one stroke weight, not an icon font or emoji.

## Evidence on Hand

- Real crew data lives on each device's IndexedDB; no server copy exists to fall back on.
- `web/basemap/README.md` documents the province PMTiles archive and its OSM attribution (required in the UI).
- The README documents the data model and the offline deployment constraints.
- No testimonials, customer logos, pricing or usage analytics exist, and none may be invented.

## Product Principles

- The map is the surface. Everything else gets out of its way.
- Chainage first: a number a splicer can use beats a description.
- One hand, one thumb: the primary action sits where the thumb is.
- Offline is the normal case, not the fallback.
- Say what happened and what to do next; never block the crew with ceremony.

## Accessibility & Inclusion

Minimum 48 px targets, body text at 4.5:1 or better against its background, no information carried by colour alone, and a dark theme that holds up in a phone's night mode.
