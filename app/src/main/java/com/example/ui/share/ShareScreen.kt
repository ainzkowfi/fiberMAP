package com.example.ui.share

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.share.FiberExportImport
import com.example.data.share.QrMatrixGenerator
import com.example.domain.model.FiberLine
import com.example.domain.model.FiberPin
import com.example.domain.model.PinEvent
import com.example.ui.theme.LocalFiberColors
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareScreen(
    lines: List<FiberLine>,
    pins: List<FiberPin>,
    events: List<PinEvent>,
    onImportFmapJson: (String) -> Unit
) {
    val fiberColors = LocalFiberColors.current

    var showQrDialog by remember { mutableStateOf(false) }
    var exportPreviewTitle by remember { mutableStateOf<String?>(null) }
    var exportPreviewContent by remember { mutableStateOf("") }
    var showImportDialog by remember { mutableStateOf(false) }
    var importInputText by remember { mutableStateOf("") }
    var copyStatusMessage by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Share & Export", fontWeight = FontWeight.Bold)
                        Text(
                            "Offline P2P Transfer • GIS Export",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
                .testTag("share_screen_content"),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            // Notice Banner
            item {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = fiberColors.jacket.copy(alpha = 0.12f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, fiberColors.jacket.copy(alpha = 0.3f))
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(Icons.Default.WifiOff, contentDescription = null, tint = fiberColors.jacket)
                        Column {
                            Text(
                                text = "100% Offline Sharing",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = fiberColors.jacket
                            )
                            Text(
                                text = "Move fiber routes and repair histories between technician phones using animated QR loops or .fmap bundle files.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }

            // Section 1: Phone-to-Phone QR Transfer
            item {
                Text(
                    text = "DIRECT FIELD SHARING (PHONE TO PHONE)",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Display High-Contrast QR Code", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                Text("Loops multi-frame data packets for scanning in sunlight", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = fiberColors.jacket)
                        }

                        Button(
                            onClick = { showQrDialog = true },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                                .testTag("show_qr_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.QrCode2, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("SHOW SHARE QR CODE", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Section 2: GIS & File Export (.fmap, GeoJSON, KML, CSV)
            item {
                Text(
                    text = "DATA EXPORTS & SNAPSHOTS",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        ExportActionRow(
                            title = "Save .fmap Bundle",
                            subtitle = "Native database bundle with lines, pins, events & stats",
                            badge = ".FMAP",
                            onClick = {
                                val json = FiberExportImport.generateFmapBundleJson(lines, pins, events)
                                exportPreviewTitle = "fiberMAP Archive Bundle (.fmap)"
                                exportPreviewContent = json
                            }
                        )

                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                        ExportActionRow(
                            title = "Export GeoJSON",
                            subtitle = "Standard GIS vector lines and point coordinates for QGIS / ArcGIS",
                            badge = "GIS",
                            onClick = {
                                val geoJson = FiberExportImport.generateGeoJson(lines, pins)
                                exportPreviewTitle = "GeoJSON FeatureCollection"
                                exportPreviewContent = geoJson
                            }
                        )

                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                        ExportActionRow(
                            title = "Export KML",
                            subtitle = "Open in Google Earth / GPS devices",
                            badge = "KML",
                            onClick = {
                                val kml = FiberExportImport.generateKml(lines, pins)
                                exportPreviewTitle = "Google Earth KML"
                                exportPreviewContent = kml
                            }
                        )

                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                        ExportActionRow(
                            title = "Export Hardware Pins CSV",
                            subtitle = "Spreadsheet table with chainage, cuts, and repairs",
                            badge = "CSV",
                            onClick = {
                                val csv = FiberExportImport.generateCsv(pins)
                                exportPreviewTitle = "Hardware Pins Table (CSV)"
                                exportPreviewContent = csv
                            }
                        )
                    }
                }
            }

            // Section 3: Import Bundle
            item {
                OutlinedButton(
                    onClick = { showImportDialog = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .testTag("import_bundle_button"),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.FileDownload, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("IMPORT .FMAP / RESTORE SNAPSHOT")
                }
            }
        }
    }

    // QR Code Dialog with Frame Looping
    if (showQrDialog) {
        val bundleJson = remember { FiberExportImport.generateFmapBundleJson(lines, pins, events) }
        val frames = remember { QrMatrixGenerator.chunkPayload(bundleJson) }
        var currentFrameIndex by remember { mutableStateOf(0) }

        LaunchedEffect(frames.size) {
            if (frames.size > 1) {
                while (true) {
                    delay(350)
                    currentFrameIndex = (currentFrameIndex + 1) % frames.size
                }
            }
        }

        val activeFrame = frames.getOrElse(currentFrameIndex) { frames.first() }
        val matrix = remember(activeFrame.payload) {
            QrMatrixGenerator.generateMatrix(activeFrame.payload)
        }

        AlertDialog(
            onDismissRequest = { showQrDialog = false },
            title = {
                Column {
                    Text("Technician QR Share", fontWeight = FontWeight.Bold)
                    Text(
                        "Frame ${activeFrame.index} of ${activeFrame.totalCount} (ID: ${activeFrame.transferId})",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            },
            text = {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // QR Canvas with high contrast white quiet zone
                    Box(
                        modifier = Modifier
                            .size(240.dp)
                            .background(Color.White, RoundedCornerShape(12.dp))
                            .padding(12.dp)
                            .testTag("qr_matrix_canvas")
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val matrixSize = matrix.size
                            val cellSize = size.width / matrixSize

                            for (r in 0 until matrixSize) {
                                for (c in 0 until matrixSize) {
                                    if (matrix[r][c]) {
                                        drawRect(
                                            color = Color.Black,
                                            topLeft = Offset(c * cellSize, r * cellSize),
                                            size = Size(cellSize, cellSize)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Text(
                        text = "Point camera from second device to scan. Frames loop automatically.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp
                    )
                }
            },
            confirmButton = {
                Button(onClick = { showQrDialog = false }) {
                    Text("Done")
                }
            }
        )
    }

    // Export Preview Modal
    if (exportPreviewTitle != null) {
        AlertDialog(
            onDismissRequest = { exportPreviewTitle = null },
            title = { Text(exportPreviewTitle ?: "Export", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Ready to copy or save to backup folder:", style = MaterialTheme.typography.bodySmall)
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 240.dp)
                    ) {
                        Text(
                            text = exportPreviewContent.take(1000) + if (exportPreviewContent.length > 1000) "\n... [${exportPreviewContent.length} bytes]" else "",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        exportPreviewTitle = null
                    }
                ) {
                    Text("Save / Done")
                }
            }
        )
    }

    // Import Modal
    if (showImportDialog) {
        AlertDialog(
            onDismissRequest = { showImportDialog = false },
            title = { Text("Import .fmap Bundle", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Paste .fmap JSON content or snapshot payload:", style = MaterialTheme.typography.bodySmall)
                    OutlinedTextField(
                        value = importInputText,
                        onValueChange = { importInputText = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(140.dp)
                            .testTag("import_bundle_input"),
                        placeholder = { Text("{\"format\":\"fiberMAP-bundle\", ...}") }
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (importInputText.isNotEmpty()) {
                            onImportFmapJson(importInputText)
                        }
                        showImportDialog = false
                    }
                ) {
                    Text("Import & Merge")
                }
            },
            dismissButton = {
                TextButton(onClick = { showImportDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun ExportActionRow(
    title: String,
    subtitle: String,
    badge: String,
    onClick: () -> Unit
) {
    val fiberColors = LocalFiberColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Surface(
            color = fiberColors.jacket.copy(alpha = 0.15f),
            shape = RoundedCornerShape(6.dp)
        ) {
            Text(
                text = badge,
                color = fiberColors.jacket,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }
    }
}
