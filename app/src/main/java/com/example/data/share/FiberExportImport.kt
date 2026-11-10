package com.example.data.share

import com.example.domain.model.FiberLine
import com.example.domain.model.FiberPin
import com.example.domain.model.PinEvent
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object FiberExportImport {

    fun generateFmapBundleJson(
        lines: List<FiberLine>,
        pins: List<FiberPin>,
        events: List<PinEvent>
    ): String {
        val root = JSONObject()
        root.put("format", "fiberMAP-bundle")
        root.put("version", 1)
        root.put("exportedAt", System.currentTimeMillis())

        val linesArray = JSONArray()
        for (line in lines) {
            val lObj = JSONObject()
            lObj.put("id", line.id)
            lObj.put("name", line.name)
            lObj.put("colorKey", line.colorKey)
            lObj.put("status", line.status.name)
            lObj.put("fiberType", line.fiberType)
            lObj.put("coreCount", line.coreCount ?: 24)
            lObj.put("notes", line.notes)
            lObj.put("lengthMapM", line.lengthMapM)
            lObj.put("slackPercent", line.slackPercent)

            val coordsArray = JSONArray()
            for (v in line.vertices) {
                val c = JSONArray()
                c.put(v.lat)
                c.put(v.lon)
                coordsArray.put(c)
            }
            lObj.put("vertices", coordsArray)
            linesArray.put(lObj)
        }
        root.put("lines", linesArray)

        val pinsArray = JSONArray()
        for (pin in pins) {
            val pObj = JSONObject()
            pObj.put("id", pin.id)
            pObj.put("lineId", pin.lineId ?: "")
            pObj.put("type", pin.type.name)
            pObj.put("lat", pin.lat)
            pObj.put("lon", pin.lon)
            pObj.put("chainageM", pin.chainageM ?: -1.0)
            pObj.put("label", pin.label)
            pObj.put("notes", pin.notes)
            pObj.put("state", pin.state.name)
            pObj.put("coilLengthM", pin.coilLengthM)
            pObj.put("createdAt", pin.createdAt)
            pinsArray.put(pObj)
        }
        root.put("pins", pinsArray)

        val eventsArray = JSONArray()
        for (ev in events) {
            val eObj = JSONObject()
            eObj.put("id", ev.id)
            eObj.put("pinId", ev.pinId)
            eObj.put("kind", ev.kind)
            eObj.put("eventDate", ev.eventDate)
            eObj.put("repairMethod", ev.repairMethod?.name ?: "")
            eObj.put("note", ev.note)
            eventsArray.put(eObj)
        }
        root.put("events", eventsArray)

        return root.toString(2)
    }

    fun generateGeoJson(lines: List<FiberLine>, pins: List<FiberPin>): String {
        val root = JSONObject()
        root.put("type", "FeatureCollection")
        val features = JSONArray()

        for (line in lines) {
            val f = JSONObject()
            f.put("type", "Feature")
            val geom = JSONObject()
            geom.put("type", "LineString")
            val coords = JSONArray()
            for (v in line.vertices) {
                val c = JSONArray()
                c.put(v.lon)
                c.put(v.lat)
                coords.put(c)
            }
            geom.put("coordinates", coords)
            f.put("geometry", geom)

            val props = JSONObject()
            props.put("id", line.id)
            props.put("name", line.name)
            props.put("color", line.colorKey)
            props.put("status", line.status.name)
            props.put("length_meters", line.lengthMapM)
            props.put("core_count", line.coreCount ?: 0)
            f.put("properties", props)
            features.put(f)
        }

        for (pin in pins) {
            val f = JSONObject()
            f.put("type", "Feature")
            val geom = JSONObject()
            geom.put("type", "Point")
            val coords = JSONArray()
            coords.put(pin.lon)
            coords.put(pin.lat)
            geom.put("coordinates", coords)
            f.put("geometry", geom)

            val props = JSONObject()
            props.put("id", pin.id)
            props.put("type", pin.type.name)
            props.put("label", pin.label)
            props.put("state", pin.state.name)
            props.put("chainage_m", pin.chainageM ?: 0.0)
            props.put("coil_length_m", pin.coilLengthM)
            f.put("properties", props)
            features.put(f)
        }

        root.put("features", features)
        return root.toString(2)
    }

    fun generateCsv(pins: List<FiberPin>): String {
        val sb = StringBuilder()
        sb.append("ID,Type,State,Chainage_m,Latitude,Longitude,Label,CoilLength_m,Notes,Created_Date\n")
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        for (pin in pins) {
            val dateStr = sdf.format(Date(pin.createdAt))
            val cleanNotes = pin.notes.replace("\"", "\"\"")
            val cleanLabel = pin.label.replace("\"", "\"\"")
            sb.append("\"${pin.id}\",")
            sb.append("\"${pin.type.title}\",")
            sb.append("\"${pin.state.title}\",")
            sb.append("${pin.chainageM?.toInt() ?: 0},")
            sb.append("${pin.lat},")
            sb.append("${pin.lon},")
            sb.append("\"$cleanLabel\",")
            sb.append("${pin.coilLengthM},")
            sb.append("\"$cleanNotes\",")
            sb.append("\"$dateStr\"\n")
        }
        return sb.toString()
    }

    fun generateKml(lines: List<FiberLine>, pins: List<FiberPin>): String {
        val sb = StringBuilder()
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
        sb.append("<kml xmlns=\"http://www.opengis.net/kml/2.2\">\n")
        sb.append("<Document>\n")
        sb.append("<name>fiberMAP Agusan del Sur Export</name>\n")

        for (line in lines) {
            sb.append("  <Placemark>\n")
            sb.append("    <name>${escapeXml(line.name)}</name>\n")
            sb.append("    <description>Status: ${line.status.name}, Length: ${line.lengthMapM.toInt()}m</description>\n")
            sb.append("    <LineString>\n")
            sb.append("      <coordinates>\n")
            val coordsStr = line.vertices.joinToString(" ") { "${it.lon},${it.lat},0" }
            sb.append("        $coordsStr\n")
            sb.append("      </coordinates>\n")
            sb.append("    </LineString>\n")
            sb.append("  </Placemark>\n")
        }

        for (pin in pins) {
            sb.append("  <Placemark>\n")
            sb.append("    <name>${escapeXml(pin.label)}</name>\n")
            sb.append("    <description>Type: ${pin.type.title}, State: ${pin.state.title}</description>\n")
            sb.append("    <Point>\n")
            sb.append("      <coordinates>${pin.lon},${pin.lat},0</coordinates>\n")
            sb.append("    </Point>\n")
            sb.append("  </Placemark>\n")
        }

        sb.append("</Document>\n")
        sb.append("</kml>\n")
        return sb.toString()
    }

    private fun escapeXml(str: String): String {
        return str.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
    }
}
