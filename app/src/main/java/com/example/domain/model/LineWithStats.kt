package com.example.domain.model

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class LineWithStats(
    val line: FiberLine,
    val totalCuts: Int,
    val totalRepairs: Int,
    val openCuts: Int,
    val avgRepairTimeHours: Double?,
    val avgRepairTimeFormatted: String,
    val cutsPerKm: Double,
    val cutsPerKmFormatted: String,
    val lastRepairDate: Long?,
    val lastRepairDateFormatted: String,
    val totalPinsCount: Int,
    val totalSlackCoilLengthM: Double,
    val totalCableLengthM: Double
) {
    companion object {
        fun formatDuration(hours: Double?): String {
            if (hours == null || hours < 0) return "N/A (No closed repairs)"
            return if (hours < 1.0) {
                val mins = (hours * 60.0).toInt().coerceAtLeast(1)
                "$mins min"
            } else if (hours < 48.0) {
                String.format(Locale.US, "%.1f hrs", hours)
            } else {
                val days = hours / 24.0
                String.format(Locale.US, "%.1f days", days)
            }
        }

        fun formatDate(timestamp: Long?): String {
            if (timestamp == null || timestamp <= 0) return "Never"
            val sdf = SimpleDateFormat("MMM d, yyyy HH:mm", Locale.US)
            return sdf.format(Date(timestamp))
        }
    }
}
