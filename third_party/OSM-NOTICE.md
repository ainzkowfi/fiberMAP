# OpenStreetMap data notice

The basemap `web/public/maps/agusan-del-sur-full.pmtiles` is made of OpenStreetMap
data. The map is built from the `caraga` regional extract of the OpenStreetMap
database, downloaded from openstreetmap.fr, and turned into vector tiles with
[planetiler](https://github.com/onthegomap/planetiler).

## Attribution

The app shows the credit on the map:

> © OpenStreetMap contributors

That is the required attribution for using OpenStreetMap data, and it must stay
on the map wherever the data is shown.

## Licence

OpenStreetMap data is licensed under the
[Open Database License](https://www.openstreetmap.org/copyright) (ODbL), 1.0.
The ODbL allows use and redistribution with attribution, and requires that any
derived database be shared under the same licence.

The tile schema and the build recipe are in `web/basemap/`. The archive is
built from the raw OSM extract, so the tiles are a derived work of OpenStreetMap
data and carry the same licence and attribution.

## What was not used

Only OpenStreetMap data is in the archive. There is no imagery, no elevation
and no other data source in the basemap.
