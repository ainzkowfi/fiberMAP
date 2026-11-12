# Third party material

## go-pmtiles

- `pmtiles-LICENSE` is the BSD 3-clause licence of
  [go-pmtiles](https://github.com/protomaps/go-pmtiles), Protomaps LLC, 2021.
- `pmtiles-README.md` is the readme that came with the go-pmtiles release.

The `pmtiles.exe` binary in `MAP FILES/` is the go-pmtiles command line tool.
It is not committed (it is 56 MB) and it is not needed to build or run the
app: it only inspects and extracts PMTiles archives. The archive is built with
planetiler, and the recipe is in `web/basemap/README.md`.

## OpenStreetMap data

The basemap in `web/public/maps/agusan-del-sur-full.pmtiles` is built from
OpenStreetMap data. See `OSM-NOTICE.md` in this folder for the attribution
and the licence of that data.
