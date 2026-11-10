package com.example.ui.otdr

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material.icons.filled.ContentCut
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.core.geo.GeometryEngine
import com.example.core.geo.OtdrMapMatch
import com.example.domain.model.FiberLine
import com.example.domain.model.FiberPin
import com.example.domain.model.PinType
import com.example.ui.theme.LocalFiberColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FindByDistanceDialog(
    line: FiberLine,
    pins: List<FiberPin>,
    onDismiss: () -> Unit,
    onLocateOnMap: (OtdrMapMatch) -> Unit,
    onDropCutPinAtOtdr: (OtdrMapMatch) -> Unit
) {
    val fiberColors = LocalFiberColors.current

    var distanceInput by remember { mutableStateOf("5760") } // Initial sample OTDR reading
    var fromEnd by remember { mutableStateOf(false) }

    val otdrMeters = distanceInput.toDoubleOrNull() ?: 0.0

    // Coils along this line
    val coils = remember(pins) {
        pins.filter { it.type == PinType.SLACK_COIL && it.chainageM != null }
            .map { Pair(it.chainageM!!, it.coilLengthM) }
    }

    val matchResult = remember(distanceInput, fromEnd, line) {
        if (otdrMeters > 0 && line.vertices.size >= 2) {
            GeometryEngine.otdrToMapLocation(
                otdrDistanceM = otdrMeters,
                fromEnd = fromEnd,
                slackPercent = line.slackPercent,
                coils = coils,
                polyline = line.vertices
            )
        } else {
            null
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surface,
        modifier = Modifier.testTag("find_by_distance_dialog")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .navigationBarsPadding(),
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
                        text = "Find by OTDR Distance",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Line: ${line.name} (${GeometryEngine.formatChainage(line.lengthMapM)})",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Surface(
                    color = fiberColors.jacket.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "SLACK: ${line.slackPercent.toInt()}%",
                        color = fiberColors.jacket,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // Reference Toggle: From Start (OLT) vs From End
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = !fromEnd,
                    onClick = { fromEnd = false },
                    label = { Text("From Start (OLT / Hub)") },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = fromEnd,
                    onClick = { fromEnd = true },
                    label = { Text("From Far End") },
                    modifier = Modifier.weight(1f)
                )
            }

            // Digital Reading Display
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "OTDR CABLE READING",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = if (distanceInput.isEmpty()) "0 m" else "$distanceInput m",
                        style = MaterialTheme.typography.displayMedium,
                        fontWeight = FontWeight.Bold,
                        color = fiberColors.jacket
                    )
                    if (matchResult != null) {
                        Text(
                            text = "Map Target: ${GeometryEngine.formatChainage(matchResult.targetMapDistanceM)} (±3% range)",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        if (matchResult.coilsPassedM > 0) {
                            Text(
                                text = "Subtracted ${matchResult.coilsPassedM.toInt()}m from intermediate slack coils",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // Custom Big Thumb Keypad
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val row1 = listOf("1", "2", "3")
                val row2 = listOf("4", "5", "6")
                val row3 = listOf("7", "8", "9")

                KeypadRow(row1) { distanceInput += it }
                KeypadRow(row2) { distanceInput += it }
                KeypadRow(row3) { distanceInput += it }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    KeypadButton(
                        modifier = Modifier.weight(1f),
                        text = "CLR",
                        onClick = { distanceInput = "" }
                    )
                    KeypadButton(
                        modifier = Modifier.weight(1f),
                        text = "0",
                        onClick = { distanceInput += "0" }
                    )
                    KeypadButton(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Default.Backspace,
                        onClick = { if (distanceInput.isNotEmpty()) distanceInput = distanceInput.dropLast(1) }
                    )
                }
            }

            // Action Buttons
            if (matchResult != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            onLocateOnMap(matchResult)
                            onDismiss()
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .testTag("otdr_show_on_map_button"),
                        colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.MyLocation, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("SHOW ON MAP")
                    }

                    Button(
                        onClick = {
                            onDropCutPinAtOtdr(matchResult)
                            onDismiss()
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .testTag("otdr_drop_cut_button"),
                        colors = ButtonDefaults.buttonColors(containerColor = fiberColors.cut),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.ContentCut, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("DROP CUT PIN")
                    }
                }
            }
        }
    }
}

@Composable
private fun KeypadRow(keys: List<String>, onKey: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        keys.forEach { k ->
            KeypadButton(modifier = Modifier.weight(1f), text = k, onClick = { onKey(k) })
        }
    }
}

@Composable
private fun KeypadButton(
    modifier: Modifier = Modifier,
    text: String? = null,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .height(48.dp)
            .clickable(onClick = onClick)
            .testTag("keypad_${text ?: "icon"}"),
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.8f),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (text != null) {
                Text(
                    text = text,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            } else if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}
