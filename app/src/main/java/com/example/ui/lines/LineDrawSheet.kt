package com.example.ui.lines

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.core.geo.GeoPoint
import com.example.core.geo.GeometryEngine
import com.example.core.geo.GpsFix
import com.example.domain.model.LineStatus
import com.example.ui.theme.LocalFiberColors
import com.example.ui.theme.getFiberColor

enum class DrawMethod(val title: String) {
    MANUAL("Manual (Tap Map)"),
    DRIVE_GPS("Drive / Walk GPS")
}

@Composable
fun LineDrawControls(
    currentMethod: DrawMethod,
    onMethodChanged: (DrawMethod) -> Unit,
    currentPoints: List<GeoPoint>,
    reticlePoint: GeoPoint,
    gpsFix: GpsFix?,
    isGpsRecording: Boolean,
    isGpsPaused: Boolean,
    gpsDistanceM: Double,
    onStartGpsRecording: () -> Unit,
    onPauseGpsRecording: () -> Unit,
    onResumeGpsRecording: () -> Unit,
    onLogCurrentGpsPoint: () -> Unit,
    onAddPoint: () -> Unit,
    onUndoPoint: () -> Unit,
    onSaveLineClick: () -> Unit,
    onCancelDrawing: () -> Unit,
    modifier: Modifier = Modifier
) {
    val fiberColors = LocalFiberColors.current
    var showInstructionsDialog by remember { mutableStateOf(false) }

    val liveDistance = remember(currentPoints, currentMethod, gpsDistanceM) {
        if (currentMethod == DrawMethod.DRIVE_GPS) {
            gpsDistanceM
        } else {
            val cum = GeometryEngine.computeCumulativeDistances(currentPoints)
            cum.lastOrNull() ?: 0.0
        }
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .testTag("line_draw_controls"),
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 8.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Mode Selector Tabs & Instructions Trigger
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Segmented button for Manual vs Drive GPS
                Row(
                    modifier = Modifier
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
                        .padding(3.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    DrawMethod.values().forEach { method ->
                        val isSelected = currentMethod == method
                        Surface(
                            onClick = { onMethodChanged(method) },
                            shape = RoundedCornerShape(8.dp),
                            color = if (isSelected) fiberColors.jacket else Color.Transparent,
                            modifier = Modifier.testTag("draw_mode_tab_${method.name.lowercase()}")
                        ) {
                            Text(
                                text = method.title,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    IconButton(
                        onClick = { showInstructionsDialog = true },
                        modifier = Modifier.size(34.dp).testTag("line_draw_instructions_button")
                    ) {
                        Icon(
                            Icons.Default.HelpOutline,
                            contentDescription = "Drawing Instructions",
                            tint = fiberColors.jacket,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    TextButton(
                        onClick = onCancelDrawing,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text("Exit", color = fiberColors.cut, fontWeight = FontWeight.Bold)
                    }
                }
            }

            // Route metrics badge: Distance & Points count
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = if (currentMethod == DrawMethod.MANUAL) "MANUAL CORNER MODE" else "GPS DRIVE / WALK TRACKER",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = fiberColors.jacket
                    )
                    Text(
                        text = "Length: ${GeometryEngine.formatChainage(liveDistance)} (${currentPoints.size} corners/fixes)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                if (currentMethod == DrawMethod.DRIVE_GPS && gpsFix != null) {
                    Surface(
                        color = if (gpsFix.accuracyM <= 10f) fiberColors.repaired.copy(alpha = 0.15f) else Color(0xFFFF9800).copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .background(if (gpsFix.accuracyM <= 10f) fiberColors.repaired else Color(0xFFFF9800), CircleShape)
                            )
                            Text(
                                text = "±%.0fm • %.0f km/h".format(gpsFix.accuracyM, gpsFix.speedKmh),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }

            // Quick instruction tip
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = if (currentMethod == DrawMethod.MANUAL) Icons.Default.TouchApp else Icons.Default.DirectionsCar,
                        contentDescription = null,
                        tint = fiberColors.jacket,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = if (currentMethod == DrawMethod.MANUAL) {
                            "Tap anywhere on the map to place corners (like Google Maps Measure). Pan & zoom freely."
                        } else {
                            if (!isGpsRecording) "Tap 'Start Tracking' at your starting pole/OLT, then drive along the line."
                            else if (isGpsPaused) "Tracking paused. Tap 'Resume' to continue logging route."
                            else "Tracking active! Live fixes recorded every ~8m from start. Tap 'Log Pole' at key poles."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Action Buttons depending on Method
            if (currentMethod == DrawMethod.MANUAL) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onUndoPoint,
                        enabled = currentPoints.isNotEmpty(),
                        modifier = Modifier
                            .height(52.dp)
                            .testTag("undo_point_button"),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Undo, contentDescription = "Undo")
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Undo")
                    }

                    Button(
                        onClick = onAddPoint,
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .testTag("add_point_button"),
                        colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("ADD AT RETICLE (+)", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    Button(
                        onClick = onSaveLineClick,
                        enabled = currentPoints.size >= 2,
                        modifier = Modifier
                            .height(52.dp)
                            .testTag("save_drawn_line_button"),
                        colors = ButtonDefaults.buttonColors(containerColor = fiberColors.repaired),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Save")
                    }
                }
            } else {
                // GPS Drive / Walk Controls
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (!isGpsRecording) {
                        Button(
                            onClick = onStartGpsRecording,
                            modifier = Modifier
                                .weight(1f)
                                .height(52.dp)
                                .testTag("start_gps_tracking_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("START GPS TRACKING", fontWeight = FontWeight.Bold)
                        }
                    } else {
                        if (isGpsPaused) {
                            Button(
                                onClick = onResumeGpsRecording,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp)
                                    .testTag("resume_gps_tracking_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Resume")
                            }
                        } else {
                            OutlinedButton(
                                onClick = onPauseGpsRecording,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp)
                                    .testTag("pause_gps_tracking_button"),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Pause, contentDescription = null)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Pause")
                            }
                        }

                        // Manual Log Pole Fix
                        Button(
                            onClick = onLogCurrentGpsPoint,
                            modifier = Modifier
                                .height(52.dp)
                                .testTag("log_current_gps_fix_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.AddLocation, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Log Pole")
                        }
                    }

                    Button(
                        onClick = onSaveLineClick,
                        enabled = currentPoints.size >= 2,
                        modifier = Modifier
                            .height(52.dp)
                            .testTag("save_gps_line_button"),
                        colors = ButtonDefaults.buttonColors(containerColor = fiberColors.repaired),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Save")
                    }
                }
            }
        }
    }

    if (showInstructionsDialog) {
        LineCreationGuideDialog(
            initialMethod = currentMethod,
            onDismiss = { showInstructionsDialog = false }
        )
    }
}

