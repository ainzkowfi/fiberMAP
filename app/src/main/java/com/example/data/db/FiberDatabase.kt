package com.example.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
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
    version = 3,
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
                            // Initialize default settings and map file only - NO example/sample lines or pins
                            CoroutineScope(Dispatchers.IO).launch {
                                getInstance(context).initializeDefaultSettings()
                            }
                        }
                    })
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }

    suspend fun initializeDefaultSettings() {
        val now = System.currentTimeMillis()

        // Initial App Settings only
        settingDao().setSetting(AppSettingEntity("theme", "system"))
        settingDao().setSetting(AppSettingEntity("handedness", "right"))
        settingDao().setSetting(AppSettingEntity("units", "chainage"))

        // Register default Agusan del Sur base map metadata
        val defaultMap = MapFileEntity(
            id = UUID.randomUUID().toString(),
            displayName = "Agusan del Sur Vector Basemap (Offline)",
            path = "builtin://agusan_del_sur.pmtiles",
            sizeBytes = 24_576_000L,
            minZoom = 8,
            maxZoom = 17,
            bounds = "7.50,125.00,9.20,126.80",
            buildDate = now,
            active = true
        )
        mapFileDao().insertMapFile(defaultMap)
    }
}
