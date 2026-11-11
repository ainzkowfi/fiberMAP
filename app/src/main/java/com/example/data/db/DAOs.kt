package com.example.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface LineDao {
    @Query("SELECT * FROM lines WHERE deletedAt IS NULL ORDER BY updatedAt DESC")
    fun getAllLinesFlow(): Flow<List<LineEntity>>

    @Query("SELECT * FROM lines WHERE deletedAt IS NULL")
    suspend fun getAllLines(): List<LineEntity>

    @Query("SELECT * FROM lines WHERE id = :id LIMIT 1")
    suspend fun getLineById(id: String): LineEntity?

    @Query("SELECT * FROM lines WHERE id = :id LIMIT 1")
    fun getLineByIdFlow(id: String): Flow<LineEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLine(line: LineEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLines(lines: List<LineEntity>)

    @Update
    suspend fun updateLine(line: LineEntity)

    @Query("UPDATE lines SET deletedAt = :timestamp, updatedAt = :timestamp WHERE id = :id")
    suspend fun softDeleteLine(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("DELETE FROM lines WHERE id = :id")
    suspend fun hardDeleteLine(id: String)
}

@Dao
interface PinDao {
    @Query("SELECT * FROM pins WHERE deletedAt IS NULL ORDER BY chainageM ASC")
    fun getAllPinsFlow(): Flow<List<PinEntity>>

    @Query("SELECT * FROM pins WHERE deletedAt IS NULL")
    suspend fun getAllPins(): List<PinEntity>

    @Query("SELECT * FROM pins WHERE lineId = :lineId AND deletedAt IS NULL ORDER BY chainageM ASC")
    fun getPinsForLineFlow(lineId: String): Flow<List<PinEntity>>

    @Query("SELECT * FROM pins WHERE lineId = :lineId AND deletedAt IS NULL ORDER BY chainageM ASC")
    suspend fun getPinsForLine(lineId: String): List<PinEntity>

    @Query("SELECT * FROM pins WHERE id = :id LIMIT 1")
    suspend fun getPinById(id: String): PinEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPin(pin: PinEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPins(pins: List<PinEntity>)

    @Update
    suspend fun updatePin(pin: PinEntity)

    @Query("UPDATE pins SET deletedAt = :timestamp, updatedAt = :timestamp WHERE id = :id")
    suspend fun softDeletePin(id: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE pins SET deletedAt = :timestamp, updatedAt = :timestamp WHERE lineId = :lineId AND deletedAt IS NULL")
    suspend fun softDeletePinsForLine(lineId: String, timestamp: Long = System.currentTimeMillis())

    @Query("DELETE FROM pins WHERE id = :id")
    suspend fun hardDeletePin(id: String)

    @Query("DELETE FROM pins WHERE lineId = :lineId")
    suspend fun hardDeletePinsForLine(lineId: String)
}

@Dao
interface PinEventDao {
    @Query("SELECT * FROM pin_events WHERE deletedAt IS NULL ORDER BY eventDate DESC")
    fun getAllEventsFlow(): Flow<List<PinEventEntity>>

    @Query("SELECT * FROM pin_events WHERE deletedAt IS NULL")
    suspend fun getAllEvents(): List<PinEventEntity>

    @Query("SELECT * FROM pin_events WHERE pinId = :pinId AND deletedAt IS NULL ORDER BY eventDate DESC")
    fun getEventsForPinFlow(pinId: String): Flow<List<PinEventEntity>>

    @Query("SELECT * FROM pin_events WHERE pinId = :pinId AND deletedAt IS NULL ORDER BY eventDate DESC")
    suspend fun getEventsForPin(pinId: String): List<PinEventEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvent(event: PinEventEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvents(events: List<PinEventEntity>)

    @Query("UPDATE pin_events SET deletedAt = :timestamp WHERE pinId = :pinId AND deletedAt IS NULL")
    suspend fun softDeleteEventsForPin(pinId: String, timestamp: Long = System.currentTimeMillis())

    @Query("UPDATE pin_events SET deletedAt = :timestamp WHERE pinId IN (SELECT id FROM pins WHERE lineId = :lineId) AND deletedAt IS NULL")
    suspend fun softDeleteEventsForLine(lineId: String, timestamp: Long = System.currentTimeMillis())

    @Query("DELETE FROM pin_events WHERE pinId = :pinId")
    suspend fun hardDeleteEventsForPin(pinId: String)
}

@Dao
interface MapFileDao {
    @Query("SELECT * FROM map_files ORDER BY buildDate DESC")
    fun getAllMapFilesFlow(): Flow<List<MapFileEntity>>

    @Query("SELECT * FROM map_files WHERE active = 1 LIMIT 1")
    suspend fun getActiveMapFile(): MapFileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMapFile(mapFile: MapFileEntity)

    @Query("UPDATE map_files SET active = CASE WHEN id = :activeId THEN 1 ELSE 0 END")
    suspend fun setActiveMapFile(activeId: String)

    @Query("DELETE FROM map_files WHERE id = :id")
    suspend fun deleteMapFile(id: String)
}

@Dao
interface SettingDao {
    @Query("SELECT * FROM app_settings WHERE `key` = :key LIMIT 1")
    fun getSettingFlow(key: String): Flow<AppSettingEntity?>

    @Query("SELECT * FROM app_settings WHERE `key` = :key LIMIT 1")
    suspend fun getSetting(key: String): AppSettingEntity?

    @Query("SELECT * FROM app_settings")
    fun getAllSettingsFlow(): Flow<List<AppSettingEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setSetting(setting: AppSettingEntity)
}
