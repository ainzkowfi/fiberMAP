package com.example.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "lines",
    indices = [
        Index(value = ["name"]),
        Index(value = ["status"]),
        Index(value = ["deletedAt"])
    ]
)
data class LineEntity(
    @PrimaryKey val id: String,
    val name: String,
    val colorKey: String = "blue",
    val status: String = "active", // active, planned, damaged, retired
    val fiberType: String = "G.652D Single Mode",
    val coreCount: Int? = 24,
    val notes: String = "",
    val geometry: ByteArray = ByteArray(0),
    val lengthMapM: Double = 0.0,
    val slackPercent: Double = 3.0,
    val measuredLengthM: Double? = null,
    val parentLineId: String? = null,
    val branchChainageM: Double? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as LineEntity
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}

@Entity(
    tableName = "pins",
    indices = [
        Index(value = ["lineId"]),
        Index(value = ["type", "state"]),
        Index(value = ["deletedAt"])
    ]
)
data class PinEntity(
    @PrimaryKey val id: String,
    val lineId: String?,
    val type: String, // cut_repair, joint_closure, splitter_nap, pole_handhole, slack_coil, note
    val lat: Double,
    val lon: Double,
    val snapLat: Double,
    val snapLon: Double,
    val chainageM: Double?,
    val gpsAccuracyM: Double?,
    val label: String,
    val notes: String,
    val state: String, // open, repaired, none
    val spliceLossDbm: Double? = null,
    val coilLengthM: Double = 0.0,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null
)

@Entity(
    tableName = "pin_events",
    indices = [
        Index(value = ["pinId"]),
        Index(value = ["kind"]),
        Index(value = ["deletedAt"])
    ]
)
data class PinEventEntity(
    @PrimaryKey val id: String,
    val pinId: String,
    val kind: String, // cut, repaired, inspected, note
    val eventDate: Long,
    val repairMethod: String?, // fusion, mechanical, replaced_section
    val spliceLossDbm: Double? = null,
    val note: String,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null
)

@Entity(tableName = "photos")
data class PhotoEntity(
    @PrimaryKey val id: String,
    val pinId: String,
    val filePath: String,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "map_files")
data class MapFileEntity(
    @PrimaryKey val id: String,
    val displayName: String,
    val path: String,
    val sizeBytes: Long,
    val minZoom: Int = 0,
    val maxZoom: Int = 18,
    val bounds: String = "",
    val buildDate: Long = System.currentTimeMillis(),
    val active: Boolean = true
)

@Entity(tableName = "app_settings")
data class AppSettingEntity(
    @PrimaryKey val key: String,
    val value: String
)

@Entity(
    tableName = "repair_logs",
    indices = [
        Index(value = ["lineId"]),
        Index(value = ["pinId"]),
        Index(value = ["repairTimestamp"]),
        Index(value = ["deletedAt"])
    ]
)
data class RepairLogEntity(
    @PrimaryKey val id: String,
    val lineId: String?,
    val pinId: String?,
    val spliceLossDbm: Double, // Measured optical loss e.g. 0.01 dBm
    val fiberCutLocation: String, // Readable location e.g. "Km 2+450 (Patin-ay)"
    val cutLat: Double,
    val cutLon: Double,
    val chainageM: Double?,
    val repairTimestamp: Long, // Repair completion timestamp
    val technicianName: String = "",
    val repairMethod: String = "fusion", // fusion, mechanical, replaced_span
    val closureTag: String = "",
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val deletedAt: Long? = null
)

