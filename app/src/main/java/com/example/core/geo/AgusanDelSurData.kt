package com.example.core.geo

object AgusanDelSurData {
    // Agusan del Sur Region Bounding Box
    val BOUNDS = GeoBounds(
        minLat = 7.5000,
        maxLat = 9.2000,
        minLon = 125.0000,
        maxLon = 126.8000
    )

    val DEFAULT_CENTER = GeoPoint(8.5085, 125.9772) // San Francisco / Patin-ay junction
    const val DEFAULT_ZOOM = 13.0f

    data class Municipality(
        val name: String,
        val point: GeoPoint,
        val isCapitalOrHub: Boolean = false
    )

    val MUNICIPALITIES = listOf(
        Municipality("San Francisco", GeoPoint(8.5085, 125.9772), true),
        Municipality("Prosperidad (Patin-ay)", GeoPoint(8.5830, 125.9180), true),
        Municipality("Bayugan City", GeoPoint(8.7120, 125.7480), true),
        Municipality("Rosario", GeoPoint(8.3510, 126.0020)),
        Municipality("Bunawan", GeoPoint(8.1750, 125.9980)),
        Municipality("Trento", GeoPoint(8.0480, 126.0620)),
        Municipality("Talacogon", GeoPoint(8.4520, 125.7890)),
        Municipality("Esperanza", GeoPoint(8.6750, 125.6520)),
        Municipality("La Paz", GeoPoint(8.2780, 125.8110))
    )

    // Highway AH26 (Maharlika Highway) corridor vertices in Agusan del Sur
    val HIGHWAY_AH26_ROAD = listOf(
        GeoPoint(8.7120, 125.7480), // Bayugan City
        GeoPoint(8.6500, 125.8200),
        GeoPoint(8.5830, 125.9180), // Prosperidad
        GeoPoint(8.5400, 125.9550),
        GeoPoint(8.5085, 125.9772), // San Francisco Junction
        GeoPoint(8.4350, 125.9900),
        GeoPoint(8.3510, 126.0020), // Rosario
        GeoPoint(8.2600, 126.0010),
        GeoPoint(8.1750, 125.9980), // Bunawan
        GeoPoint(8.0480, 126.0620)  // Trento
    )

    // Agusan River drainage corridor
    val AGUSAN_RIVER = listOf(
        GeoPoint(8.0200, 125.9500),
        GeoPoint(8.1600, 125.9200),
        GeoPoint(8.2900, 125.8600),
        GeoPoint(8.4500, 125.8100),
        GeoPoint(8.5800, 125.7700),
        GeoPoint(8.7400, 125.7100)
    )

    // Initial realistic Fiber Line vertices:
    // 1. Sulop - Prosperidad Trunk (24F along AH26 from San Francisco north to Prosperidad Capitol)
    val SULOP_TRUNK_VERTICES = listOf(
        GeoPoint(8.5085, 125.9772), // San Francisco Hub OLT
        GeoPoint(8.5150, 125.9720),
        GeoPoint(8.5220, 125.9670),
        GeoPoint(8.5310, 125.9610),
        GeoPoint(8.5400, 125.9550), // Pole 42
        GeoPoint(8.5520, 125.9450),
        GeoPoint(8.5630, 125.9350),
        GeoPoint(8.5740, 125.9250),
        GeoPoint(8.5830, 125.9180)  // Prosperidad Government Center
    )

    // 2. San Francisco Poblacion Ring (48F Metro Distribution Ring)
    val SAN_FRANCISCO_RING_VERTICES = listOf(
        GeoPoint(8.5085, 125.9772),
        GeoPoint(8.5080, 125.9850),
        GeoPoint(8.5020, 125.9910),
        GeoPoint(8.4950, 125.9880),
        GeoPoint(8.4920, 125.9810),
        GeoPoint(8.4960, 125.9730),
        GeoPoint(8.5030, 125.9710),
        GeoPoint(8.5085, 125.9772)
    )

    // 3. Bayugan - Rosario Feeder (12F Highway Line)
    val BAYUGAN_FEEDER_VERTICES = listOf(
        GeoPoint(8.5085, 125.9772),
        GeoPoint(8.4800, 125.9810),
        GeoPoint(8.4500, 125.9860),
        GeoPoint(8.4100, 125.9920),
        GeoPoint(8.3750, 125.9980),
        GeoPoint(8.3510, 126.0020)  // Rosario Substation
    )
}
