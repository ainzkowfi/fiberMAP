package com.example.domain.model

import com.example.core.geo.GeoPoint

enum class LineStatus(val title: String) {
    ACTIVE("Active"),
    PLANNED("Planned"),
    DAMAGED("Damaged"),
    RETIRED("Retired")
}

enum class PinType(val title: String, val shortCode: String) {
    CUT_REPAIR("Cut / Repair", "CUT"),
    JOINT_CLOSURE("Joint Closure", "FOSC"),
    SPLITTER_NAP("Splitter / NAP", "NAP"),
    POLE_HANDHOLE("Pole / Handhole", "POLE"),
    SLACK_COIL("Slack Coil", "COIL"),
    NOTE("Field Note", "NOTE")
}

enum class PinState(val title: String) {
    OPEN("Open Cut"),
    REPAIRED("Repaired"),
    NONE("Normal")
}

enum class RepairMethod(val title: String) {
    FUSION("Fusion Splice"),
    MECHANICAL("Mechanical Splice"),
    REPLACED_SECTION("Replaced Section / Span")
}

data class FiberLine(
    val id: String,
    val name: String,
    val colorKey: String = "blue",
    val status: LineStatus = LineStatus.ACTIVE,
    val fiberType: String = "G.652D Single Mode",
    val coreCount: Int? = 24,
    val notes: String = "",
    val vertices: List<GeoPoint> = emptyList(),
    val lengthMapM: Double = 0.0,
    val slackPercent: Double = 3.0,
    val measuredLengthM: Double? = null,
    val parentLineId: String? = null,
    val branchChainageM: Double? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null
)

data class FiberPin(
    val id: String,
    val lineId: String? = null,
    val type: PinType = PinType.CUT_REPAIR,
    val lat: Double,
    val lon: Double,
    val snapLat: Double = lat,
    val snapLon: Double = lon,
    val chainageM: Double? = null,
    val gpsAccuracyM: Double? = null,
    val label: String = "",
    val notes: String = "",
    val state: PinState = PinState.NONE,
    val spliceLossDbm: Double? = null,
    val coilLengthM: Double = 0.0,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null
) {
    val spliceLossFormatted: String?
        get() = spliceLossDbm?.let { String.format("%.2f dBm", it) }
}

data class PinEvent(
    val id: String,
    val pinId: String,
    val kind: String, // "cut", "repaired", "inspected", "note"
    val eventDate: Long = System.currentTimeMillis(),
    val repairMethod: RepairMethod? = null,
    val spliceLossDbm: Double? = null,
    val note: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null
) {
    val spliceLossFormatted: String?
        get() = spliceLossDbm?.let { String.format("%.2f dBm", it) }
}
