---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: []
---

# fiberMAP field app

Scope: the whole phone app (map, line record, lines list, sheets). Mode:
Operate.

Audience: field technicians who maintain the fibre network in Agusan del Sur,
outdoors, one-handed, in sun. Their job in the app: capture a route, drop a
pin where they stand, and read back what is already on the line.

Constraints: every feature and both themes stay; no animations or
transitions; 48px targets; offline PWA on a phone.

## Grounded directions considered

Direction scope seed `b9be3cd8`, mode operate. Seven candidates from the
crew's own world, in resonance order:

1. Fibre colour code chart — the IEC 60757 stripe chart as the layout grammar.
2. OTDR trace sheet — the trace curve as the spine of every screen.
3. Route shield signage — chainage markers and road shields.
4. Cable drum label — stencilled drums and tape wrap.
5. Splice closure plate — engraved FOSC plates and field tags.
6. Cable drum & splice sheet — **built**: graphite tool, white work sheet,
   marker's yellow, chainage tape.
7. Marker paint line — hi-vis ground marking as the whole visual language.

## Direction contract

THESIS: The interface is the tool and the work sheet, not a dashboard. It
refuses the category default of floating cards on a soft grey map with a
teal accent scattered across it, and refuses the "everything is a card"
answer to a screen that a thumb has to work in sunlight.

OWN-WORLD: Graphite header and nav band (`--shell`), white work surfaces,
hairline rules instead of card borders, the fibre's own colour as the only
colour on the data, and marker's yellow (`--accent`) for the one thing that
means "armed and waiting". Nothing moves.

STORY: The crew opens the app on a bright map under a graphite band. They
draw a route with one tap sequence, drop a NAP that snaps to the wire, and
when they pick a line the map grows a chainage tape showing every pin at its
true distance. The line record reads as a printed sheet: name, tape, four
numbers, then the loops, the pins, the repairs.

FIRST VIEWPORT: The map fills the frame. A 38px graphite header carries the
product name and the region. The bottom of the screen holds a 48px action
dock (Auto, GPS, NAP, Draw) at the right and three square map controls at the
left, with the OSM credit beside them. Above the nav bar, and only while a
line is selected, the chainage tape sits on a raised white surface. The
primary action (Draw) is the darkest object in the dock.

FORM: Cable drum & splice sheet — candidate 6 of the grounded list, seed key
`b9be3cd8`. Built code-first.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance
