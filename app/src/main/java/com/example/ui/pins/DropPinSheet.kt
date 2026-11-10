package com.example.ui.pins

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.core.geo.GeoPoint
import com.example.core.geo.GeometryEngine
import com.example.domain.model.*
import com.example.ui.theme.LocalFiberColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropPinSheet(
    targetLocation: GeoPoint,
    lines: List<FiberLine>,
    selectedLineId: String?,
    onDismiss: () -> Unit,
    onSavePin: (
        lineId: String?,
        type: PinType,
        label: String,
        notes: String,
        state: PinState,
        spliceLossDbm: Double?,
        coilLengthM: Double
    ) -> Unit
) {
    val fiberColors = LocalFiberColors.current

    var selectedType by remember { mutableStateOf(PinType.CUT_REPAIR) }
    var incidentStatus by remember { mutableStateOf(PinState.REPAIRED) } // Default to Repaired Splice per field workflow
    var spliceLossText by remember { mutableStateOf("0.01") } // Default fusion splice loss 0.01 dBm
    var snapToLineEnabled by remember { mutableStateOf(true) }

    var selectedLine by remember {
        mutableStateOf(lines.find { it.id == selectedLineId } ?: lines.firstOrNull())
    }
    var labelText by remember { mutableStateOf("") }
    var notesText by remember { mutableStateOf("") }
    var coilLengthText by remember { mutableStateOf("25") }

    // Check snapping to selected line
    val snapResult = remember(selectedLine, targetLocation) {
        selectedLine?.let { line ->
            GeometryEngine.snapPointToPolyline(targetLocation, line.vertices)
        }
    }

    val isNearLine = snapResult != null && snapResult.distanceToLineM <= 60.0

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surface,
        modifier = Modifier.testTag("drop_pin_sheet")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Add Map Pin",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Touch: %.5f°N, %.5f°E".format(targetLocation.lat, targetLocation.lon),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (isNearLine && snapToLineEnabled) {
                    Surface(
                        color = fiberColors.jacket.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, fiberColors.jacket)
                    ) {
                        Text(
                            text = "SNAPPED ${GeometryEngine.formatChainage(snapResult.chainageM)}",
                            color = fiberColors.jacket,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                } else {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "OFF-ROAD / FREE PIN",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            // Big Pin Type Grid (Large thumb targets)
            Text(
                text = "PIN HARDWARE TYPE",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                TypeTile(
                    modifier = Modifier.weight(1f),
                    title = "Splice / Cut",
                    icon = Icons.Default.Build,
                    isSelected = selectedType == PinType.CUT_REPAIR,
                    tint = if (incidentStatus == PinState.REPAIRED) fiberColors.repaired else fiberColors.cut,
                    onClick = { selectedType = PinType.CUT_REPAIR }
                )
                TypeTile(
                    modifier = Modifier.weight(1f),
                    title = "Joint Closure",
                    icon = Icons.Default.AccountTree,
                    isSelected = selectedType == PinType.JOINT_CLOSURE,
                    tint = fiberColors.jacket,
                    onClick = { selectedType = PinType.JOINT_CLOSURE }
                )
                TypeTile(
                    modifier = Modifier.weight(1f),
                    title = "NAP / Splitter",
                    icon = Icons.Default.Share,
                    isSelected = selectedType == PinType.SPLITTER_NAP,
                    tint = Color(0xFF00B4D8),
                    onClick = { selectedType = PinType.SPLITTER_NAP }
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                TypeTile(
                    modifier = Modifier.weight(1f),
                    title = "Pole / Vault",
                    icon = Icons.Default.LocationCity,
                    isSelected = selectedType == PinType.POLE_HANDHOLE,
                    tint = fiberColors.muted,
                    onClick = { selectedType = PinType.POLE_HANDHOLE }
                )
                TypeTile(
                    modifier = Modifier.weight(1f),
                    title = "Slack Coil",
                    icon = Icons.Default.Cached,
                    isSelected = selectedType == PinType.SLACK_COIL,
                    tint = Color(0xFFF5A623),
                    onClick = { selectedType = PinType.SLACK_COIL }
                )
                TypeTile(
                    modifier = Modifier.weight(1f),
                    title = "Field Note",
                    icon = Icons.Default.NoteAlt,
                    isSelected = selectedType == PinType.NOTE,
                    tint = fiberColors.muted,
                    onClick = { selectedType = PinType.NOTE }
                )
            }

            // If Cut/Repair: Status and Splice Loss Details
            if (selectedType == PinType.CUT_REPAIR) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "INCIDENT STATUS & SPLICING",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = incidentStatus == PinState.REPAIRED,
                                onClick = { incidentStatus = PinState.REPAIRED },
                                label = { Text("Repaired / Spliced") },
                                leadingIcon = {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = fiberColors.repaired)
                                },
                                modifier = Modifier.weight(1f).testTag("status_chip_repaired")
                            )

                            FilterChip(
                                selected = incidentStatus == PinState.OPEN,
                                onClick = { incidentStatus = PinState.OPEN },
                                label = { Text("Open Break / Cut") },
                                leadingIcon = {
                                    Icon(Icons.Default.Warning, contentDescription = null, tint = fiberColors.cut)
                                },
                                modifier = Modifier.weight(1f).testTag("status_chip_open")
                            )
                        }

                        if (incidentStatus == PinState.REPAIRED) {
                            OutlinedTextField(
                                value = spliceLossText,
                                onValueChange = { spliceLossText = it },
                                label = { Text("Optical Splice Loss") },
                                placeholder = { Text("0.01") },
                                trailingIcon = { Text("dBm", fontWeight = FontWeight.Bold, modifier = Modifier.padding(end = 12.dp)) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().testTag("splice_loss_input")
                            )
                        }
                    }
                }
            }

            // Snapping Options for off-road client homes
            if (isNearLine) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Snap to Line Route", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        Text("Align with trunk centerline or keep exact touch point", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(
                        checked = snapToLineEnabled,
                        onCheckedChange = { snapToLineEnabled = it }
                    )
                }
            }

            // Associated Line Selector
            if (lines.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "ASSOCIATED FIBER LINE",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        lines.take(3).forEach { line ->
                            val isChosen = selectedLine?.id == line.id
                            FilterChip(
                                selected = isChosen,
                                onClick = { selectedLine = line },
                                label = { Text(line.name.take(18)) },
                                modifier = Modifier.testTag("line_chip_${line.id.take(4)}")
                            )
                        }
                    }
                }
            }

            // Label & Notes input
            OutlinedTextField(
                value = labelText,
                onValueChange = { labelText = it },
                label = { Text("Label / Title") },
                placeholder = {
                    Text(
                        if (isNearLine && snapToLineEnabled) {
                            "${if (selectedType == PinType.CUT_REPAIR && incidentStatus == PinState.REPAIRED) "Repaired Splice" else selectedType.title} at ${GeometryEngine.formatChainage(snapResult!!.chainageM)}"
                        } else {
                            if (selectedType == PinType.CUT_REPAIR && incidentStatus == PinState.REPAIRED) "Repaired Splice" else selectedType.title
                        }
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("pin_label_input"),
                singleLine = true
            )

            if (selectedType == PinType.SLACK_COIL) {
                OutlinedTextField(
                    value = coilLengthText,
                    onValueChange = { coilLengthText = it },
                    label = { Text("Slack Coil Length (meters)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            OutlinedTextField(
                value = notesText,
                onValueChange = { notesText = it },
                label = { Text("Field Notes / Landmarks / Client Name") },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("pin_notes_input"),
                maxLines = 2
            )

            // Submit Button
            Button(
                onClick = {
                    val coilLen = coilLengthText.toDoubleOrNull() ?: 0.0
                    val lossDbm = spliceLossText.toDoubleOrNull()
                    val finalState = if (selectedType == PinType.CUT_REPAIR) incidentStatus else PinState.NONE
                    val effectiveLineId = if (snapToLineEnabled) selectedLine?.id else null

                    val finalLabel = labelText.ifEmpty {
                        val baseTitle = if (selectedType == PinType.CUT_REPAIR && incidentStatus == PinState.REPAIRED) {
                            "Repaired Splice"
                        } else {
                            selectedType.title
                        }
                        if (isNearLine && snapToLineEnabled && snapResult != null) {
                            "$baseTitle at ${GeometryEngine.formatChainage(snapResult.chainageM)}"
                        } else {
                            "$baseTitle at %.4f, %.4f".format(targetLocation.lat, targetLocation.lon)
                        }
                    }

                    onSavePin(effectiveLineId, selectedType, finalLabel, notesText, finalState, lossDbm, coilLen)
                    onDismiss()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .testTag("confirm_drop_pin_button"),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedType == PinType.CUT_REPAIR && incidentStatus == PinState.OPEN) {
                        fiberColors.cut
                    } else if (selectedType == PinType.CUT_REPAIR && incidentStatus == PinState.REPAIRED) {
                        fiberColors.repaired
                    } else {
                        fiberColors.jacket
                    }
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.Place, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (selectedType == PinType.CUT_REPAIR && incidentStatus == PinState.REPAIRED) {
                        "SAVE REPAIR RECORD"
                    } else if (selectedType == PinType.CUT_REPAIR && incidentStatus == PinState.OPEN) {
                        "LOG OPEN CUT"
                    } else {
                        "SAVE PIN"
                    },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun TypeTile(
    modifier: Modifier = Modifier,
    title: String,
    icon: ImageVector,
    isSelected: Boolean,
    tint: Color,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .height(68.dp)
            .clickable(onClick = onClick)
            .testTag("type_tile_${title.take(3).lowercase()}"),
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) tint.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        border = androidx.compose.foundation.BorderStroke(
            width = if (isSelected) 2.dp else 1.dp,
            color = if (isSelected) tint else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier.padding(6.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isSelected) tint else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = title,
                fontSize = 11.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                color = if (isSelected) tint else MaterialTheme.colorScheme.onSurface
            )
        }
    }
}
