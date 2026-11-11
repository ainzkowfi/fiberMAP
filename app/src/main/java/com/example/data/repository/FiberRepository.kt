package com.example.data.repository

import com.example.core.geo.GeometryEngine
import com.example.data.db.*
import com.example.domain.model.*
import com.example.domain.usecase.CalculateLineStatsUseCase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import java.util.UUID

class FiberRepository(private val db: FiberDatabase) {

    private val lineDao = db.lineDao()
    private val pinDao = db.pinDao()
    private val pinEventDao = db.pinEventDao()
    private val repairLogDao = db.repairLogDao()
    private val statsUseCase = CalculateLineStatsUseCase()

    val allRepairLogsFlow: Flow<List<RepairLog>> = repairLogDao.getAllRepairLogsFlow().map { entities ->
        entities.map { it.toDomain() }
    }

    val allLinesFlow: Flow<List<FiberLine>> = lineDao.getAllLinesFlow().map { entities ->
        entities.map { it.toDomain() }
    }

    val allPinsFlow: Flow<List<FiberPin>> = pinDao.getAllPinsFlow().map { entities ->
        entities.map { it.toDomain() }
    }

    val allEventsFlow: Flow<List<PinEvent>> = pinEventDao.getAllEventsFlow().map { entities ->
        entities.map { it.toDomain() }
    }

    // Combines Lines, Pins, and Events to emit real-time Line Stats for all lines
    val linesWithStatsFlow: Flow<List<LineWithStats>> = combine(
        allLinesFlow,
        allPinsFlow,
        allEventsFlow
    ) { lines, pins, events ->
        lines.map { line ->
            statsUseCase.execute(line, pins, events)
        }
    }

    fun getLineByIdFlow(id: String): Flow<FiberLine?> = lineDao.getLineByIdFlow(id).map { it?.toDomain() }

    fun getPinsForLineFlow(lineId: String): Flow<List<FiberPin>> = pinDao.getPinsForLineFlow(lineId).map { entities ->
        entities.map { it.toDomain() }
    }

    fun getLineWithStatsFlow(lineId: String): Flow<LineWithStats?> = combine(
        getLineByIdFlow(lineId),
        allPinsFlow,
        allEventsFlow
    ) { line, pins, events ->
        line?.let { statsUseCase.execute(it, pins, events) }
    }

    fun getRepairLogsForLineFlow(lineId: String): Flow<List<RepairLog>> =
        repairLogDao.getRepairLogsForLineFlow(lineId).map { list -> list.map { it.toDomain() } }

    fun getRepairLogsForPinFlow(pinId: String): Flow<List<RepairLog>> =
        repairLogDao.getRepairLogsForPinFlow(pinId).map { list -> list.map { it.toDomain() } }

    suspend fun logRepair(
        lineId: String?,
        pinId: String?,
        spliceLossDbm: Double,
        fiberCutLocation: String,
        cutLat: Double,
        cutLon: Double,
        chainageM: Double?,
        technicianName: String = "",
        repairMethod: RepairMethod = RepairMethod.FUSION,
        closureTag: String = "",
        notes: String = ""
    ): RepairLog {
        val now = System.currentTimeMillis()
        val entity = RepairLogEntity(
            id = UUID.randomUUID().toString(),
            lineId = lineId,
            pinId = pinId,
            spliceLossDbm = spliceLossDbm,
            fiberCutLocation = fiberCutLocation,
            cutLat = cutLat,
            cutLon = cutLon,
            chainageM = chainageM,
            repairTimestamp = now,
            technicianName = technicianName,
            repairMethod = repairMethod.name.lowercase(),
            closureTag = closureTag,
            notes = notes,
            createdAt = now,
            updatedAt = now
        )
        repairLogDao.insertRepairLog(entity)
        return entity.toDomain()
    }

    suspend fun saveLine(line: FiberLine) {
        val cum = GeometryEngine.computeCumulativeDistances(line.vertices)
        val length = cum.lastOrNull() ?: 0.0
        val blob = GeometryEngine.encodeGeometryToBlob(line.vertices)

        val entity = LineEntity(
            id = line.id.ifEmpty { UUID.randomUUID().toString() },
            name = line.name,
            colorKey = line.colorKey,
            status = line.status.name.lowercase(),
            fiberType = line.fiberType,
            coreCount = line.coreCount,
            notes = line.notes,
            geometry = blob,
            lengthMapM = length,
            slackPercent = line.slackPercent,
            measuredLengthM = line.measuredLengthM,
            parentLineId = line.parentLineId,
            branchChainageM = line.branchChainageM,
            createdAt = line.createdAt,
            updatedAt = System.currentTimeMillis()
        )
        lineDao.insertLine(entity)
    }

