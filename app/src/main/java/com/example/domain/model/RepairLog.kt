package com.example.domain.model

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class RepairLog(
    val id: String,
    val lineId: String?,
    val pinId: String?,
    val spliceLossDbm: Double, // e.g. 0.01 dBm
    val fiberCutLocation: String, // readable cut location e.g. "Km 2+450 (Purok 4) [8.52310, 125.96120]"
    val cutLat: Double,
    val cutLon: Double,
    val chainageM: Double?,
    val repairTimestamp: Long,
    val technicianName: String = "",
    val repairMethod: RepairMethod = RepairMethod.FUSION,
    val closureTag: String = "",
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null
) {
    val spliceLossFormatted: String
        get() = "%.2f dBm".format(spliceLossDbm)

    val formattedRepairDate: String
        get() {
            val sdf = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.US)
            return sdf.format(Date(repairTimestamp))
        }

    val chainageFormatted: String
        get() = chainageM?.let { m ->
            val km = (m / 1000.0).toInt()
            val remM = (m % 1000.0).toInt()
            "Km %d+%03d".format(km, remM)
        } ?: "Off-Road Point"
}
