# fiberMAP design system

**World:** cable drum & splice sheet. Graphite is the tool and the truck; the
work surface is a clean white sheet; the only loud colour is the marker's
yellow, used when a tool is armed and waiting. Fibre colours (IEC 60757) carry
the data, so the interface stays out of their way.

**Audience:** field technicians, outdoors, one-handed, in sun. Chrome recedes,
the map is the brightest thing on screen, and nothing moves.

**Mode:** Operate. The world lends type, palette, density and one signature
move (the chainage tape). Navigation and controls stay the standard ones.

## Colors

Every token lives in `web/src/theme.css`. The light set is the default; the
dark set is the same system with the ground turned down.

| Token | Light | Dark | Job |
|---|---|---|---|
| `--paper` | `#e8ebed` | `#0a1014` | App ground behind panels |
| `--surface` | `#ffffff` | `#121a1f` | Work surface: cards, sheets, rows |
| `--surface-sunken` | `#dee3e6` | `#0c1317` | Recessed channels (the tape track) |
| `--surface-variant` | `#e9edef` | `#1b262c` | Hover, chips, quiet fills |
| `--ink` | `#0d1519` | `#edf3f5` | Primary text, primary buttons |
| `--ink-soft` | `#33424a` | `#c0cdd3` | Secondary text |
| `--muted` | `#56666f` | `#93a3ac` | Labels, captions, inactive icons |
| `--border` | `#c6ced3` | `#2b3940` | Hairlines between rows |
| `--border-strong` | `#7e8d95` | `#566a73` | Control borders |
| `--shell` | `#111b21` | `#050a0d` | Header and nav band |
| `--shell-ink` | `#e9eef1` | `#dce5e9` | Text on the shell |
| `--shell-muted` | `#92a2ab` | `#8595a0` | Inactive nav items |
| `--accent` | `#f2c200` | `#f2c200` | Marker's yellow: armed tools, live tab |
| `--accent-ink` | `#14181a` | `#14181a` | Text on the yellow |
| `--jacket` | `#075e6b` | `#3fc8dc` | Actions and selection |
| `--cut` | `#b4231a` | `#ff8a7b` | Open cut |
| `--repaired` | `#14683c` | `#56d394` | Repaired |
| `--planned` | `#3a5a80` | `#9cc0e8` | Planned line |

Sizes: `--tap 48px`, `--nav-height 62px`, `--radius 10px`, `--radius-sm 6px`.
One shadow only: `--shadow-float`, for things that float over the map.

## Typography

One family: the platform workhorse sans (`"Segoe UI", Roboto, system-ui,
-apple-system, sans-serif`). No display face, no serif, no web font: the app
runs offline from a phone, so nothing may be fetched.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Product name | 15px | 700 | Uppercase, 0.14em tracking, on the shell |
| Screen title | 16-20px | 700 | Sheet and record titles |
| Section heading | 14px | 700 | Sentence case |
| Body | 15px | 400 | 1.45 leading |
| Secondary | 13px | 400 | `--ink-soft` |
| Label, caption | 11-12px | 600-700 | `--muted`; field labels are 12px/700 |
| Figure key | 10px | 700 | Uppercase, 0.08em, `--muted` |
| Measurement | 15-17px | 700 | `font-variant-numeric: tabular-nums`, never wrapping |

Monospace is reserved for machine output (`code`, QR payloads, export text),
never worn as decoration.

## Pins

Every pin type has its own shape, so a crew reads the map by shape first and
colour second. Pins are DOM markers, not map layers, because the shape needs
its own transform (a cut is a diamond, a NAP is a square).

| Pin | Shape | Colour |
|---|---|---|
| Cut, open | diamond | `#c8372d` |
| Cut, repaired | diamond | `#2f8f5b` |
| Splitter / NAP | square | `#00b4d8` |
| Joint closure | hexagon | `#0a7c8c` |
| Pole / handhole | triangle | `#6b7a84` |
| Slack coil | circle | `#f5a623` |
| Field note | dot | `#8a99a2` |

The key that floats on the map (top-left, behind one button) lists the same
table, so the legend and the map can never disagree.

## Rules

1. **One container level.** A card is the sheet the work sits on. Rows inside
   it are rows: no border, no radius, a hairline between them.
2. **Graphite chrome.** The header and the nav bar are one solid band in
   `--shell`. Content is white. The map is the only bright surface.
3. **Yellow means armed.** A tool that is waiting for the next tap shows
   `--accent`. Nothing else uses it, so it always reads as "live".
4. **Measurements are tabular.** Chainage, lengths and totals use
   `font-variant-numeric: tabular-nums`; the figures row never wraps.
5. **Chainage is the spine.** The chainage tape (see below) is the app's one
   signature move and it appears in both the line record and on the map.
6. **Nothing moves.** No transitions, no animations, no camera easing. State
   changes are instant, so a gloved hand never waits for an effect.
7. **Destructive actions are outlined.** A red outline, never a red fill: the
   crew has to reach it in a hurry without it being the loudest thing on the
   sheet.
8. **One line of type per idea.** Labels are sentence case and 12-13px;
   uppercase is reserved for figure keys and the product name.
9. **Lines that share a corridor get fanned apart.** Two cables on the same
   road are drawn ten pixels apart so both stay visible and tappable; the data
   on disk is untouched.

## Components

- **App shell.** Graphite header (name + region) above the map; graphite nav
  bar below it with four tabs; the active tab is marked with a yellow rule.
- **Action dock.** The map's tools live in one raised surface at the bottom
  right: Auto · GPS · NAP · Draw. Drawing swaps it for Cancel · Save line.
- **Chainage tape.** The line drawn as a ruler: graduations every step, pin
  marks at their true distance, the fibre's own colour as the cable. On the
  map it rides above the dock, and only for the line the crew tapped: the app
  never puts it on screen by itself.
- **Figures row.** Four numbers divided by hairlines: Length, Cable, Cuts,
  Open. The record sheet's spine.
- **Line record.** Name and fibre type, the tape, the figures row, the two
  route actions, then slack loops, pins and the repair log as sections.
- **Sheets.** Rounded top, one hairline under the title, a footer of actions
  that is always the same height. Nothing animates in or out.
