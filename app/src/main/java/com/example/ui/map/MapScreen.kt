package com.example.ui.map

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.core.geo.*
import com.example.domain.model.*
import com.example.ui.components.LinearStripView
import com.example.ui.lines.DrawMethod
import com.example.ui.lines.LineDrawControls
import com.example.ui.lines.SaveLineMetadataDialog
import com.example.ui.otdr.FindByDistanceDialog
import com.example.ui.pins.DropPinSheet
import com.example.ui.pins.PinDetailSheet
import com.example.ui.theme.LocalFiberColors
import com.example.ui.theme.getFiberColor

@Composable
fun MapScreen(
    lines: List<FiberLine>,
    pins: List<FiberPin>,
    events: List<PinEvent>,
    selectedLineId: String?,
    focusLocation: GeoPoint? = null,
    focusZoom: Float? = null,
    onSelectLine: (String?) -> Unit,
    onSaveLine: (FiberLine) -> Unit,
    onDropPin: (
        location: GeoPoint,
        lineId: String?,
        type: PinType,
        label: String,
        notes: String,
        state: PinState,
        spliceLossDbm: Double?,
        coilLengthM: Double
    ) -> Unit,
    onMarkRepaired: (pinId: String, method: RepairMethod, spliceLossDbm: Double?, note: String) -> Unit,
    onDeletePin: (pinId: String) -> Unit,
    onOpenSettings: () -> Unit,
    onOpenMapsManager: () -> Unit,
    startInDrawMode: Boolean = false,
    initialDrawMethod: DrawMethod = DrawMethod.MANUAL,
    onDrawModeStarted: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val fiberColors = LocalFiberColors.current
    val context = LocalContext.current

    // GPS Route Tracker for Walk/Drive tracking & live location dot
    val gpsTracker = remember { GpsRouteTracker(context) }
    val gpsFix by gpsTracker.currentFix.collectAsState()
    val isGpsRecording by gpsTracker.isTracking.collectAsState()
    val isGpsPaused by gpsTracker.isPaused.collectAsState()
    val gpsRecordedVertices by gpsTracker.recordedVertices.collectAsState()
    val gpsDistanceM by gpsTracker.distanceFromStartM.collectAsState()

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.any { it }) {
            gpsTracker.startListening()
        }
    }

    LaunchedEffect(Unit) {
        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
        gpsTracker.startListening()
    }

    DisposableEffect(Unit) {
        onDispose {
            gpsTracker.stopListening()
        }
    }

    // Reticle center location
    var reticleLocation by remember { mutableStateOf(AgusanDelSurData.DEFAULT_CENTER) }

    // Drop Pin Target Location (either from center reticle or hold-click on map)
    var pinDropLocation by remember { mutableStateOf<GeoPoint?>(null) }

    // Selected Pin for details sheet
    var inspectedPin by remember { mutableStateOf<FiberPin?>(null) }

    // Active OTDR match for uncertainty band
    var activeOtdrMatch by remember { mutableStateOf<OtdrMapMatch?>(null) }

    // Modals state
    var showDropPinSheet by remember { mutableStateOf(false) }
    var showFindByDistance by remember { mutableStateOf(false) }
    var showSelectLineMenu by remember { mutableStateOf(false) }

    // Manual Draw Mode & GPS Tracker Mode
    var isDrawingMode by remember { mutableStateOf(startInDrawMode) }
    var drawMethod by remember { mutableStateOf(initialDrawMethod) }
    val drawingVertices = remember { mutableStateListOf<GeoPoint>() }
    var showSaveLineDialog by remember { mutableStateOf(false) }

    LaunchedEffect(startInDrawMode, initialDrawMethod) {
        if (startInDrawMode) {
            isDrawingMode = true
            drawMethod = initialDrawMethod
            drawingVertices.clear()
            onDrawModeStarted()
        }
    }

    // Active vertices in draw mode: either manual tapped list or gps recorded list
    val activeVertices = remember(isDrawingMode, drawMethod, drawingVertices.toList(), gpsRecordedVertices) {
        if (drawMethod == DrawMethod.DRIVE_GPS) gpsRecordedVertices else drawingVertices.toList()
    }

    // Active selected line
    val selectedLine = remember(lines, selectedLineId) {
        lines.find { it.id == selectedLineId } ?: lines.firstOrNull()
    }

    val selectedLinePins = remember(pins, selectedLine) {
        pins.filter { it.lineId == selectedLine?.id }
    }

    val selectedLineCutsCount = remember(selectedLinePins) {
        selectedLinePins.count { it.type == PinType.CUT_REPAIR }
    }

    Box(modifier = modifier.fillMaxSize().testTag("map_screen_root")) {
        // 1. Full-Bleed Offline Vector Map with 1:1 dragging, hold-to-drop, and measure-style tapping
        OfflineVectorMapView(
            lines = lines,
            pins = pins,
            selectedLineId = selectedLine?.id,
            selectedPinId = inspectedPin?.id,
            activeOtdrMatch = activeOtdrMatch,
            drawingVertices = activeVertices,
            isDrawingMode = isDrawingMode,
            userGpsLocation = gpsFix?.point,
            userGpsAccuracyM = gpsFix?.accuracyM,
            focusTarget = focusLocation,
            focusZoom = focusZoom,
            onReticleLocationChanged = { reticleLocation = it },
            onPinClicked = { pin -> inspectedPin = pin },
            onLineClicked = { line -> onSelectLine(line.id) },
            onMapTapInDrawMode = { tappedGeo ->
                if (drawMethod == DrawMethod.MANUAL) {
                    drawingVertices.add(tappedGeo)
                }
            },
            onMapLongClick = { touchedGeo ->
                pinDropLocation = touchedGeo
                showDropPinSheet = true
            }
        )

        // 2. Top Status Strip / Google Maps Measure Style Overlay
        if (isDrawingMode && drawMethod == DrawMethod.MANUAL) {
            val cumDistances = remember(drawingVertices.toList()) {
                GeometryEngine.computeCumulativeDistances(drawingVertices)
            }
            val totalDistM = cumDistances.lastOrNull() ?: 0.0
            val formattedDist = if (totalDistM >= 1000.0) "%.2f km (%,.0f m)".format(totalDistM / 1000.0, totalDistM) else "%,.0f m".format(totalDistM)

            Surface(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 12.dp, vertical = 6.dp)
                    .testTag("google_maps_measure_overlay"),
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 8.dp,
                border = androidx.compose.foundation.BorderStroke(1.5.dp, fiberColors.jacket)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            IconButton(
                                onClick = {
                                    isDrawingMode = false
                                    drawingVertices.clear()
                                },
                                modifier = Modifier.size(36.dp).testTag("measure_exit_button")
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Exit Measure Mode")
                            }
                            Column {
                                Text(
                                    text = "MEASURE / DRAW ROUTE",
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = fiberColors.jacket
                                )
                                Text(
                                    text = formattedDist,
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.Black,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            // Undo button
                            IconButton(
                                onClick = {
                                    if (drawingVertices.isNotEmpty()) {
                                        drawingVertices.removeAt(drawingVertices.size - 1)
                                    }
                                },
                                enabled = drawingVertices.isNotEmpty(),
                                modifier = Modifier.size(40.dp).testTag("measure_undo_button")
                            ) {
                                Icon(
                                    Icons.Default.Undo,
                                    contentDescription = "Undo Vertex",
                                    tint = if (drawingVertices.isNotEmpty()) fiberColors.jacket else MaterialTheme.colorScheme.outline
                                )
                            }

                            // Clear button
                            if (drawingVertices.isNotEmpty()) {
                                IconButton(
                                    onClick = { drawingVertices.clear() },
                                    modifier = Modifier.size(40.dp).testTag("measure_clear_button")
                                ) {
                                    Icon(Icons.Default.Refresh, contentDescription = "Clear All", tint = fiberColors.cut)
                                }
                            }

                            // Save Line Button
                            Button(
                                onClick = { showSaveLineDialog = true },
                                enabled = drawingVertices.size >= 2,
                                colors = ButtonDefaults.buttonColors(containerColor = fiberColors.repaired),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                modifier = Modifier.testTag("measure_save_button")
                            ) {
                                Text("SAVE", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }

                    Text(
                        text = "Tap anywhere on map to place corners • ${drawingVertices.size} corners placed",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 44.dp, top = 2.dp)
                    )
                }
            }
        } else {
            Surface(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 14.dp, vertical = 6.dp)
                    .testTag("top_status_strip"),
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f),
                shadowElevation = 4.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Line info / Selector button
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier
                            .clickable { showSelectLineMenu = !showSelectLineMenu }
                            .testTag("line_selector_dropdown_trigger")
                    ) {
                        if (selectedLine != null) {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .background(getFiberColor(selectedLine.colorKey), CircleShape)
                            )
                            Column {
                                Text(
                                    text = selectedLine.name,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1
                                )
                                Text(
                                    text = "${GeometryEngine.formatChainage(selectedLine.lengthMapM)} • $selectedLineCutsCount cuts (${selectedLine.status.title})",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        } else {
                            Text(
                                text = "Agusan del Sur Fiber Map",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Icon(
                            Icons.Default.ArrowDropDown,
                            contentDescription = "Switch Line",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Top right actions: Settings & Maps Manager
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        IconButton(
                            onClick = onOpenMapsManager,
                            modifier = Modifier.size(36.dp).testTag("open_maps_manager_button")
                        ) {
                            Icon(Icons.Default.Layers, contentDescription = "PMTiles Maps", tint = fiberColors.jacket, modifier = Modifier.size(20.dp))
                        }
                        IconButton(
                            onClick = onOpenSettings,
                            modifier = Modifier.size(36.dp).testTag("open_settings_button")
                        ) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }
        }

        // Dropdown Menu to switch active fiber line
        DropdownMenu(
            expanded = showSelectLineMenu,
            onDismissRequest = { showSelectLineMenu = false }
        ) {
            lines.forEach { line ->
                DropdownMenuItem(
                    text = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .background(getFiberColor(line.colorKey), CircleShape)
                            )
                            Text(line.name, fontWeight = if (line.id == selectedLine?.id) FontWeight.Bold else FontWeight.Normal)
                        }
                    },
                    onClick = {
                        onSelectLine(line.id)
                        showSelectLineMenu = false
                    }
                )
            }
        }

        // 3. Floating Quick Tools Bar (OTDR Finder, Draw Mode)
        if (!isDrawingMode) {
            Column(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // OTDR Find by Distance
                FloatingActionButton(
                    onClick = { showFindByDistance = true },
                    modifier = Modifier
                        .size(48.dp)
                        .testTag("otdr_locator_fab"),
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = fiberColors.jacket,
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(Icons.Default.Search, contentDescription = "OTDR Distance Search")
                }

                // Manual Draw Line Mode
                FloatingActionButton(
                    onClick = {
                        isDrawingMode = true
                        drawingVertices.clear()
                    },
                    modifier = Modifier
                        .size(48.dp)
                        .testTag("start_draw_mode_fab"),
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = fiberColors.jacket,
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(Icons.Default.EditRoad, contentDescription = "Draw Fiber Line")
                }

                // Clear OTDR highlight if active
                if (activeOtdrMatch != null) {
                    FloatingActionButton(
                        onClick = { activeOtdrMatch = null },
                        modifier = Modifier.size(48.dp),
                        containerColor = fiberColors.cut.copy(alpha = 0.15f),
                        contentColor = fiberColors.cut,
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Default.Clear, contentDescription = "Clear OTDR Band")
                    }
                }
            }
        }

        // 4. Bottom Thumb Control Area (Bottom 40%)
        if (isDrawingMode) {
            LineDrawControls(
                currentMethod = drawMethod,
                onMethodChanged = { drawMethod = it },
                currentPoints = activeVertices,
                reticlePoint = reticleLocation,
                gpsFix = gpsFix,
                isGpsRecording = isGpsRecording,
                isGpsPaused = isGpsPaused,
                gpsDistanceM = gpsDistanceM,
                onStartGpsRecording = { gpsTracker.startRouteRecording() },
                onPauseGpsRecording = { gpsTracker.pauseRouteRecording() },
                onResumeGpsRecording = { gpsTracker.resumeRouteRecording() },
                onLogCurrentGpsPoint = { gpsTracker.logManualPointAtCurrentFix() },
                onAddPoint = { drawingVertices.add(reticleLocation) },
                onUndoPoint = {
                    if (drawMethod == DrawMethod.MANUAL) {
                        if (drawingVertices.isNotEmpty()) drawingVertices.removeAt(drawingVertices.size - 1)
                    } else {
                        gpsTracker.undoLastRecordedPoint()
                    }
                },
                onSaveLineClick = { showSaveLineDialog = true },
                onCancelDrawing = {
                    isDrawingMode = false
                    drawingVertices.clear()
                    gpsTracker.resetTracker()
                },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        } else {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Linear strip view preview if a line is active
                if (selectedLine != null && selectedLine.vertices.size >= 2) {
                    LinearStripView(
                        line = selectedLine,
                        pins = selectedLinePins,
                        selectedPinId = inspectedPin?.id,
                        onPinSelected = { pin -> inspectedPin = pin }
                    )
                }

                // Primary Action Button: "Drop pin here" (56dp height minimum)
                Button(
                    onClick = {
                        pinDropLocation = reticleLocation
                        showDropPinSheet = true
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .testTag("drop_pin_here_button"),
                    colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket),
                    shape = RoundedCornerShape(14.dp),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Place,
                        contentDescription = null,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "DROP PIN HERE (OR HOLD MAP)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )
                }
            }
        }

        // 5. Active Sheets & Modals
        if (showDropPinSheet) {
            val dropTarget = pinDropLocation ?: reticleLocation
            DropPinSheet(
                targetLocation = dropTarget,
                lines = lines,
                selectedLineId = selectedLine?.id,
                onDismiss = {
                    showDropPinSheet = false
                    pinDropLocation = null
                },
                onSavePin = { lineId, type, label, notes, state, lossDbm, coilLen ->
                    onDropPin(dropTarget, lineId, type, label, notes, state, lossDbm, coilLen)
                    pinDropLocation = null
                }
            )
        }

        if (inspectedPin != null) {
            val pin = inspectedPin!!
            val assocLine = lines.find { it.id == pin.lineId }
            val pinEvs = events.filter { it.pinId == pin.id }
            PinDetailSheet(
                pin = pin,
                associatedLine = assocLine,
                pinEvents = pinEvs,
                onDismiss = { inspectedPin = null },
                onMarkRepaired = { pinId, method, lossDbm, note ->
                    onMarkRepaired(pinId, method, lossDbm, note)
                },
                onDeletePin = onDeletePin
            )
        }

        if (showFindByDistance && selectedLine != null) {
            FindByDistanceDialog(
                line = selectedLine,
                pins = selectedLinePins,
                onDismiss = { showFindByDistance = false },
                onLocateOnMap = { match ->
                    activeOtdrMatch = match
                },
                onDropCutPinAtOtdr = { match ->
                    activeOtdrMatch = match
                    onDropPin(
                        match.point,
                        selectedLine.id,
                        PinType.CUT_REPAIR,
                        "OTDR Cut at ${GeometryEngine.formatChainage(match.targetMapDistanceM)}",
                        "Located from OTDR reading with slack compensation",
                        PinState.OPEN,
                        null,
                        0.0
                    )
                }
            )
        }

        if (showSaveLineDialog) {
            SaveLineMetadataDialog(
                points = activeVertices,
                onDismiss = { showSaveLineDialog = false },
                onConfirm = { name, colorKey, status, fiberType, cores, notes ->
                    val newLine = FiberLine(
                        id = java.util.UUID.randomUUID().toString(),
                        name = name,
                        colorKey = colorKey,
                        status = status,
                        fiberType = fiberType,
                        coreCount = cores,
                        notes = notes,
                        vertices = activeVertices
                    )
                    onSaveLine(newLine)
                    onSelectLine(newLine.id)
                    isDrawingMode = false
                    drawingVertices.clear()
                    gpsTracker.resetTracker()
                    showSaveLineDialog = false
                }
            )
        }
    }
}
