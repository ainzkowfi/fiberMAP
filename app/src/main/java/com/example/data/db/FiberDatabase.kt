package com.example.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.core.geo.AgusanDelSurData
import com.example.core.geo.GeometryEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.UUID

@Database(
    entities = [
        LineEntity::class,
        PinEntity::class,
        PinEventEntity::class,
        PhotoEntity::class,
        MapFileEntity::class,
        AppSettingEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class FiberDatabase : RoomDatabase() {
    abstract fun lineDao(): LineDao
    abstract fun pinDao(): PinDao
    abstract fun pinEventDao(): PinEventDao
    abstract fun mapFileDao(): MapFileDao
    abstract fun settingDao(): SettingDao

    companion object {
        @Volatile
        private var INSTANCE: FiberDatabase? = null

        fun getInstance(context: Context): FiberDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    FiberDatabase::class.java,
                    "fibermap.db"
                )
                    .fallbackToDestructiveMigration(true)
                    .addCallback(object : Callback() {
                        override fun onCreate(db: SupportSQLiteDatabase) {
                            super.onCreate(db)
                            // Seed realistic Agusan del Sur initial lines & historical cut/repair stats
                            CoroutineScope(Dispatchers.IO).launch {
                                getInstance(context).seedInitialData()
                            }
                        }
                    })
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }

    suspend fun seedInitialData() {
        val now = System.currentTimeMillis()
        val hourMs = 3600_000L
        val dayMs = 86400_000L

        // Line 1: Sulop - Prosperidad Trunk 24F
        val line1Id = UUID.randomUUID().toString()
        val line1Vertices = AgusanDelSurData.SULOP_TRUNK_VERTICES
        val line1Cum = GeometryEngine.computeCumulativeDistances(line1Vertices)
        val line1Length = line1Cum.lastOrNull() ?: 8420.0
        val line1Blob = GeometryEngine.encodeGeometryToBlob(line1Vertices)

        val line1 = LineEntity(
            id = line1Id,
            name = "Sulop - Prosperidad Trunk",
            colorKey = "blue",
            status = "active",
            fiberType = "G.652D 24F Armored Aerial",
            coreCount = 24,
            notes = "Main feeder along Maharlika Highway AH26 from San Francisco Hub to Patin-ay Capitol",
            geometry = line1Blob,
            lengthMapM = line1Length,
            slackPercent = 3.0,
            measuredLengthM = 8720.0,
            createdAt = now - (30 * dayMs),
            updatedAt = now - (2 * dayMs)
        )

        // Line 2: San Francisco Poblacion Ring 48F
        val line2Id = UUID.randomUUID().toString()
        val line2Vertices = AgusanDelSurData.SAN_FRANCISCO_RING_VERTICES
        val line2Cum = GeometryEngine.computeCumulativeDistances(line2Vertices)
        val line2Length = line2Cum.lastOrNull() ?: 4180.0
        val line2Blob = GeometryEngine.encodeGeometryToBlob(line2Vertices)

        val line2 = LineEntity(
            id = line2Id,
            name = "San Francisco Poblacion Ring",
            colorKey = "orange",
            status = "active",
            fiberType = "G.652D 48F Duct / Aerial",
            coreCount = 48,
            notes = "Commercial town distribution ring covering market, terminals, and hospital",
            geometry = line2Blob,
            lengthMapM = line2Length,
            slackPercent = 3.0,
            measuredLengthM = 4340.0,
            createdAt = now - (20 * dayMs),
            updatedAt = now - (1 * dayMs)
        )

        // Line 3: Bayugan - Rosario Feeder 12F
        val line3Id = UUID.randomUUID().toString()
        val line3Vertices = AgusanDelSurData.BAYUGAN_FEEDER_VERTICES
        val line3Cum = GeometryEngine.computeCumulativeDistances(line3Vertices)
        val line3Length = line3Cum.lastOrNull() ?: 6100.0
        val line3Blob = GeometryEngine.encodeGeometryToBlob(line3Vertices)

        val line3 = LineEntity(
            id = line3Id,
            name = "Bayugan - Rosario Feeder",
            colorKey = "red",
            status = "damaged",
            fiberType = "G.652D 12F ADSS",
            coreCount = 12,
            notes = "Highway feeder towards Rosario. Tree branch fell during rainstorm near Km 8.410",
            geometry = line3Blob,
            lengthMapM = line3Length,
            slackPercent = 3.0,
            measuredLengthM = null,
            createdAt = now - (10 * dayMs),
            updatedAt = now - (4 * hourMs)
        )

        lineDao().insertLines(listOf(line1, line2, line3))

        // Create realistic pins for Line 1 (Cuts with repair history, NAP, Slack coil, Joint)
        // Pin 1: Historic Cut repaired via Fusion Splice
        val pin1Id = UUID.randomUUID().toString()
        val pin1Point = GeometryEngine.getPointAtChainage(1240.0, line1Vertices, line1Cum) ?: line1Vertices[1]
        val pin1 = PinEntity(
            id = pin1Id,
            lineId = line1Id,
            type = "cut_repair",
            lat = pin1Point.lat,
            lon = pin1Point.lon,
            snapLat = pin1Point.lat,
            snapLon = pin1Point.lon,
            chainageM = 1240.0,
            gpsAccuracyM = 3.2,
            label = "Cut at Km 1+240 (Backhoe incident)",
            notes = "Hit by DPWH roadside drainage excavator. 12 tubes severed.",
            state = "repaired",
            spliceLossDbm = 0.01,
            coilLengthM = 0.0,
            createdAt = now - (15 * dayMs),
            updatedAt = now - (15 * dayMs) + (3 * hourMs + 45 * 60_000L) // 3h 45m repair time
        )

        val pin1CutEvent = PinEventEntity(
            id = UUID.randomUUID().toString(),
            pinId = pin1Id,
            kind = "cut",
            eventDate = now - (15 * dayMs),
            repairMethod = null,
            spliceLossDbm = null,
            note = "Emergency fiber break logged by NOC OTDR trace.",
            createdAt = now - (15 * dayMs)
        )

        val pin1RepairEvent = PinEventEntity(
            id = UUID.randomUUID().toString(),
            pinId = pin1Id,
            kind = "repaired",
            eventDate = now - (15 * dayMs) + (3 * hourMs + 45 * 60_000L),
            repairMethod = "fusion",
            spliceLossDbm = 0.01,
            note = "Repaired with FOSC-400B4 fusion splice closure by team Alpha. Loss 0.01 dBm.",
            createdAt = now - (15 * dayMs) + (3 * hourMs + 45 * 60_000L)
        )

        // Pin 2: Historic Cut 2 repaired
        val pin2Id = UUID.randomUUID().toString()
        val pin2Point = GeometryEngine.getPointAtChainage(3850.0, line1Vertices, line1Cum) ?: line1Vertices[3]
        val pin2 = PinEntity(
            id = pin2Id,
            lineId = line1Id,
            type = "cut_repair",
            lat = pin2Point.lat,
            lon = pin2Point.lon,
            snapLat = pin2Point.lat,
            snapLon = pin2Point.lon,
            chainageM = 3850.0,
            gpsAccuracyM = 2.8,
            label = "Cut at Km 3+850 (Fallen Mahogany limb)",
            notes = "Strong winds snapped messenger wire and fiber jacket.",
            state = "repaired",
            spliceLossDbm = 0.02,
            coilLengthM = 0.0,
            createdAt = now - (7 * dayMs),
            updatedAt = now - (7 * dayMs) + (2 * hourMs + 15 * 60_000L) // 2h 15m repair time
        )

        val pin2CutEvent = PinEventEntity(
            id = UUID.randomUUID().toString(),
            pinId = pin2Id,
            kind = "cut",
            eventDate = now - (7 * dayMs),
            repairMethod = null,
            spliceLossDbm = null,
            note = "Line tension alarm triggered OTDR dispatched.",
            createdAt = now - (7 * dayMs)
        )

        val pin2RepairEvent = PinEventEntity(
            id = UUID.randomUUID().toString(),
            pinId = pin2Id,
            kind = "repaired",
            eventDate = now - (7 * dayMs) + (2 * hourMs + 15 * 60_000L),
            repairMethod = "fusion",
            spliceLossDbm = 0.02,
            note = "24 fusion splices performed, loss avg 0.02 dBm.",
            createdAt = now - (7 * dayMs) + (2 * hourMs + 15 * 60_000L)
        )

        // Pin 3: Open Cut currently on Line 1!
        val pin3Id = UUID.randomUUID().toString()
        val pin3Point = GeometryEngine.getPointAtChainage(5600.0, line1Vertices, line1Cum) ?: line1Vertices[5]
        val pin3 = PinEntity(
            id = pin3Id,
            lineId = line1Id,
            type = "cut_repair",
            lat = pin3Point.lat,
            lon = pin3Point.lon,
            snapLat = pin3Point.lat,
            snapLon = pin3Point.lon,
            chainageM = 5600.0,
            gpsAccuracyM = 4.1,
            label = "Cut at Km 5+600 (Recent OTDR alarm)",
            notes = "OTDR read 5.76 km from OLT. Span near bridge crossing damaged.",
            state = "open",
            coilLengthM = 0.0,
            createdAt = now - (4 * hourMs),
            updatedAt = now - (4 * hourMs)
        )

        val pin3CutEvent = PinEventEntity(
            id = UUID.randomUUID().toString(),
            pinId = pin3Id,
            kind = "cut",
            eventDate = now - (4 * hourMs),
            repairMethod = null,
            note = "Pending technician fusion team arrival with OTDR.",
            createdAt = now - (4 * hourMs)
        )

        // Pin 4: Slack Coil on Pole 42
        val pin4Id = UUID.randomUUID().toString()
        val pin4Point = GeometryEngine.getPointAtChainage(2800.0, line1Vertices, line1Cum) ?: line1Vertices[2]
        val pin4 = PinEntity(
            id = pin4Id,
            lineId = line1Id,
            type = "slack_coil",
            lat = pin4Point.lat,
            lon = pin4Point.lon,
            snapLat = pin4Point.lat,
            snapLon = pin4Point.lon,
            chainageM = 2800.0,
            gpsAccuracyM = 1.9,
            label = "Pole 42 Snowshoe Slack Coil",
            notes = "25m spare cable looped on snowshoe hanger for future splicing",
            state = "none",
            coilLengthM = 25.0,
            createdAt = now - (25 * dayMs),
            updatedAt = now - (25 * dayMs)
        )

        // Pin 5: Splitter / NAP 1:8
        val pin5Id = UUID.randomUUID().toString()
        val pin5Point = GeometryEngine.getPointAtChainage(4400.0, line1Vertices, line1Cum) ?: line1Vertices[4]
        val pin5 = PinEntity(
            id = pin5Id,
            lineId = line1Id,
            type = "splitter_nap",
            lat = pin5Point.lat,
            lon = pin5Point.lon,
            snapLat = pin5Point.lat,
            snapLon = pin5Point.lon,
            chainageM = 4400.0,
            gpsAccuracyM = 2.0,
            label = "NAP-08 Patin-ay Junction",
            notes = "1:8 PLC splitter feeding local government units and RHU",
            state = "none",
            coilLengthM = 0.0,
            createdAt = now - (25 * dayMs),
            updatedAt = now - (25 * dayMs)
        )

        pinDao().insertPins(listOf(pin1, pin2, pin3, pin4, pin5))
        pinEventDao().insertEvents(listOf(pin1CutEvent, pin1RepairEvent, pin2CutEvent, pin2RepairEvent, pin3CutEvent))

        // Initial App Settings
        settingDao().setSetting(AppSettingEntity("theme", "system"))
        settingDao().setSetting(AppSettingEntity("handedness", "right"))
        settingDao().setSetting(AppSettingEntity("units", "chainage"))

        // Register default Agusan del Sur base map record
        val defaultMap = MapFileEntity(
            id = UUID.randomUUID().toString(),
            displayName = "Agusan del Sur Vector Basemap (Offline)",
            path = "builtin://agusan_del_sur.pmtiles",
            sizeBytes = 24_576_000L,
            minZoom = 8,
            maxZoom = 17,
            bounds = "7.95,125.60,8.85,126.25",
            buildDate = now,
            active = true
        )
        mapFileDao().insertMapFile(defaultMap)
    }
}
