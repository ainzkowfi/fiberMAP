package com.example.ui.pins

import androidx.compose.foundation.background
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.core.geo.GeometryEngine
import com.example.domain.model.*
import com.example.ui.theme.LocalFiberColors
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PinDetailSheet(
    pin: FiberPin,
    associatedLine: FiberLine?,
    pinEvents: List<PinEvent>,
    onDismiss: () -> Unit,
    onMarkRepaired: (pinId: String, method: RepairMethod, spliceLossDbm: Double?, note: String) -> Unit,
    onDeletePin: (pinId: String) -> Unit
) {
    val fiberColors = LocalFiberColors.current
    var showRepairDialog by remember { mutableStateOf(false) }
    var selectedMethod by remember { mutableStateOf(RepairMethod.FUSION) }
    var repairSpliceLossText by remember { mutableStateOf("0.01") }
    var repairNote by remember { mutableStateOf("") }

    val sdf = remember { SimpleDateFormat("MMM d, yyyy HH:mm", Locale.US) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surface,
        modifier = Modifier.testTag("pin_detail_sheet")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header: Title and State Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = pin.label,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "${pin.type.title} • ${pin.chainageM?.let { GeometryEngine.formatChainage(it) } ?: "Off-Road / Free Point"}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                val (badgeColor, badgeText) = when {
                    pin.state == PinState.OPEN -> Pair(fiberColors.cut, "OPEN CUT")
                    pin.state == PinState.REPAIRED -> Pair(fiberColors.repaired, "REPAIRED")
                    else -> Pair(fiberColors.jacket, "EQUIPMENT")
                }

                Surface(
                    color = badgeColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, badgeColor)
                ) {
                    Text(
                        text = badgeText,
                        color = badgeColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            // Splice Loss Callout if repaired
            if (pin.state == PinState.REPAIRED) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = fiberColors.repaired.copy(alpha = 0.12f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, fiberColors.repaired.copy(alpha = 0.35f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Bolt, contentDescription = null, tint = fiberColors.repaired)
                            Column {
                                Text(
                                    text = "Optical Splice Loss",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = pin.spliceLossFormatted ?: "0.01 dBm",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = fiberColors.repaired
                                )
                            }
                        }

                        Text(
                            text = "Fusion Splice Verified",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = fiberColors.repaired
                        )
                    }
                }
            }

            // Associated Line & Geolocation Data
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Fiber Line", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(associatedLine?.name ?: "Off-Road Client Drop", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Coordinates", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("%.5f°N, %.5f°E".format(pin.lat, pin.lon), style = MaterialTheme.typography.bodyMedium)
                    }
                    if (pin.chainageM != null) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Chainage from Start", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(GeometryEngine.formatChainage(pin.chainageM), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                        }
                    }
                    if (pin.coilLengthM > 0) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Slack Coil Stored", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("${pin.coilLengthM.toInt()} meters", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                        }
                    }
                    if (pin.notes.isNotEmpty()) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                        Text("Notes / Field Log:", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(pin.notes, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }

            // Event History List (Cut & Repair timeline)
            if (pinEvents.isNotEmpty()) {
                Text(
                    text = "REPAIR & SPLICING HISTORY",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    pinEvents.forEach { ev ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val icon = if (ev.kind == "repaired") Icons.Default.CheckCircle else Icons.Default.ErrorOutline
                            val iconTint = if (ev.kind == "repaired") fiberColors.repaired else fiberColors.cut
                            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = if (ev.kind == "repaired") {
                                        "Repaired (${ev.repairMethod?.title ?: "Fusion"}) • ${ev.spliceLossFormatted ?: "0.01 dBm"}"
                                    } else {
                                        "Cut Reported"
                                    },
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                                if (ev.note.isNotEmpty()) {
                                    Text(ev.note, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            Text(
                                text = sdf.format(Date(ev.eventDate)),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // Primary Repair / Splice Action Button
            if (pin.state == PinState.OPEN) {
                Button(
                    onClick = { showRepairDialog = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                        .testTag("mark_repaired_button"),
                    colors = ButtonDefaults.buttonColors(containerColor = fiberColors.repaired),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Build, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("MARK REPAIRED / SPLICED", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
            } else if (pin.state == PinState.REPAIRED) {
                OutlinedButton(
                    onClick = { showRepairDialog = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .testTag("update_repair_button"),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = fiberColors.repaired),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("UPDATE SPLICE LOSS / DETAILS")
                }
            }

            // Delete & Close buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        onDeletePin(pin.id)
                        onDismiss()
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                        .testTag("delete_pin_button"),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = fiberColors.cut),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Delete")
                }

                Button(
                    onClick = onDismiss,
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Close", color = MaterialTheme.colorScheme.onSurface)
                }
            }
        }
    }

    // Repair Method & Splice Loss Dialog
    if (showRepairDialog) {
        AlertDialog(
            onDismissRequest = { showRepairDialog = false },
            title = { Text("Log Splice Repair Details", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Select repair method used in field:")
                    RepairMethod.values().forEach { method ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            RadioButton(
                                selected = selectedMethod == method,
                                onClick = { selectedMethod = method }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(method.title, style = MaterialTheme.typography.bodyMedium)
                        }
                    }

                    OutlinedTextField(
                        value = repairSpliceLossText,
                        onValueChange = { repairSpliceLossText = it },
                        label = { Text("Measured Optical Splice Loss") },
                        placeholder = { Text("0.01") },
                        trailingIcon = { Text("dBm", fontWeight = FontWeight.Bold, modifier = Modifier.padding(end = 12.dp)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = repairNote,
                        onValueChange = { repairNote = it },
                        label = { Text("Technician Note / Enclosure Tag") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val loss = repairSpliceLossText.toDoubleOrNull() ?: 0.01
                        onMarkRepaired(
                            pin.id,
                            selectedMethod,
                            loss,
                            repairNote.ifEmpty { "Repaired with ${selectedMethod.title}. Loss: %.2f dBm".format(loss) }
                        )
                        showRepairDialog = false
                        onDismiss()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = fiberColors.repaired)
                ) {
                    Text("Confirm Splice Repair")
                }
            },
            dismissButton = {
                TextButton(onClick = { showRepairDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
