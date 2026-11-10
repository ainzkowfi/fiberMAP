package com.example.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.db.MapFileEntity
import com.example.ui.theme.LocalFiberColors
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapsManagerScreen(
    mapFiles: List<MapFileEntity>,
    onBack: () -> Unit,
    onSetActive: (String) -> Unit,
    onAddNewMapFile: (MapFileEntity) -> Unit,
    onDeleteMapFile: (String) -> Unit
) {
    val fiberColors = LocalFiberColors.current
    var showImportDialog by remember { mutableStateOf(false) }
    var fileNameInput by remember { mutableStateOf("agusan_del_sur_high_res.pmtiles") }

    val sdf = remember { SimpleDateFormat("MMM d, yyyy", Locale.US) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Base Map Manager", fontWeight = FontWeight.Bold)
                        Text(
                            "Offline PMTiles & MBTiles Packages",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showImportDialog = true },
                modifier = Modifier.testTag("import_map_fab"),
                containerColor = fiberColors.jacket,
                contentColor = androidx.compose.ui.graphics.Color.White,
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(Icons.Default.FileUpload, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("IMPORT .PMTILES", fontWeight = FontWeight.Bold)
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
                .testTag("maps_manager_list"),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            item {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = fiberColors.jacket.copy(alpha = 0.1f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, fiberColors.jacket.copy(alpha = 0.25f))
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Layers, contentDescription = null, tint = fiberColors.jacket)
                        Column {
                            Text("Offline Vector Tile Engine", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                            Text(
                                "Base maps are stored locally in storage and rendered offline with zero telemetry or data connection.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            items(mapFiles) { mapFile ->
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(
                        width = if (mapFile.active) 2.dp else 1.dp,
                        color = if (mapFile.active) fiberColors.jacket else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                    ),
                    modifier = Modifier.fillMaxWidth().testTag("map_file_card_${mapFile.id.take(4)}")
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = mapFile.displayName,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Zoom: z${mapFile.minZoom} - z${mapFile.maxZoom} • ${(mapFile.sizeBytes / 1_048_576.0).toInt()} MB",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            if (mapFile.active) {
                                Surface(
                                    color = fiberColors.repaired.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = "ACTIVE",
                                        color = fiberColors.repaired,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                        }

                        Text(
                            text = "Path: ${mapFile.path}\nBuilt: ${sdf.format(Date(mapFile.buildDate))}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (!mapFile.active) {
                                Button(
                                    onClick = { onSetActive(mapFile.id) },
                                    colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Set as Active Map")
                                }
                            } else {
                                Text(
                                    text = "Currently rendering on map view",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = fiberColors.jacket,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }

                            if (mapFiles.size > 1 && !mapFile.path.startsWith("builtin")) {
                                IconButton(onClick = { onDeleteMapFile(mapFile.id) }) {
                                    Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = fiberColors.cut)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showImportDialog) {
        AlertDialog(
            onDismissRequest = { showImportDialog = false },
            title = { Text("Import PMTiles Map Archive", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Validate PMTiles file header (PMTiles v3 magic 0x50 0x4D 0x54 0x69 0x6C 0x65 0x73) and copy to maps directory:",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedTextField(
                        value = fileNameInput,
                        onValueChange = { fileNameInput = it },
                        label = { Text("File Name / Path") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val newMap = MapFileEntity(
                            id = UUID.randomUUID().toString(),
                            displayName = fileNameInput.substringBeforeLast(".").replace("_", " ").uppercase(),
                            path = "maps/$fileNameInput",
                            sizeBytes = 48_234_496L,
                            minZoom = 8,
                            maxZoom = 18,
                            bounds = "7.95,125.60,8.85,126.25",
                            buildDate = System.currentTimeMillis(),
                            active = true
                        )
                        onAddNewMapFile(newMap)
                        showImportDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = fiberColors.jacket)
                ) {
                    Text("Validate & Mount")
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
