package com.example.ui.settings

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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.LocalFiberColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    currentTheme: String,
    currentHandedness: String,
    currentUnits: String,
    currentBackupFolder: String,
    onThemeChanged: (String) -> Unit,
    onHandednessChanged: (String) -> Unit,
    onUnitsChanged: (String) -> Unit,
    onBackupFolderChanged: (String) -> Unit,
    onOpenMapsManager: () -> Unit
) {
    val fiberColors = LocalFiberColors.current

    var showFolderDialog by remember { mutableStateOf(false) }
    var folderInput by remember { mutableStateOf(currentBackupFolder) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("App Settings", fontWeight = FontWeight.Bold)
                        Text(
                            "Preferences & Field Ergonomics",
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
                .testTag("settings_screen"),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            // Section 1: Appearance & Dark Mode (Requested Feature)
            item {
                Text(
                    text = "APPEARANCE & THEME",
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
                        Text(
                            text = "Display Theme",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Switch between high-contrast outdoor Light mode and battery-saving Dark mode for night operations.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            ThemeChoiceChip(
                                modifier = Modifier.weight(1f),
                                label = "System",
                                isSelected = currentTheme.equals("system", ignoreCase = true),
                                icon = Icons.Default.BrightnessAuto,
                                onClick = { onThemeChanged("system") }
                            )

                            ThemeChoiceChip(
                                modifier = Modifier.weight(1f),
                                label = "Light",
                                isSelected = currentTheme.equals("light", ignoreCase = true),
                                icon = Icons.Default.LightMode,
                                onClick = { onThemeChanged("light") }
                            )

                            ThemeChoiceChip(
                                modifier = Modifier.weight(1f),
                                label = "Dark",
                                isSelected = currentTheme.equals("dark", ignoreCase = true),
                                icon = Icons.Default.DarkMode,
                                onClick = { onThemeChanged("dark") }
                            )
                        }
                    }
                }
            }

            // Section 2: Field Ergonomics (Handedness & Thumb Reach)
            item {
                Text(
                    text = "FIELD ERGONOMICS",
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
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Handedness Mode", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                                Text("Positions primary map controls for one-handed thumb use", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = currentHandedness.equals("right", ignoreCase = true),
                                onClick = { onHandednessChanged("right") },
                                label = { Text("Right-Hand Mode") },
                                modifier = Modifier.weight(1f)
                            )
                            FilterChip(
                                selected = currentHandedness.equals("left", ignoreCase = true),
                                onClick = { onHandednessChanged("left") },
                                label = { Text("Left-Hand Mode") },
                                modifier = Modifier.weight(1f)
                            )
                        }

                        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                        Text("Chainage & Distance Notation", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            FilterChip(
                                selected = currentUnits.equals("chainage", ignoreCase = true),
                                onClick = { onUnitsChanged("chainage") },
                                label = { Text("Chainage (1+240 m)") },
                                modifier = Modifier.weight(1f)
                            )
                            FilterChip(
                                selected = currentUnits.equals("metric", ignoreCase = true),
                                onClick = { onUnitsChanged("metric") },
                                label = { Text("Metric (1.24 km)") },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            // Section 3: PMTiles Map Manager
            item {
                Text(
                    text = "MAP STORAGE",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)),
                    modifier = Modifier.clickable { onOpenMapsManager() }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Manage PMTiles Base Maps", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                            Text("Inspect imported vector tile packages & zoom levels", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            // Section 4: Backup Folder & Reminders
            item {
                Text(
                    text = "DATA SAFETY & BACKUPS",
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
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Auto-Snapshot Backup Directory", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                        Text(currentBackupFolder, style = MaterialTheme.typography.bodyMedium, color = fiberColors.jacket, fontWeight = FontWeight.Medium)
                        Text("All line modifications, cuts, and repairs are safely written to local SQLite database with zero cloud dependency.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            // Section 5: About fiberMAP
            item {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text("fiberMAP v1.0", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        Text("Agusan del Sur Offline Fiber Infrastructure Map", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("Designed for field line teams & cable records.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun ThemeChoiceChip(
    modifier: Modifier = Modifier,
    label: String,
    isSelected: Boolean,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    val fiberColors = LocalFiberColors.current
    Surface(
        modifier = modifier
            .height(54.dp)
            .clickable(onClick = onClick)
            .testTag("theme_chip_${label.lowercase()}"),
        shape = RoundedCornerShape(10.dp),
        color = if (isSelected) fiberColors.jacket.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        border = androidx.compose.foundation.BorderStroke(
            width = if (isSelected) 2.dp else 1.dp,
            color = if (isSelected) fiberColors.jacket else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isSelected) fiberColors.jacket else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                color = if (isSelected) fiberColors.jacket else MaterialTheme.colorScheme.onSurface
            )
        }
    }
}
