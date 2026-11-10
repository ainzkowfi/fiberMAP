package com.example

import com.example.core.geo.GeoPoint
import com.example.core.geo.GeometryEngine
import com.example.domain.model.*
import com.example.domain.usecase.CalculateLineStatsUseCase
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class ExampleUnitTest {

    @Test
    fun testLineStatsCalculation() {
        val line = FiberLine(
            id = "test-line-1",
            name = "Test Feeder",
            lengthMapM = 5000.0, // 5.0 km
            slackPercent = 3.0
        )

        val pin1Id = UUID.randomUUID().toString()
        val pin1 = FiberPin(
            id = pin1Id,
            lineId = line.id,
            type = PinType.CUT_REPAIR,
            lat = 8.50,
            lon = 125.90,
            state = PinState.REPAIRED,
            createdAt = 1000000L
        )

        val pin2Id = UUID.randomUUID().toString()
        val pin2 = FiberPin(
            id = pin2Id,
            lineId = line.id,
            type = PinType.CUT_REPAIR,
            lat = 8.52,
            lon = 125.92,
            state = PinState.REPAIRED,
            createdAt = 2000000L
        )

        val pin3Id = UUID.randomUUID().toString()
        val pin3 = FiberPin(
            id = pin3Id,
            lineId = line.id,
            type = PinType.CUT_REPAIR,
            lat = 8.53,
            lon = 125.93,
            state = PinState.OPEN,
            createdAt = 3000000L
        )

        // Events: Pin 1 repaired after 2 hours (7,200,000 ms)
        val event1Cut = PinEvent(
            id = UUID.randomUUID().toString(),
            pinId = pin1Id,
            kind = "cut",
            eventDate = 1000000L
        )
        val event1Repaired = PinEvent(
            id = UUID.randomUUID().toString(),
            pinId = pin1Id,
            kind = "repaired",
            eventDate = 1000000L + 7200000L, // 2.0 hours
            repairMethod = RepairMethod.FUSION
        )

        // Pin 2 repaired after 4 hours (14,400,000 ms)
        val event2Cut = PinEvent(
            id = UUID.randomUUID().toString(),
            pinId = pin2Id,
            kind = "cut",
            eventDate = 2000000L
        )
        val event2Repaired = PinEvent(
            id = UUID.randomUUID().toString(),
            pinId = pin2Id,
            kind = "repaired",
            eventDate = 2000000L + 14400000L, // 4.0 hours
            repairMethod = RepairMethod.FUSION
        )

        val useCase = CalculateLineStatsUseCase()
        val stats = useCase.execute(
            line = line,
            pins = listOf(pin1, pin2, pin3),
            events = listOf(event1Cut, event1Repaired, event2Cut, event2Repaired)
        )

        // Total Cuts: 3 cuts
        assertEquals(3, stats.totalCuts)
        // Total Repairs: 2 repairs
        assertEquals(2, stats.totalRepairs)
        // Open cuts: 1 open
        assertEquals(1, stats.openCuts)
        // Average repair duration: (2.0 + 4.0) / 2 = 3.0 hours
        assertNotNull(stats.avgRepairTimeHours)
        assertEquals(3.0, stats.avgRepairTimeHours!!, 0.01)
        // Cuts per kilometer: 3 cuts / 5 km = 0.60 cuts/km
        assertEquals(0.60, stats.cutsPerKm, 0.01)
    }

    @Test
    fun testGeometryEngineDeltaBlobRoundTrip() {
        val originalPoints = listOf(
            GeoPoint(8.5085, 125.9772),
            GeoPoint(8.5150, 125.9720),
            GeoPoint(8.5220, 125.9670)
        )

        val blob = GeometryEngine.encodeGeometryToBlob(originalPoints)
        assertTrue(blob.isNotEmpty())

        val decoded = GeometryEngine.decodeGeometryFromBlob(blob)
        assertEquals(originalPoints.size, decoded.size)
        for (i in originalPoints.indices) {
            assertEquals(originalPoints[i].lat, decoded[i].lat, 1e-5)
            assertEquals(originalPoints[i].lon, decoded[i].lon, 1e-5)
        }
    }

    @Test
    fun testHaversineAndSnapping() {
        val p1 = GeoPoint(8.5085, 125.9772)
        val p2 = GeoPoint(8.5150, 125.9720)
        val dist = GeometryEngine.haversineDistance(p1, p2)
        assertTrue(dist > 500.0 && dist < 1500.0)

        val midQuery = GeoPoint(8.5117, 125.9746)
        val snap = GeometryEngine.snapPointToPolyline(midQuery, listOf(p1, p2))
        assertNotNull(snap)
        assertTrue(snap!!.distanceToLineM < 50.0)
    }

    @Test
    fun testSpliceLossFormatting() {
        val pin = FiberPin(
            id = "pin-repair-1",
            type = PinType.CUT_REPAIR,
            lat = 8.5085,
            lon = 125.9772,
            state = PinState.REPAIRED,
            spliceLossDbm = 0.01
        )
        assertEquals("0.01 dBm", pin.spliceLossFormatted)
    }

    @Test
    fun testScreenToGeoProjectionRoundTrip() {
        val center = GeoPoint(8.5085, 125.9772)
        val target = GeoPoint(8.5140, 125.9810)
        val zoom = 14.0f
        val width = 1080f
        val height = 2400f

        val screenPt = com.example.ui.map.geoToScreen(target, center, zoom, width, height)
        val invertedGeo = com.example.ui.map.screenToGeo(screenPt, center, zoom, width, height)

        assertEquals(target.lat, invertedGeo.lat, 1e-4)
        assertEquals(target.lon, invertedGeo.lon, 1e-4)
    }

    @Test
    fun testMeasureModeCumulativeDistances() {
        val corners = listOf(
            GeoPoint(8.5085, 125.9772),
            GeoPoint(8.5150, 125.9720),
            GeoPoint(8.5220, 125.9670)
        )
        val cum = GeometryEngine.computeCumulativeDistances(corners)
        assertEquals(3, cum.size)
        assertEquals(0.0, cum[0], 0.001)
        assertTrue(cum[1] > 500.0)
        assertTrue(cum[2] > cum[1])
    }
}