@Composable
fun LineCreationGuideDialog(
    initialMethod: DrawMethod,
    onDismiss: () -> Unit
) {
    val fiberColors = LocalFiberColors.current
    var selectedTab by remember { mutableStateOf(initialMethod) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.MenuBook, contentDescription = null, tint = fiberColors.jacket)
                Text("How to Create Fiber Lines", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Tab switcher
                TabRow(
                    selectedTabIndex = selectedTab.ordinal,
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                ) {
                    DrawMethod.values().forEach { method ->
                        Tab(
                            selected = selectedTab == method,
                            onClick = { selectedTab = method },
                            text = { Text(if (method == DrawMethod.MANUAL) "Manual Tap" else "Drive GPS") }
                        )
                    }
                }

                if (selectedTab == DrawMethod.MANUAL) {
                    GuideStepItem(
                        number = "1",
                        title = "Tap Map to Drop Corners (Google Maps style)",
                        body = "Simply tap anywhere on the map to place a corner or pole along your route. You do not need to follow streets precisely—you can trace through private properties, off-street alleys, or customer drops."
                    )
                    GuideStepItem(
                        number = "2",
                        title = "Pan & Zoom Between Corners",
                        body = "Drag the map smoothly with one finger to scroll down the road or zoom in to inspect pole locations before tapping the next corner."
                    )
                    GuideStepItem(
                        number = "3",
                        title = "Live Length & Undo",
                        body = "The cumulative length (chainage) updates immediately with each corner. Tap 'Undo' if you misplace a corner."
                    )
                    GuideStepItem(
                        number = "4",
                        title = "Save Route",
                        body = "Once you have 2 or more corners, tap 'Save' to specify the line name, strand color coding, core count (e.g. 24F), and notes."
                    )
                } else {
                    GuideStepItem(
                        number = "1",
                        title = "Start at the OLT or First Pole",
                        body = "Stand or park at the start of your fiber run. Tap 'Start GPS Tracking'. The app sets this as 0.00 km chainage."
                    )
                    GuideStepItem(
                        number = "2",
                        title = "Drive or Walk the Path",
                        body = "Drive your service vehicle or walk along the route. The app automatically logs GPS fixes every ~8 meters with built-in jitter filtering."
                    )
                    GuideStepItem(
                        number = "3",
                        title = "Log Key Poles or Splice Cabinets",
                        body = "When stopping at an important physical pole, closure, or NAP, tap 'Log Pole' to guarantee an exact milestone vertex is placed."
                    )
                    GuideStepItem(
                        number = "4",
                        title = "Finish & Save",
                        body = "When you reach the terminal enclosure or client site, tap 'Save' to name the line and store the route into your offline database."
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket)
            ) {
                Text("Got It")
            }
        }
    )
}

