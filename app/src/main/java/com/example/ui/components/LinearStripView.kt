package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.core.geo.GeometryEngine
import com.example.domain.model.FiberLine
import com.example.domain.model.FiberPin
import com.example.domain.model.PinState
import com.example.domain.model.PinType
import com.example.ui.theme.LocalFiberColors
import com.example.ui.theme.getFiberColor

@Composable
fun LinearStripView(
    line: FiberLine,
    pins: List<FiberPin>,
    selectedPinId: String? = null,
    onPinSelected: (FiberPin) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val fiberColors = LocalFiberColors.current
    val totalLength = line.lengthMapM.coerceAtLeast(100.0)
    val lineColor = getFiberColor(line.colorKey)

    var inspectedPin by remember { mutableStateOf<FiberPin?>(null) }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .testTag("linear_strip_view"),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "LINEAR STRIP VIEW (0m -> ${GeometryEngine.formatChainage(totalLength)})",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (inspectedPin != null) {
                    Text(
                        text = "${inspectedPin?.label} (${GeometryEngine.formatChainage(inspectedPin?.chainageM ?: 0.0)})",
                        style = MaterialTheme.typography.labelSmall,
                        color = fiberColors.jacket,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            val onSurfaceColor = MaterialTheme.colorScheme.onSurface
            val outlineColor = MaterialTheme.colorScheme.outline

            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .pointerInput(line, pins) {
                        detectTapGestures { offset ->
                            val width = size.width
                            val paddingX = 24.dp.toPx()
                            val usableWidth = width - 2 * paddingX
                            if (usableWidth > 0) {
                                val tapRatio = ((offset.x - paddingX) / usableWidth).coerceIn(0f, 1f)
                                val tapDistance = tapRatio * totalLength

                                // Find nearest pin within 250m
                                val nearest = pins
                                    .filter { it.chainageM != null }
                                    .minByOrNull { kotlin.math.abs((it.chainageM ?: 0.0) - tapDistance) }

                                if (nearest != null && kotlin.math.abs((nearest.chainageM ?: 0.0) - tapDistance) < totalLength * 0.08) {
                                    inspectedPin = nearest
                                    onPinSelected(nearest)
                                }
                            }
                        }
                    }
            ) {
                val paddingX = 24.dp.toPx()
                val centerY = size.height / 2f
                val usableWidth = size.width - 2 * paddingX

                // 1. Base fiber line
                drawLine(
                    color = Color.White.copy(alpha = 0.8f),
                    start = Offset(paddingX, centerY),
                    end = Offset(size.width - paddingX, centerY),
                    strokeWidth = 6.dp.toPx()
                )
                drawLine(
                    color = lineColor,
                    start = Offset(paddingX, centerY),
                    end = Offset(size.width - paddingX, centerY),
                    strokeWidth = 4.dp.toPx()
                )

                // 2. Start and End endpoints
                drawCircle(
                    color = onSurfaceColor,
                    radius = 4.dp.toPx(),
                    center = Offset(paddingX, centerY)
                )
                drawCircle(
                    color = onSurfaceColor,
                    radius = 4.dp.toPx(),
                    center = Offset(size.width - paddingX, centerY)
                )

                // 3. Chainage Ticks (every 1 km or 500m)
                val tickIntervalM = if (totalLength > 10_000.0) 2000.0 else if (totalLength > 3000.0) 1000.0 else 500.0
                var currentTick = tickIntervalM
                while (currentTick < totalLength) {
                    val ratio = (currentTick / totalLength).toFloat()
                    val x = paddingX + ratio * usableWidth
                    drawLine(
                        color = outlineColor,
                        start = Offset(x, centerY - 6.dp.toPx()),
                        end = Offset(x, centerY + 6.dp.toPx()),
                        strokeWidth = 1.5.dp.toPx()
                    )
                    currentTick += tickIntervalM
                }

                // 4. Draw Pins along the strip
                for (pin in pins) {
                    val chainage = pin.chainageM ?: continue
                    val ratio = (chainage / totalLength).coerceIn(0.0, 1.0).toFloat()
                    val x = paddingX + ratio * usableWidth

                    val pinColor = when {
                        pin.type == PinType.CUT_REPAIR && pin.state == PinState.OPEN -> fiberColors.cut
                        pin.type == PinType.CUT_REPAIR && pin.state == PinState.REPAIRED -> fiberColors.repaired
                        pin.type == PinType.SLACK_COIL -> Color(0xFFF5A623)
                        pin.type == PinType.SPLITTER_NAP -> Color(0xFF00B4D8)
                        else -> fiberColors.jacket
                    }

                    val isSelected = pin.id == selectedPinId || pin.id == inspectedPin?.id

                    if (pin.type == PinType.CUT_REPAIR) {
                        // Diamond shape for Cut/Repair
                        val sizeR = if (isSelected) 8.dp.toPx() else 6.dp.toPx()
                        val path = Path().apply {
                            moveTo(x, centerY - sizeR)
                            lineTo(x + sizeR, centerY)
                            lineTo(x, centerY + sizeR)
                            lineTo(x - sizeR, centerY)
                            close()
                        }
                        drawPath(path, color = pinColor)
                        drawPath(path, color = Color.White, style = Stroke(width = 1.5.dp.toPx()))
                    } else {
                        // Circle / Node
                        val rad = if (isSelected) 7.dp.toPx() else 5.dp.toPx()
                        drawCircle(color = pinColor, radius = rad, center = Offset(x, centerY))
                        drawCircle(color = Color.White, radius = rad, center = Offset(x, centerY), style = Stroke(width = 1.5.dp.toPx()))
                    }
                }
            }
        }
    }
}
