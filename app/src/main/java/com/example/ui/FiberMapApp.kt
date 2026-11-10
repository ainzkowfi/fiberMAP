package com.example.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.core.geo.AgusanDelSurData
import com.example.core.geo.GeoPoint
import com.example.data.repository.FiberRepository
import com.example.data.repository.SettingsRepository
import com.example.domain.model.FiberLine
import com.example.domain.model.LineWithStats
import com.example.domain.model.PinType
import com.example.domain.model.RepairMethod
import com.example.ui.lines.LineDetailScreen
import com.example.ui.lines.LinesListScreen
import com.example.ui.map.MapScreen
import com.example.ui.maps.MapsManagerScreen
import com.example.ui.settings.SettingsScreen
import com.example.ui.share.ShareScreen
import com.example.ui.theme.FiberMapTheme
import kotlinx.coroutines.launch

enum class MainTab(val title: String, val icon: ImageVector) {
    MAP("Map", Icons.Default.Map),
    LINES("Lines", Icons.Default.Timeline),
    SHARE("Share", Icons.Default.Share)
}

enum class SubScreen {
    NONE,
    LINE_DETAIL,
    MAPS_MANAGER,
    SETTINGS
}

@Composable
fun FiberMapApp(
    fiberRepository: FiberRepository,
    settingsRepository: SettingsRepository
) {
    val coroutineScope = rememberCoroutineScope()

    // Observables from repositories
    val lines by fiberRepository.allLinesFlow.collectAsState(initial = emptyList())
    val linesWithStats by fiberRepository.linesWithStatsFlow.collectAsState(initial = emptyList())
    val pins by fiberRepository.allPinsFlow.collectAsState(initial = emptyList())
    val events by fiberRepository.allEventsFlow.collectAsState(initial = emptyList())

    val themeMode by settingsRepository.themeModeFlow.collectAsState(initial = "system")
    val handedness by settingsRepository.handednessFlow.collectAsState(initial = "right")
    val units by settingsRepository.unitsFlow.collectAsState(initial = "chainage")
    val backupFolder by settingsRepository.backupFolderFlow.collectAsState(initial = "Internal /Documents/fiberMAP")
    val mapFiles by settingsRepository.allMapFilesFlow.collectAsState(initial = emptyList())

    // Navigation & Map Focus State
    var currentTab by remember { mutableStateOf(MainTab.MAP) }
    var subScreen by remember { mutableStateOf(SubScreen.NONE) }
    var selectedLineId by remember { mutableStateOf<String?>(null) }
    var selectedLineWithStats by remember { mutableStateOf<LineWithStats?>(null) }

    // Target to center/zoom map when tapping an entry from lines list or detail
    var mapFocusTarget by remember { mutableStateOf<GeoPoint?>(null) }
    var mapFocusZoom by remember { mutableStateOf<Float?>(null) }

    // Direct draw mode trigger from Lines screen
    var startDrawModeRequested by remember { mutableStateOf(false) }
    var requestedDrawMethod by remember { mutableStateOf(com.example.ui.lines.DrawMethod.MANUAL) }

    fun snapToLineOnMap(line: FiberLine) {
        selectedLineId = line.id
        val centerPt = line.vertices.getOrNull(line.vertices.size / 2)
            ?: line.vertices.firstOrNull()
            ?: AgusanDelSurData.DEFAULT_CENTER
        mapFocusTarget = centerPt
        mapFocusZoom = 14.5f
        currentTab = MainTab.MAP
        subScreen = SubScreen.NONE
    }

    FiberMapTheme(themeMode = themeMode) {
        Scaffold(
            bottomBar = {
                if (subScreen == SubScreen.NONE) {
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surface,
                        tonalElevation = 8.dp,
                        modifier = Modifier.testTag("main_navigation_bar")
                    ) {
                        MainTab.values().forEach { tab ->
                            NavigationBarItem(
                                selected = currentTab == tab,
                                onClick = { currentTab = tab },
                                icon = { Icon(tab.icon, contentDescription = tab.title) },
                                label = { Text(tab.title, fontWeight = if (currentTab == tab) FontWeight.Bold else FontWeight.Normal) },
                                modifier = Modifier.testTag("nav_tab_${tab.name.lowercase()}")
                            )
                        }
                    }
                }
            }
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                when (subScreen) {
                    SubScreen.LINE_DETAIL -> {
                        BackHandler { subScreen = SubScreen.NONE }
                        val currentStats = selectedLineWithStats
                        if (currentStats != null) {
                            val linePins = pins.filter { it.lineId == currentStats.line.id }
                            LineDetailScreen(
                                stats = currentStats,
                                pins = linePins,
                                onBack = { subScreen = SubScreen.NONE },
                                onViewOnMap = { line -> snapToLineOnMap(line) },
                                onFindByDistance = { line ->
                                    snapToLineOnMap(line)
                                },
                                onPinClicked = { pin ->
                                    selectedLineId = pin.lineId
                                    mapFocusTarget = GeoPoint(pin.lat, pin.lon)
                                    mapFocusZoom = 16.5f
                                    currentTab = MainTab.MAP
                                    subScreen = SubScreen.NONE
                                },
                                onDeleteLine = { lineId ->
                                    coroutineScope.launch {
                                        fiberRepository.deleteLine(lineId)
                                        if (selectedLineId == lineId) {
                                            selectedLineId = null
                                            selectedLineWithStats = null
                                        }
                                        subScreen = SubScreen.NONE
                                    }
                                }
                            )
                        } else {
                            subScreen = SubScreen.NONE
                        }
                    }

                    SubScreen.MAPS_MANAGER -> {
                        BackHandler { subScreen = SubScreen.NONE }
                        MapsManagerScreen(
                            mapFiles = mapFiles,
                            onBack = { subScreen = SubScreen.NONE },
                            onSetActive = { id ->
                                coroutineScope.launch { settingsRepository.setActiveMapFile(id) }
                            },
                            onAddNewMapFile = { mapFile ->
                                coroutineScope.launch { settingsRepository.addMapFile(mapFile) }
                            },
                            onDeleteMapFile = { id ->
                                coroutineScope.launch { settingsRepository.deleteMapFile(id) }
                            }
                        )
                    }

                    SubScreen.SETTINGS -> {
                        BackHandler { subScreen = SubScreen.NONE }
                        SettingsScreen(
                            currentTheme = themeMode,
                            currentHandedness = handedness,
                            currentUnits = units,
                            currentBackupFolder = backupFolder,
                            onThemeChanged = { mode ->
                                coroutineScope.launch { settingsRepository.setThemeMode(mode) }
                            },
                            onHandednessChanged = { hand ->
                                coroutineScope.launch { settingsRepository.setHandedness(hand) }
                            },
                            onUnitsChanged = { u ->
                                coroutineScope.launch { settingsRepository.setUnits(u) }
                            },
                            onBackupFolderChanged = { folder ->
                                coroutineScope.launch { settingsRepository.setBackupFolder(folder) }
                            },
                            onOpenMapsManager = { subScreen = SubScreen.MAPS_MANAGER }
                        )
                    }

                    SubScreen.NONE -> {
                        when (currentTab) {
                            MainTab.MAP -> {
                                MapScreen(
                                    lines = lines,
                                    pins = pins,
                                    events = events,
                                    selectedLineId = selectedLineId,
                                    focusLocation = mapFocusTarget,
                                    focusZoom = mapFocusZoom,
                                    onSelectLine = { selectedLineId = it },
                                    onSaveLine = { line ->
                                        coroutineScope.launch { fiberRepository.saveLine(line) }
                                    },
                                    onDropPin = { location, lineId, type, label, notes, state, lossDbm, coilLen ->
                                        coroutineScope.launch {
                                            fiberRepository.dropPin(
                                                lineId = lineId,
                                                type = type,
                                                lat = location.lat,
                                                lon = location.lon,
                                                label = label,
                                                notes = notes,
                                                state = state,
                                                spliceLossDbm = lossDbm,
                                                coilLengthM = coilLen
                                            )
                                        }
                                    },
                                    onMarkRepaired = { pinId, method, lossDbm, note ->
                                        coroutineScope.launch {
                                            fiberRepository.markPinRepaired(pinId, method, lossDbm, note)
                                        }
                                    },
                                    onDeletePin = { pinId ->
                                        coroutineScope.launch {
                                            fiberRepository.deletePin(pinId)
                                        }
                                    },
                                    onOpenSettings = { subScreen = SubScreen.SETTINGS },
                                    onOpenMapsManager = { subScreen = SubScreen.MAPS_MANAGER },
                                    startInDrawMode = startDrawModeRequested,
                                    initialDrawMethod = requestedDrawMethod,
                                    onDrawModeStarted = { startDrawModeRequested = false }
                                )
                            }

                            MainTab.LINES -> {
                                LinesListScreen(
                                    linesWithStats = linesWithStats,
                                    onLineClick = { stats ->
                                        selectedLineWithStats = stats
                                        selectedLineId = stats.line.id
                                        subScreen = SubScreen.LINE_DETAIL
                                    },
                                    onSnapToMap = { line -> snapToLineOnMap(line) },
                                    onStartNewLine = {
                                        requestedDrawMethod = com.example.ui.lines.DrawMethod.MANUAL
                                        startDrawModeRequested = true
                                        currentTab = MainTab.MAP
                                    },
                                    onRecordGpsLine = {
                                        requestedDrawMethod = com.example.ui.lines.DrawMethod.DRIVE_GPS
                                        startDrawModeRequested = true
                                        currentTab = MainTab.MAP
                                    }
                                )
                            }

                            MainTab.SHARE -> {
                                ShareScreen(
                                    lines = lines,
                                    pins = pins,
                                    events = events,
                                    onImportFmapJson = { json ->
                                        // Merge / import implementation
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
