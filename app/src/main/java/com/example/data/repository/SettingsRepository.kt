package com.example.data.repository

import com.example.data.db.AppSettingEntity
import com.example.data.db.FiberDatabase
import com.example.data.db.MapFileEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class SettingsRepository(private val db: FiberDatabase) {
    private val settingDao = db.settingDao()
    private val mapFileDao = db.mapFileDao()

    val themeModeFlow: Flow<String> = settingDao.getSettingFlow("theme").map { it?.value ?: "system" }
    val handednessFlow: Flow<String> = settingDao.getSettingFlow("handedness").map { it?.value ?: "right" }
    val unitsFlow: Flow<String> = settingDao.getSettingFlow("units").map { it?.value ?: "chainage" }
    val backupFolderFlow: Flow<String> = settingDao.getSettingFlow("backup_folder").map { it?.value ?: "Internal /Documents/fiberMAP" }

    val allMapFilesFlow: Flow<List<MapFileEntity>> = mapFileDao.getAllMapFilesFlow()

    suspend fun setThemeMode(mode: String) {
        settingDao.setSetting(AppSettingEntity("theme", mode))
    }

    suspend fun setHandedness(handedness: String) {
        settingDao.setSetting(AppSettingEntity("handedness", handedness))
    }

    suspend fun setUnits(units: String) {
        settingDao.setSetting(AppSettingEntity("units", units))
    }

    suspend fun setBackupFolder(path: String) {
        settingDao.setSetting(AppSettingEntity("backup_folder", path))
    }

    suspend fun addMapFile(mapFile: MapFileEntity) {
        mapFileDao.insertMapFile(mapFile)
    }

    suspend fun setActiveMapFile(id: String) {
        mapFileDao.setActiveMapFile(id)
    }

    suspend fun deleteMapFile(id: String) {
        mapFileDao.deleteMapFile(id)
    }
}
