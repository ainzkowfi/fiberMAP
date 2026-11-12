# fiberMAP basemap

`agusan-del-sur-full.pmtiles` is a custom vector tile archive covering the
whole Agusan del Sur province, built from OpenStreetMap with planetiler.

| | |
|---|---|
| Size | 9.21 MB |
| Bounds | 124.85 / 7.55 → 126.45 / 9.15 (E / N) |
| Zoom | 0 to 15 |
| Tiles | 12,802 |
| Schema | `schema.yml` (roads, water, boundaries, place labels) |
| Source | OSM `caraga` extract, replication 2026-11-11 |

The app serves it from `web/public/maps/`. It **is** in the service worker
precache, so a crew who installs the app has the whole province offline before
they walk to the first pole. The app also copies it into IndexedDB on first
run, and the phone range-reads tiles straight out of that Blob. See
`web/src/ui/pmtilesStore.ts`.

## Why not the archive that came with the repo

`MAP FILES/agusan-del-sur.pmtiles` (2.28 MB, Protomaps schema) only covers
lat 7.94 to 8.20. That is the Davao Gulf strip. San Francisco (8.5085),
Prosperidad (8.583) and Bayugan (8.712) are all outside it, so the northern
half of the province had no basemap at all.

## Rebuilding

Needs Java 21+ and the planetiler jar.

```powershell
# 1. OSM extract. Geofabrik has no Philippines sub-regions, use openstreetmap.fr.
#    The "caraga" extract is the one that actually covers the province.
curl.exe -fLo caraga.osm.pbf https://download.openstreetmap.fr/extracts/asia/philippines/caraga-latest.osm.pbf

# 2. planetiler
curl.exe -fLo planetiler.jar https://github.com/onthegomap/planetiler/releases/download/v0.10.2/planetiler.jar

# 3. Build. Point osm_local_path in schema.yml at your caraga.osm.pbf first.
java -Xmx8g -jar planetiler.jar generate-custom `
  --schema=schema.yml `
  --output=agusan-final.pmtiles `
  --maxzoom=15 --minzoom=0 --force `
  --nodemap_type=sortedtable --nodemap_storage=ram `
  --storage=mmap --tmpdir=D:\fibermap-build\data\tmp `
  --threads=4 `
  --bounds=124.85,7.55,126.45,9.15 `
  --max_point_buffer=32 `
  --simplify_tolerance=0.5 --simplify_tolerance_at_max_zoom=0.25 `
  --min_feature_size=2

# 4. Ship it
copy agusan-final.pmtiles ..\public\maps\agusan-del-sur-full.pmtiles
```

### Flags that matter

| Flag | Why |
|---|---|
| `--nodemap_type=sortedtable --nodemap_storage=ram` | `array` needs a dense array over 14 billion node IDs and OOMs. `sparsearray` drops node locations and silently loses geometry. This pair is the only one that works. |
| `--storage=mmap --tmpdir=...` | Keeps the temp feature DB off the heap. Put `tmpdir` on the drive with free space, not C:. |
| `--bounds=...` | Cuts the tile grid to the province. Without it the archive covers the whole extract. |
| `--maxzoom=15` | z16 was 15.47 MB for detail a fibre crew never reads. |

### Schema notes

- `landuse` and `places` stop at z12. Beyond that they were 3.4 MB of
  farmland polygons and crowded labels.
- Every attribute needs an explicit `tag_value:`. A bare `- key: name`
  yields no data at all.
- `value:` cannot take a map. Use one feature per tag value, or
  `value: '${ match_key }'`.
- `point_label_grid` does not exist in planetiler 0.10.2.

## Inspect

```powershell
.\..\MAP FILES\pmtiles.exe show agusan-final.pmtiles
```

### Does the archive cover a spot?

Extract the tiles for the point and look at the size. An empty area comes back
as a few hundred bytes.

```powershell
.\..\MAP FILES\pmtiles.exe extract agusan-final.pmtiles check.pmtiles --bbox=126.14,8.00,126.18,8.04 --minzoom=14 --maxzoom=14
(Get-Item check.pmtiles).Length
```
