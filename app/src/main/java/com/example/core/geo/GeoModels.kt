package com.example.core.geo

data class GeoPoint(
    val lat: Double,
    val lon: Double
) {
    fun toMicroDegrees(): Pair<Int, Int> {
        val latMicro = (lat * 1_000_000.0).toInt()
        val lonMicro = (lon * 1_000_000.0).toInt()
        return Pair(latMicro, lonMicro)
    }

    companion object {
        fun fromMicroDegrees(latMicro: Int, lonMicro: Int): GeoPoint {
            return GeoPoint(latMicro / 1_000_000.0, lonMicro / 1_000_000.0)
        }
    }
}

data class SnapResult(
    val snapPoint: GeoPoint,
    val segmentIndex: Int,
    val projectionRatio: Double,
    val distanceToLineM: Double,
    val chainageM: Double
)

data class ChainagePoint(
    val point: GeoPoint,
    val segmentIndex: Int,
    val bearingDegrees: Double = 0.0
)

data class OtdrMapMatch(
    val targetMapDistanceM: Double,
    val point: GeoPoint,
    val minMapDistanceM: Double,
    val maxMapDistanceM: Double,
    val minPoint: GeoPoint,
    val maxPoint: GeoPoint,
    val coilsPassedM: Double
)

data class GeoBounds(
    val minLat: Double,
    val maxLat: Double,
    val minLon: Double,
    val maxLon: Double
) {
    val centerLat: Double get() = (minLat + maxLat) / 2.0
    val centerLon: Double get() = (minLon + maxLon) / 2.0
}
