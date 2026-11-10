package com.example.core.geo

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import kotlin.math.*

object GeometryEngine {
    const val EARTH_RADIUS_M = 6_371_008.8

    fun haversineDistance(p1: GeoPoint, p2: GeoPoint): Double {
        val lat1Rad = Math.toRadians(p1.lat)
        val lat2Rad = Math.toRadians(p2.lat)
        val dLat = Math.toRadians(p2.lat - p1.lat)
        val dLon = Math.toRadians(p2.lon - p1.lon)

        val a = sin(dLat / 2.0).pow(2.0) +
                cos(lat1Rad) * cos(lat2Rad) * sin(dLon / 2.0).pow(2.0)
        val c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a))
        return EARTH_RADIUS_M * c
    }

    fun computeCumulativeDistances(points: List<GeoPoint>): DoubleArray {
        if (points.isEmpty()) return DoubleArray(0)
        val cum = DoubleArray(points.size)
        cum[0] = 0.0
        for (i in 0 until points.size - 1) {
            val dist = haversineDistance(points[i], points[i + 1])
            cum[i + 1] = cum[i] + dist
        }
        return cum
    }

    fun snapPointToPolyline(
        point: GeoPoint,
        polyline: List<GeoPoint>,
        cumulative: DoubleArray = computeCumulativeDistances(polyline)
    ): SnapResult? {
        if (polyline.size < 2) return null

        var bestDist = Double.MAX_VALUE
        var bestSnap = polyline.first()
        var bestSegIndex = 0
        var bestRatio = 0.0
        var bestChainage = 0.0

        val latRad = Math.toRadians(point.lat)
        val cosLat = cos(latRad)

        for (i in 0 until polyline.size - 1) {
            val a = polyline[i]
            val b = polyline[i + 1]

            // Flat local projection around the segment
            val ax = Math.toRadians(a.lon - point.lon) * cosLat * EARTH_RADIUS_M
            val ay = Math.toRadians(a.lat - point.lat) * EARTH_RADIUS_M

            val bx = Math.toRadians(b.lon - point.lon) * cosLat * EARTH_RADIUS_M
            val by = Math.toRadians(b.lat - point.lat) * EARTH_RADIUS_M

            val segDx = bx - ax
            val segDy = by - ay
            val segLenSq = segDx * segDx + segDy * segDy

            val t = if (segLenSq > 1e-6) {
                ((-ax * segDx) + (-ay * segDy)) / segLenSq
            } else {
                0.0
            }.coerceIn(0.0, 1.0)

            val projLat = a.lat + t * (b.lat - a.lat)
            val projLon = a.lon + t * (b.lon - a.lon)
            val snapP = GeoPoint(projLat, projLon)

            val dist = haversineDistance(point, snapP)
            if (dist < bestDist) {
                bestDist = dist
                bestSnap = snapP
                bestSegIndex = i
                bestRatio = t
                val segLength = if (i + 1 < cumulative.size) {
                    cumulative[i + 1] - cumulative[i]
                } else {
                    haversineDistance(a, b)
                }
                bestChainage = cumulative[i] + t * segLength
            }
        }

        return SnapResult(
            snapPoint = bestSnap,
            segmentIndex = bestSegIndex,
            projectionRatio = bestRatio,
            distanceToLineM = bestDist,
            chainageM = bestChainage
        )
    }

    fun getPointAtChainage(
        chainageM: Double,
        polyline: List<GeoPoint>,
        cumulative: DoubleArray = computeCumulativeDistances(polyline)
    ): GeoPoint? {
        if (polyline.isEmpty()) return null
        if (polyline.size == 1) return polyline.first()
        val totalLength = cumulative.lastOrNull() ?: 0.0
        if (chainageM <= 0.0) return polyline.first()
        if (chainageM >= totalLength) return polyline.last()

        var low = 0
        var high = cumulative.size - 1
        var segIndex = 0

        while (low <= high) {
            val mid = (low + high) ushr 1
            if (cumulative[mid] <= chainageM) {
                segIndex = mid
                low = mid + 1
            } else {
                high = mid - 1
            }
        }

        if (segIndex >= polyline.size - 1) {
            return polyline.last()
        }

        val segStart = cumulative[segIndex]
        val segEnd = cumulative[segIndex + 1]
        val segLen = segEnd - segStart
        val t = if (segLen > 1e-4) (chainageM - segStart) / segLen else 0.0

        val a = polyline[segIndex]
        val b = polyline[segIndex + 1]
        val lat = a.lat + t * (b.lat - a.lat)
        val lon = a.lon + t * (b.lon - a.lon)
        return GeoPoint(lat, lon)
    }

    fun otdrToMapLocation(
        otdrDistanceM: Double,
        fromEnd: Boolean,
        slackPercent: Double,
        coils: List<Pair<Double, Double>>, // List of (chainageM, coilLengthM)
        polyline: List<GeoPoint>,
        cumulative: DoubleArray = computeCumulativeDistances(polyline),
        uncertaintyRatio: Double = 0.03
    ): OtdrMapMatch? {
        if (polyline.size < 2) return null
        val totalMapLength = cumulative.lastOrNull() ?: return null

        val effectiveCableDist = if (fromEnd) {
            val totalSlackFactor = 1.0 + (slackPercent / 100.0)
            val totalCoils = coils.sumOf { it.second }
            val totalCableLength = totalMapLength * totalSlackFactor + totalCoils
            (totalCableLength - otdrDistanceM).coerceAtLeast(0.0)
        } else {
            otdrDistanceM
        }

        // Iterative solve since coils subtract based on map chainage
        var estimatedMapDist = effectiveCableDist / (1.0 + (slackPercent / 100.0))
        var prevEst = -1.0
        var iterations = 0
        var coilsPassed = 0.0

        while (abs(estimatedMapDist - prevEst) > 0.5 && iterations < 10) {
            prevEst = estimatedMapDist
            coilsPassed = coils.filter { it.first <= estimatedMapDist }.sumOf { it.second }
            val netCable = (effectiveCableDist - coilsPassed).coerceAtLeast(0.0)
            estimatedMapDist = netCable / (1.0 + (slackPercent / 100.0))
            iterations++
        }

        val clampedTarget = estimatedMapDist.coerceIn(0.0, totalMapLength)
        val targetPoint = getPointAtChainage(clampedTarget, polyline, cumulative) ?: return null

        val uncertaintyM = (clampedTarget * uncertaintyRatio).coerceAtLeast(5.0)
        val minMapDist = (clampedTarget - uncertaintyM).coerceAtLeast(0.0)
        val maxMapDist = (clampedTarget + uncertaintyM).coerceAtMost(totalMapLength)

        val minPoint = getPointAtChainage(minMapDist, polyline, cumulative) ?: targetPoint
        val maxPoint = getPointAtChainage(maxMapDist, polyline, cumulative) ?: targetPoint

        return OtdrMapMatch(
            targetMapDistanceM = clampedTarget,
            point = targetPoint,
            minMapDistanceM = minMapDist,
            maxMapDistanceM = maxMapDist,
            minPoint = minPoint,
            maxPoint = maxPoint,
            coilsPassedM = coilsPassed
        )
    }

    fun simplifyDouglasPeucker(points: List<GeoPoint>, toleranceM: Double): List<GeoPoint> {
        if (points.size <= 2) return points

        var maxDist = 0.0
        var maxIndex = 0
        val first = points.first()
        val last = points.last()

        val latRad = Math.toRadians((first.lat + last.lat) / 2.0)
        val cosLat = cos(latRad)

        val ax = Math.toRadians(first.lon) * cosLat * EARTH_RADIUS_M
        val ay = Math.toRadians(first.lat) * EARTH_RADIUS_M
        val bx = Math.toRadians(last.lon) * cosLat * EARTH_RADIUS_M
        val by = Math.toRadians(last.lat) * EARTH_RADIUS_M
        val dx = bx - ax
        val dy = by - ay
        val lenSq = dx * dx + dy * dy

        for (i in 1 until points.size - 1) {
            val p = points[i]
            val px = Math.toRadians(p.lon) * cosLat * EARTH_RADIUS_M
            val py = Math.toRadians(p.lat) * EARTH_RADIUS_M

            val dist = if (lenSq > 1e-4) {
                val t = (((px - ax) * dx) + ((py - ay) * dy)) / lenSq
                val clampedT = t.coerceIn(0.0, 1.0)
                val projX = ax + clampedT * dx
                val projY = ay + clampedT * dy
                hypot(px - projX, py - projY)
            } else {
                hypot(px - ax, py - ay)
            }

            if (dist > maxDist) {
                maxDist = dist
                maxIndex = i
            }
        }

        return if (maxDist > toleranceM) {
            val left = simplifyDouglasPeucker(points.subList(0, maxIndex + 1), toleranceM)
            val right = simplifyDouglasPeucker(points.subList(maxIndex, points.size), toleranceM)
            left.dropLast(1) + right
        } else {
            listOf(first, last)
        }
    }

    // Delta-encoded zigzag varints serialization
    fun encodeGeometryToBlob(points: List<GeoPoint>): ByteArray {
        val out = ByteArrayOutputStream()
        writeVarInt(out, points.size)
        var lastLat = 0
        var lastLon = 0

        for (pt in points) {
            val (latMicro, lonMicro) = pt.toMicroDegrees()
            val dLat = latMicro - lastLat
            val dLon = lonMicro - lastLon
            writeSignedVarInt(out, dLat)
            writeSignedVarInt(out, dLon)
            lastLat = latMicro
            lastLon = lonMicro
        }
        return out.toByteArray()
    }

    fun decodeGeometryFromBlob(blob: ByteArray): List<GeoPoint> {
        if (blob.isEmpty()) return emptyList()
        val inp = ByteArrayInputStream(blob)
        val size = readVarInt(inp)
        val result = ArrayList<GeoPoint>(size.coerceAtLeast(0))
        var currentLat = 0
        var currentLon = 0

        for (i in 0 until size) {
            val dLat = readSignedVarInt(inp)
            val dLon = readSignedVarInt(inp)
            currentLat += dLat
            currentLon += dLon
            result.add(GeoPoint.fromMicroDegrees(currentLat, currentLon))
        }
        return result
    }

    private fun writeVarInt(out: ByteArrayOutputStream, value: Int) {
        var v = value
        while ((v and 0x7F.inv()) != 0) {
            out.write((v and 0x7F) or 0x80)
            v = v ushr 7
        }
        out.write(v and 0x7F)
    }

    private fun readVarInt(inp: ByteArrayInputStream): Int {
        var result = 0
        var shift = 0
        while (true) {
            val b = inp.read()
            if (b == -1) break
            result = result or ((b and 0x7F) shl shift)
            if ((b and 0x80) == 0) break
            shift += 7
        }
        return result
    }

    private fun writeSignedVarInt(out: ByteArrayOutputStream, value: Int) {
        val zigzag = (value shl 1) xor (value shr 31)
        writeVarInt(out, zigzag)
    }

    private fun readSignedVarInt(inp: ByteArrayInputStream): Int {
        val raw = readVarInt(inp)
        return (raw ushr 1) xor (-(raw and 1))
    }

    fun formatChainage(distanceM: Double, useChainageStyle: Boolean = true): String {
        if (!useChainageStyle) {
            return if (distanceM >= 1000.0) {
                String.format("%.2f km", distanceM / 1000.0)
            } else {
                String.format("%.0f m", distanceM)
            }
        }
        val km = (distanceM / 1000.0).toInt()
        val meters = (distanceM % 1000.0).roundToInt()
        return "%d+%03d m".format(km, meters)
    }
}
