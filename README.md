# fiberMAP

An offline map of the fibre infrastructure in Agusan del Sur, for the crews
that maintain it.

Two applications live in this repository:

| | |
|---|---|
| `app/` | The original Android app. It still builds, it is the prototype. |
| `web/` | The web app. A PWA that runs in a phone browser, works with no signal, and is the one being worked on. |

The web app is the source of truth for the records: the same lines, cuts,
repairs and place names, on the phone, with no server and no account.

## Running it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # type check and build into web/dist
npm run preview    # serve the built app
npm test           # unit tests
npm run contrast   # check every text colour against its background
```

## Deploying it

Serve `web/dist` as static files over **https**.

Https is not a formality here:

- **Geolocation only works over https.** Over plain http on a LAN address the
  browser will not hand over a position at all, and the map sits on its
  fallback centre with no fix.
- **The camera only works over https.** The QR scanner needs it.
- **The service worker only works over https** (or on localhost), so the
  offline install needs it.

Any static host works: a web server, a CDN, or a hosting platform. The build
output is plain files with hashed names, so there is nothing to configure on
the server beyond serving `index.html` for the root path.

## The records

Everything is on the device, in IndexedDB. Nothing is sent anywhere.

| Table | What it holds |
|---|---|
| `lines` | The routes: name, status, colour, core count, the geometry, the length. |
| `pins` | The cuts, the joints, the NAPs, the slack coils, with their chainage on the line. |
| `pinEvents` | What happened to a pin: a cut, a repair. |
| `repairLogs` | The closed repairs: the method, the splice loss, who did it, when. |
| `placeLabels` | Names the crew put on the map for places OSM does not know. |
| `mapFiles` | The base map archives on this device. |
| `settings` | Theme, handedness, units, and the time of the last backup. |

Deleting a record never throws it away. The row is marked with a timestamp and
the app stops showing it. That is what lets a bundle carry a deletion to
another phone.

### The bundle

The exchange format is `fiberMAP-bundle` JSON, the same one the Android app
reads. Version 2 adds `deletedAt` to every row so a deletion travels with the
data. Version 1 bundles are still read; they have no `deletedAt`, so they can
never delete anything.

An import merges by time, not by arrival. A row in the bundle wins only if it
is strictly newer than the row already on the phone. A record deleted here
stays deleted unless the incoming row is newer than the deletion. Before
anything is written, the app shows what the import would do: new, updated,
skipped and deleted counts.

## Backup and sharing

**Backup file.** Settings, then "Save backup file". The whole bundle is
gzipped into `fibermap-YYYY-MM-DD.fmap` and handed to the phone's share
sheet, or downloaded where the phone has no share sheet. "Open backup file"
takes a `.fmap` or a plain `.json` and goes through the same preview before
anything is written.

**Storage protection.** The app asks the browser to keep the data when the
phone runs out of room. Settings says whether the browser agreed. A backup file
is still the copy that survives the browser changing its mind.

**QR transfer.** The Share screen turns the bundle into QR frames. The payload
is deflated and base64url encoded first, so a bundle fits in one or two codes
instead of a handful. The other phone scans them with its own camera, in any
order, and every checksum is checked before the import preview appears. The
paste-the-text path is still there when the camera is not an option.

**Snapshot restore.** Settings, "Open backup file", then the preview. The
records are merged by time, so restoring an old backup never undoes newer
work.

## The base map

`web/public/maps/agusan-del-sur-full.pmtiles` is the whole province: every
town and barangay in Agusan del Sur, with street names down to z15. It is
built from the OpenStreetMap `caraga` extract with planetiler; the recipe and
the flags are in `web/basemap/README.md`.

The file is in the service worker precache, so a crew who installs the app has
the province offline before they walk to the first pole.

Two copies of the same file are in the repository, byte for byte:

| Copy | Size |
|---|---|
| `web/public/maps/agusan-del-sur-full.pmtiles` | 9.21 MB |
| `MAP FILES/agusan-del-sur-full.pmtiles` | 9.21 MB |

The app reads the one under `web/public/maps/`, because that is the path the
build and the precache use. The copy in `MAP FILES/` is the spare, and it is
the one to drop. Nothing has been deleted: the choice belongs to the owner.

`MAP FILES/agusan-del-sur.pmtiles` is the older 2.18 MB archive that came with
the repository. It only covers lat 7.94 to 8.20, so it misses San Francisco,
Prosperidad and Bayugan. It is kept for reference and is not used.

## The native app

The web app is also wrapped as a native Android app with Capacitor. The native
project lives in `web/android/` and is built from the web app's output:

```bash
cd web
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK ends up at `web/android/app/build/outputs/apk/debug/app-debug.apk`.
The Android SDK at `D:\Android\Sdk` (platform 34-36) and JDK 21 are what the
build uses.

The web app is the source of truth: the native side only provides the phone
itself (the GPS, the camera, the file picker). The service worker does not run
in the native shell, because the app's own assets are already on the phone.

## The audits

`anti-slop/` holds the audit rounds and what was fixed in each. Read them for
the reasons behind the current shape of the app.