    suspend fun deleteLine(lineId: String) {
        val now = System.currentTimeMillis()
        try {
            lineDao.softDeleteLine(lineId, now)
            pinDao.softDeletePinsForLine(lineId, now)
            pinEventDao.softDeleteEventsForLine(lineId, now)
            repairLogDao.softDeleteRepairLogsForLine(lineId, now)
        } catch (_: Exception) {
            lineDao.hardDeleteLine(lineId)
            pinDao.hardDeletePinsForLine(lineId)
            repairLogDao.hardDeleteRepairLogsForLine(lineId)
        }
    }

    suspend fun dropPin(
        lineId: String?,
        type: PinType,
        lat: Double,
        lon: Double,
        label: String,
        notes: String,
        state: PinState = if (type == PinType.CUT_REPAIR) PinState.OPEN else PinState.NONE,
        spliceLossDbm: Double? = null,
        coilLengthM: Double = 0.0,
        gpsAccuracyM: Double? = null
    ): FiberPin {
        val pinId = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()

        var snapLat = lat
        var snapLon = lon
        var chainage: Double? = null

        if (lineId != null) {
            val lineEntity = lineDao.getLineById(lineId)
            if (lineEntity != null) {
                val vertices = GeometryEngine.decodeGeometryFromBlob(lineEntity.geometry)
                val snap = GeometryEngine.snapPointToPolyline(com.example.core.geo.GeoPoint(lat, lon), vertices)
                if (snap != null && snap.distanceToLineM <= 50.0) {
                    snapLat = snap.snapPoint.lat
                    snapLon = snap.snapPoint.lon
                    chainage = snap.chainageM
                }
            }
        }

        val resolvedLabel = label.ifEmpty {
            if (chainage != null) {
                "${type.title} at ${GeometryEngine.formatChainage(chainage)}"
            } else {
                "${type.title} at %.5f, %.5f".format(lat, lon)
            }
        }

        val pinEntity = PinEntity(
            id = pinId,
            lineId = lineId,
            type = type.name.lowercase(),
            lat = lat,
            lon = lon,
            snapLat = snapLat,
            snapLon = snapLon,
            chainageM = chainage,
            gpsAccuracyM = gpsAccuracyM,
            label = resolvedLabel,
            notes = notes,
            state = state.name.lowercase(),
            spliceLossDbm = spliceLossDbm,
            coilLengthM = coilLengthM,
            createdAt = now,
            updatedAt = now
        )

        pinDao.insertPin(pinEntity)

        // If logged directly as repaired, create repair event and RepairLog
        if (state == PinState.REPAIRED) {
            val loss = spliceLossDbm ?: 0.02
            val repairEvent = PinEventEntity(
                id = UUID.randomUUID().toString(),
                pinId = pinId,
                kind = "repaired",
                eventDate = now,
                repairMethod = RepairMethod.FUSION.name.lowercase(),
                spliceLossDbm = loss,
                note = notes.ifEmpty { "Field splice repair completed." },
                createdAt = now
            )
            pinEventDao.insertEvent(repairEvent)

            val repairLog = RepairLogEntity(
                id = UUID.randomUUID().toString(),
                lineId = lineId,
                pinId = pinId,
                spliceLossDbm = loss,
                fiberCutLocation = resolvedLabel,
                cutLat = snapLat,
                cutLon = snapLon,
                chainageM = chainage,
                repairTimestamp = now,
                technicianName = "Field Tech",
                repairMethod = RepairMethod.FUSION.name.lowercase(),
                closureTag = "",
                notes = notes.ifEmpty { "Initial repair entry" },
                createdAt = now,
                updatedAt = now
            )
            repairLogDao.insertRepairLog(repairLog)
        } else if (type == PinType.CUT_REPAIR || state == PinState.OPEN) {
            val cutEvent = PinEventEntity(
                id = UUID.randomUUID().toString(),
                pinId = pinId,
                kind = "cut",
                eventDate = now,
                repairMethod = null,
                spliceLossDbm = null,
                note = notes.ifEmpty { "Cut reported in field." },
                createdAt = now
            )
            pinEventDao.insertEvent(cutEvent)
        }

        return pinEntity.toDomain()
    }

    suspend fun markPinRepaired(
        pinId: String,
        method: RepairMethod,
        spliceLossDbm: Double? = 0.01,
        note: String
    ) {
        val pin = pinDao.getPinById(pinId) ?: return
        val now = System.currentTimeMillis()
        val loss = spliceLossDbm ?: pin.spliceLossDbm ?: 0.01

        val updatedPin = pin.copy(
            state = "repaired",
            spliceLossDbm = loss,
            updatedAt = now
        )
        pinDao.updatePin(updatedPin)

        val repairEvent = PinEventEntity(
            id = UUID.randomUUID().toString(),
            pinId = pinId,
            kind = "repaired",
            eventDate = now,
            repairMethod = method.name.lowercase(),
            spliceLossDbm = loss,
            note = note,
            createdAt = now
        )
        pinEventDao.insertEvent(repairEvent)

        val repairLog = RepairLogEntity(
            id = UUID.randomUUID().toString(),
            lineId = pin.lineId,
            pinId = pinId,
            spliceLossDbm = loss,
            fiberCutLocation = pin.label,
            cutLat = pin.snapLat,
            cutLon = pin.snapLon,
            chainageM = pin.chainageM,
            repairTimestamp = now,
            technicianName = "Field Tech",
            repairMethod = method.name.lowercase(),
            closureTag = "",
            notes = note,
            createdAt = now,
            updatedAt = now
        )
        repairLogDao.insertRepairLog(repairLog)
    }

