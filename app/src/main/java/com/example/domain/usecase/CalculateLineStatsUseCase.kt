package com.example.domain.usecase

import com.example.domain.model.FiberLine
import com.example.domain.model.FiberPin
import com.example.domain.model.LineWithStats
import com.example.domain.model.PinEvent
import com.example.domain.model.PinState
import com.example.domain.model.PinType
import java.util.Locale

class CalculateLineStatsUseCase {

    fun execute(
        line: FiberLine,
        pins: List<FiberPin>,
        events: List<PinEvent>
    ): LineWithStats {
        val linePins = pins.filter { it.lineId == line.id && it.deletedAt == null }
        val eventsByPinId = events.filter { it.deletedAt == null }.groupBy { it.pinId }

        var cutCount = 0
        var repairCount = 0
        var openCount = 0
        val repairDurationsHours = mutableListOf<Double>()
        var latestRepairTimestamp: Long? = null

        for (pin in linePins) {
            val pinEvents = eventsByPinId[pin.id] ?: emptyList()
            val hasCutEvent = pinEvents.any { it.kind == "cut" } || pin.type == PinType.CUT_REPAIR
            val hasRepairEvent = pinEvents.any { it.kind == "repaired" } || pin.state == PinState.REPAIRED

            if (hasCutEvent) {
                cutCount++
            }

            if (pin.state == PinState.OPEN) {
                openCount++
            }

            if (hasRepairEvent) {
                repairCount++
                val repairEvent = pinEvents.filter { it.kind == "repaired" }
                    .maxByOrNull { it.eventDate }
                val repairTime = repairEvent?.eventDate ?: pin.updatedAt

                if (latestRepairTimestamp == null || repairTime > latestRepairTimestamp) {
                    latestRepairTimestamp = repairTime
                }

                // Calculate duration between cut report and repair
                val cutEvent = pinEvents.filter { it.kind == "cut" }
                    .minByOrNull { it.eventDate }
                val cutTime = cutEvent?.eventDate ?: pin.createdAt

                val diffMs = repairTime - cutTime
                if (diffMs > 0) {
                    val hours = diffMs.toDouble() / (1000.0 * 60.0 * 60.0)
                    repairDurationsHours.add(hours)
                }
            }
        }

        val avgHours: Double? = if (repairDurationsHours.isNotEmpty()) {
            repairDurationsHours.average()
        } else {
            null
        }

        val km = line.lengthMapM / 1000.0
        val cutsPerKm = if (km > 0.02) {
            cutCount / km
        } else {
            0.0
        }

        val totalSlackCoilsM = linePins
            .filter { it.type == PinType.SLACK_COIL }
            .sumOf { it.coilLengthM }

        val cableLengthM = line.lengthMapM * (1.0 + (line.slackPercent / 100.0)) + totalSlackCoilsM

        return LineWithStats(
            line = line,
            totalCuts = cutCount,
            totalRepairs = repairCount,
            openCuts = openCount,
            avgRepairTimeHours = avgHours,
            avgRepairTimeFormatted = LineWithStats.formatDuration(avgHours),
            cutsPerKm = cutsPerKm,
            cutsPerKmFormatted = String.format(Locale.US, "%.2f cuts/km", cutsPerKm),
            lastRepairDate = latestRepairTimestamp,
            lastRepairDateFormatted = LineWithStats.formatDate(latestRepairTimestamp),
            totalPinsCount = linePins.size,
            totalSlackCoilLengthM = totalSlackCoilsM,
            totalCableLengthM = cableLengthM
        )
    }
}
