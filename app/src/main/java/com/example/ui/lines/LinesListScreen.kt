package com.example.ui.lines

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.example.domain.model.FiberLine
import com.example.domain.model.LineStatus
import com.example.domain.model.LineWithStats
import com.example.ui.theme.LocalFiberColors
import com.example.ui.theme.getFiberColor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LinesListScreen(
    linesWithStats: List<LineWithStats>,
    onLineClick: (LineWithStats) -> Unit,
    onSnapToMap: (FiberLine) -> Unit = {},
    onStartNewLine: () -> Unit,
    onRecordGpsLine: () -> Unit
) {
    val fiberColors = LocalFiberColors.current
    var searchQuery by remember { mutableStateOf("") }
    var statusFilter by remember { mutableStateOf<LineStatus?>(null) }

    val filteredLines = remember(linesWithStats, searchQuery, statusFilter) {
        linesWithStats.filter { stats ->
            val matchesQuery = searchQuery.isEmpty() ||
                    stats.line.name.contains(searchQuery, ignoreCase = true) ||
                    stats.line.fiberType.contains(searchQuery, ignoreCase = true) ||
                    stats.line.notes.contains(searchQuery, ignoreCase = true)
            val matchesStatus = statusFilter == null || stats.line.status == statusFilter
            matchesQuery && matchesStatus
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Fiber Lines",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Agusan del Sur • ${linesWithStats.size} routes monitored",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onStartNewLine,
                modifier = Modifier.testTag("new_line_fab"),
                containerColor = fiberColors.jacket,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("DRAW NEW LINE", fontWeight = FontWeight.Bold)
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("line_search_input"),
                placeholder = { Text("Search by line name, pole, or core count...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )

            // Status Filter Chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = statusFilter == null,
                    onClick = { statusFilter = null },
                    label = { Text("All (${linesWithStats.size})") }
                )
                FilterChip(
                    selected = statusFilter == LineStatus.ACTIVE,
                    onClick = { statusFilter = if (statusFilter == LineStatus.ACTIVE) null else LineStatus.ACTIVE },
                    label = { Text("Active") }
                )
                FilterChip(
                    selected = statusFilter == LineStatus.DAMAGED,
                    onClick = { statusFilter = if (statusFilter == LineStatus.DAMAGED) null else LineStatus.DAMAGED },
                    label = { Text("Damaged") }
                )
                FilterChip(
                    selected = statusFilter == LineStatus.PLANNED,
                    onClick = { statusFilter = if (statusFilter == LineStatus.PLANNED) null else LineStatus.PLANNED },
                    label = { Text("Planned") }
                )
            }

            // Lines List
            if (filteredLines.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.Timeline,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = if (searchQuery.isEmpty()) "No lines match the selected filter." else "No lines match '$searchQuery'",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .testTag("lines_list"),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 80.dp)
                ) {
                    items(filteredLines) { item ->
                        val line = item.line
                        val strandColor = getFiberColor(line.colorKey)

                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onLineClick(item) }
                                .testTag("line_card_${line.name.take(4).lowercase()}"),
                            shape = RoundedCornerShape(14.dp),
                            color = MaterialTheme.colorScheme.surface,
                            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                // Line Name, Color dot, and Status
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(12.dp)
                                                .background(strandColor, CircleShape)
                                        )
                                        Text(
                                            text = line.name,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.onSurface
                                        )
                                    }

                                    val statusColor = when (line.status) {
                                        LineStatus.ACTIVE -> fiberColors.repaired
                                        LineStatus.DAMAGED -> fiberColors.cut
                                        LineStatus.PLANNED -> fiberColors.jacket
                                        LineStatus.RETIRED -> fiberColors.muted
                                    }

                                    Surface(
                                        color = statusColor.copy(alpha = 0.15f),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = line.status.title.uppercase(),
                                            color = statusColor,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                        )
                                    }
                                }

                                // Specs strip
                                Text(
                                    text = "${line.fiberType} • ${line.coreCount ?: 24} Cores • ${GeometryEngine.formatChainage(line.lengthMapM)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )

                                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))

                                // Line Stats summary badges
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Text(
                                            text = "${item.totalCuts} cuts (${item.openCuts} open)",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (item.openCuts > 0) fiberColors.cut else MaterialTheme.colorScheme.onSurfaceVariant,
                                            fontWeight = if (item.openCuts > 0) FontWeight.Bold else FontWeight.Normal
                                        )
                                        Text(
                                            text = "•",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            text = "${item.totalRepairs} repairs",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            text = "•",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            text = item.cutsPerKmFormatted,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }

                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        IconButton(
                                            onClick = { onSnapToMap(line) },
                                            modifier = Modifier.size(32.dp).testTag("snap_line_map_${line.id.take(4)}")
                                        ) {
                                            Icon(
                                                Icons.Default.Map,
                                                contentDescription = "Snap to Map",
                                                tint = fiberColors.jacket,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                        Icon(
                                            Icons.Default.ChevronRight,
                                            contentDescription = "View Details",
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