@Composable
private fun GuideStepItem(
    number: String,
    title: String,
    body: String
) {
    val fiberColors = LocalFiberColors.current
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .background(fiberColors.jacket, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = number,
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun SaveLineMetadataDialog(
    points: List<GeoPoint>,
    onDismiss: () -> Unit,
    onConfirm: (name: String, colorKey: String, status: LineStatus, fiberType: String, coreCount: Int, notes: String) -> Unit
) {
    val fiberColors = LocalFiberColors.current

    var lineName by remember { mutableStateOf("Agusan Feeder Line") }
    var selectedColor by remember { mutableStateOf("blue") }
    var selectedStatus by remember { mutableStateOf(LineStatus.ACTIVE) }
    var fiberType by remember { mutableStateOf("G.652D Single Mode Aerial") }
    var coreCount by remember { mutableStateOf("24") }
    var lineNotes by remember { mutableStateOf("") }

    val strandColors = listOf("blue", "orange", "green", "brown", "slate", "white", "red", "black", "yellow", "violet", "rose", "aqua")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Save Fiber Line", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = lineName,
                    onValueChange = { lineName = it },
                    label = { Text("Line Name") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("new_line_name_input")
                )

                Text(
                    text = "Strand Color Coding:",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(strandColors) { colorKey ->
                        val col = getFiberColor(colorKey)
                        val isChosen = selectedColor == colorKey
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .background(col, CircleShape)
                                .border(
                                    width = if (isChosen) 3.dp else 1.dp,
                                    color = if (isChosen) MaterialTheme.colorScheme.onSurface else Color.LightGray,
                                    shape = CircleShape
                                )
                                .clickable { selectedColor = colorKey }
                                .testTag("color_picker_$colorKey"),
                            contentAlignment = Alignment.Center
                        ) {
                            if (isChosen) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = fiberType,
                    onValueChange = { fiberType = it },
                    label = { Text("Fiber Type") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = coreCount,
                    onValueChange = { coreCount = it },
                    label = { Text("Core Count") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = lineNotes,
                    onValueChange = { lineNotes = it },
                    label = { Text("Notes (optional)") },
                    maxLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val cores = coreCount.toIntOrNull() ?: 24
                    onConfirm(lineName.ifEmpty { "New Fiber Route" }, selectedColor, selectedStatus, fiberType, cores, lineNotes)
                },
                colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket),
                modifier = Modifier.testTag("confirm_save_line_button")
            ) {
                Text("Save Route")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