    suspend fun updatePin(pin: FiberPin) {
        val entity = PinEntity(
            id = pin.id,
            lineId = pin.lineId,
            type = pin.type.name.lowercase(),
            lat = pin.lat,
            lon = pin.lon,
            snapLat = pin.snapLat,
            snapLon = pin.snapLon,
            chainageM = pin.chainageM,
            gpsAccuracyM = pin.gpsAccuracyM,
            label = pin.label,
            notes = pin.notes,
            state = pin.state.name.lowercase(),
            spliceLossDbm = pin.spliceLossDbm,
            coilLengthM = pin.coilLengthM,
            createdAt = pin.createdAt,
            updatedAt = System.currentTimeMillis(),
            deletedAt = pin.deletedAt
        )
        pinDao.updatePin(entity)
    }

    suspend fun deletePin(pinId: String) {
        val now = System.currentTimeMillis()
        try {
            pinDao.softDeletePin(pinId, now)
            pinEventDao.softDeleteEventsForPin(pinId, now)
            repairLogDao.hardDeleteRepairLogsForPin(pinId)
        } catch (_: Exception) {
            pinDao.hardDeletePin(pinId)
            pinEventDao.hardDeleteEventsForPin(pinId)
            repairLogDao.hardDeleteRepairLogsForPin(pinId)
        }
    }

    // Converters
    private fun LineEntity.toDomain(): FiberLine {
        val points = GeometryEngine.decodeGeometryFromBlob(geometry)
        val statusEnum = runCatching { LineStatus.valueOf(status.uppercase()) }.getOrDefault(LineStatus.ACTIVE)
        return FiberLine(
            id = id,
            name = name,
            colorKey = colorKey,
            status = statusEnum,
            fiberType = fiberType,
            coreCount = coreCount,
            notes = notes,
            vertices = points,
            lengthMapM = lengthMapM,
            slackPercent = slackPercent,
            measuredLengthM = measuredLengthM,
            parentLineId = parentLineId,
            branchChainageM = branchChainageM,
            createdAt = createdAt,
            updatedAt = updatedAt,
            deletedAt = deletedAt
        )
    }

    private fun PinEntity.toDomain(): FiberPin {
        val typeEnum = runCatching { PinType.valueOf(type.uppercase()) }.getOrDefault(PinType.CUT_REPAIR)
        val stateEnum = runCatching { PinState.valueOf(state.uppercase()) }.getOrDefault(PinState.NONE)
        return FiberPin(
            id = id,
            lineId = lineId,
            type = typeEnum,
            lat = lat,
            lon = lon,
            snapLat = snapLat,
            snapLon = snapLon,
            chainageM = chainageM,
            gpsAccuracyM = gpsAccuracyM,
            label = label,
            notes = notes,
            state = stateEnum,
            spliceLossDbm = spliceLossDbm,
            coilLengthM = coilLengthM,
            createdAt = createdAt,
            updatedAt = updatedAt,
            deletedAt = deletedAt
        )
    }

    private fun PinEventEntity.toDomain(): PinEvent {
        val methodEnum = repairMethod?.let {
            runCatching { RepairMethod.valueOf(it.uppercase()) }.getOrNull()
        }
        return PinEvent(
            id = id,
            pinId = pinId,
            kind = kind,
            eventDate = eventDate,
            repairMethod = methodEnum,
            spliceLossDbm = spliceLossDbm,
            note = note,
            createdAt = createdAt,
            updatedAt = updatedAt,
            deletedAt = deletedAt
        )
    }

    private fun RepairLogEntity.toDomain(): RepairLog {
        val methodEnum = runCatching { RepairMethod.valueOf(repairMethod.uppercase()) }.getOrDefault(RepairMethod.FUSION)
        return RepairLog(
            id = id,
            lineId = lineId,
            pinId = pinId,
            spliceLossDbm = spliceLossDbm,
            fiberCutLocation = fiberCutLocation,
            cutLat = cutLat,
            cutLon = cutLon,
            chainageM = chainageM,
            repairTimestamp = repairTimestamp,
            technicianName = technicianName,
            repairMethod = methodEnum,
            closureTag = closureTag,
            notes = notes,
            createdAt = createdAt,
            updatedAt = updatedAt,
            deletedAt = deletedAt
        )
    }
}
