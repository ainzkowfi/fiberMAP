package com.example.ui.map

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.core.geo.*
import com.example.domain.model.*
import com.example.ui.theme.LocalFiberColors
import com.example.ui.theme.getFiberColor
import kotlin.math.*

@Composable
fun OfflineVectorMapView(
    lines: List<FiberLine>,
    pins: List<FiberPin>,
    selectedLineId: String?,
    selectedPinId: String?,
    activeOtdrMatch: OtdrMapMatch?,
    drawingVertices: List<GeoPoint>,
    isDrawingMode: Boolean,
    userGpsLocation: GeoPoint? = null,
    userGpsAccuracyM: Float? = null,
    focusTarget: GeoPoint? = null,
    focusZoom: Float? = null,
    onReticleLocationChanged: (GeoPoint) -> Unit,
    onPinClicked: (FiberPin) -> Unit,
    onLineClicked: (FiberLine) -> Unit,
    onMapTapInDrawMode: ((GeoPoint) -> Unit)? = null,
    onMapLongClick: ((GeoPoint) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val fiberColors = LocalFiberColors.current
    val textMeasurer = rememberTextMeasurer()

    // Camera Center (Latitude, Longitude) and Zoom level
    var cameraCenter by remember { mutableStateOf(AgusanDelSurData.DEFAULT_CENTER) }
    var zoomLevel by remember { mutableStateOf(AgusanDelSurData.DEFAULT_ZOOM) }

    LaunchedEffect(cameraCenter) {
        onReticleLocationChanged(cameraCenter)
    }

    // Auto snap and zoom when clicking entries from lines list or detail view
    LaunchedEffect(focusTarget) {
        if (focusTarget != null) {
            cameraCenter = focusTarget
            if (focusZoom != null) {
                zoomLevel = focusZoom
            } else if (zoomLevel < 14.5f) {
                zoomLevel = 14.5f
            }
        }
    }

    val currentCenter by rememberUpdatedState(cameraCenter)
    val currentZoom by rememberUpdatedState(zoomLevel)
    val currentLines by rememberUpdatedState(lines)
    val currentPins by rememberUpdatedState(pins)
    val currentIsDrawingMode by rememberUpdatedState(isDrawingMode)
    val currentOnMapTapInDrawMode by rememberUpdatedState(onMapTapInDrawMode)
    val currentOnPinClicked by rememberUpdatedState(onPinClicked)
    val currentOnLineClicked by rememberUpdatedState(onLineClicked)
    val currentOnMapLongClick by rememberUpdatedState(onMapLongClick)

    val outlineColor = MaterialTheme.colorScheme.outline
    val onSurfaceVariantColor = MaterialTheme.colorScheme.onSurfaceVariant
    val onSurfaceColor = MaterialTheme.colorScheme.onSurface

    Box(
        modifier = modifier
            .fillMaxSize()
            .testTag("offline_vector_map")
            .background(MaterialTheme.colorScheme.background)
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures(
                        onDoubleTap = { tapOffset ->
                            zoomLevel = (currentZoom + 1.0f).coerceAtMost(18.0f)
                        },
                        onLongPress = { longPressOffset ->
                            val w = size.width.toFloat()
                            val h = size.height.toFloat()
                            val geoPoint = screenToGeo(longPressOffset, currentCenter, currentZoom, w, h)
                            currentOnMapLongClick?.invoke(geoPoint)
                        },
                        onTap = { tapOffset ->
                            val w = size.width.toFloat()
                            val h = size.height.toFloat()
                            val center = currentCenter
                            val zoom = currentZoom
                            val tappedGeo = screenToGeo(tapOffset, center, zoom, w, h)

                            if (currentIsDrawingMode) {
                                currentOnMapTapInDrawMode?.invoke(tappedGeo)
                            } else {
                                // Hit test pins first (minimum 48dp touch hit target)
                                val hitRadiusPx = 32.dp.toPx()
                                var hitPin: FiberPin? = null

                                for (pin in currentPins) {
                                    val screenPt = geoToScreen(
                                        geo = GeoPoint(pin.lat, pin.lon),
                                        center = center,
                                        zoom = zoom,
                                        width = w,
                                        height = h
                                    )
                                    val dist = hypot(screenPt.x - tapOffset.x, screenPt.y - tapOffset.y)
                                    if (dist <= hitRadiusPx) {
                                        hitPin = pin
                                        break
                                    }
                                }

                                if (hitPin != null) {
                                    currentOnPinClicked(hitPin)
                                    return@detectTapGestures
                                }

                                // Hit test lines
                                var hitLine: FiberLine? = null
                                var minLineDist = 32.dp.toPx()

                                for (line in currentLines) {
                                    for (i in 0 until line.vertices.size - 1) {
                                        val p1 = geoToScreen(line.vertices[i], center, zoom, w, h)
                                        val p2 = geoToScreen(line.vertices[i + 1], center, zoom, w, h)
                                        val dist = distanceToSegment(tapOffset, p1, p2)
                                        if (dist < minLineDist) {
                                            minLineDist = dist
                                            hitLine = line
                                        }
                                    }
                                }

                                if (hitLine != null) {
                                    currentOnLineClicked(hitLine)
                                }
                            }
                        }
                    )
                }
                .pointerInput(Unit) {
                    detectTransformGestures(panZoomLock = false) { _, pan, zoomChange, _ ->
                        val oldZoom = currentZoom
                        val newZoom = (oldZoom * zoomChange).coerceIn(9.0f, 18.0f)
                        zoomLevel = newZoom

                        val scale = 256.0 * 2.0.pow(newZoom.toDouble())
                        val cosLat = cos(Math.toRadians(currentCenter.lat)).coerceAtLeast(0.1)

                        val dLon = (-pan.x * 360.0) / (scale * cosLat)
                        val dLat = (pan.y * 360.0) / scale

                        cameraCenter = GeoPoint(
                            (currentCenter.lat + dLat).coerceIn(AgusanDelSurData.BOUNDS.minLat, AgusanDelSurData.BOUNDS.maxLat),
                            (currentCenter.lon + dLon).coerceIn(AgusanDelSurData.BOUNDS.minLon, AgusanDelSurData.BOUNDS.maxLon)
                        )
                    }
                }
        ) {
            val width = size.width
            val height = size.height

            // 1. Draw subtle background terrain grid
            drawGrid(cameraCenter, zoomLevel, width, height, fiberColors.border.copy(alpha = 0.25f))

            // 2. Draw Agusan River Corridor
            drawPolyline(
                points = AgusanDelSurData.AGUSAN_RIVER,
                center = cameraCenter,
                zoom = zoomLevel,
                strokeColor = Color(0xFF64B5F6).copy(alpha = 0.6f),
                strokeWidth = 6.dp.toPx()
            )

            // 3. Draw Daang Maharlika Highway (AH26) base road
            drawPolyline(
                points = AgusanDelSurData.HIGHWAY_AH26_ROAD,
                center = cameraCenter,
                zoom = zoomLevel,
                strokeColor = outlineColor.copy(alpha = 0.6f),
                strokeWidth = 5.dp.toPx()
            )

            // 4. Draw Municipality landmarks
            for (muni in AgusanDelSurData.MUNICIPALITIES) {
                val pt = geoToScreen(muni.point, cameraCenter, zoomLevel, width, height)
                if (pt.x in -50f..(width + 50f) && pt.y in -50f..(height + 50f)) {
                    drawCircle(
                        color = onSurfaceVariantColor.copy(alpha = 0.7f),
                        radius = if (muni.isCapitalOrHub) 4.5.dp.toPx() else 3.dp.toPx(),
                        center = pt
                    )
                    drawText(
                        textMeasurer = textMeasurer,
                        text = muni.name,
                        topLeft = Offset(pt.x + 8.dp.toPx(), pt.y - 8.dp.toPx()),
                        style = TextStyle(
                            fontSize = if (muni.isCapitalOrHub) 12.sp else 10.sp,
                            fontWeight = if (muni.isCapitalOrHub) FontWeight.Bold else FontWeight.Medium,
                            color = onSurfaceVariantColor
                        )
                    )
                }
            }

            // 5. Draw Fiber Lines
            for (line in lines) {
                if (line.vertices.size < 2) continue
                val isSelected = line.id == selectedLineId
                val baseColor = getFiberColor(line.colorKey)

                // Casing (White/Black high contrast border)
                drawFiberLine(
                    points = line.vertices,
                    center = cameraCenter,
                    zoom = zoomLevel,
                    strokeColor = if (isSelected) Color.White else Color.White.copy(alpha = 0.85f),
                    strokeWidth = if (isSelected) 8.dp.toPx() else 5.dp.toPx(),
                    isDashed = line.status == LineStatus.PLANNED
                )

                // Colored core stroke
                drawFiberLine(
                    points = line.vertices,
                    center = cameraCenter,
                    zoom = zoomLevel,
                    strokeColor = baseColor,
                    strokeWidth = if (isSelected) 5.dp.toPx() else 3.dp.toPx(),
                    isDashed = line.status == LineStatus.PLANNED
                )
            }

            // 6. Draw Line being manually drawn (Google Maps Measure Style)
            if (isDrawingMode && drawingVertices.isNotEmpty()) {
                // Outline casing
                drawFiberLine(
                    points = drawingVertices,
                    center = cameraCenter,
                    zoom = zoomLevel,
                    strokeColor = Color.White,
                    strokeWidth = 7.dp.toPx(),
                    isDashed = false
                )
                // Core dashed line
                drawFiberLine(
                    points = drawingVertices,
                    center = cameraCenter,
                    zoom = zoomLevel,
                    strokeColor = fiberColors.jacket,
                    strokeWidth = 4.dp.toPx(),
                    isDashed = true
                )
                // Draw numbered corner vertices (only when within viewport)
                for (idx in drawingVertices.indices) {
                    val v = drawingVertices[idx]
                    val p = geoToScreen(v, cameraCenter, zoomLevel, width, height)
                    if (p.x !in -30f..(width + 30f) || p.y !in -30f..(height + 30f)) continue

                    val nodeRadius = 9.dp.toPx()
                    drawCircle(color = Color.White, radius = nodeRadius + 2.dp.toPx(), center = p)
                    drawCircle(color = fiberColors.jacket, radius = nodeRadius, center = p)
                    drawText(
                        textMeasurer = textMeasurer,
                        text = "${idx + 1}",
                        topLeft = Offset(p.x - 4.dp.toPx(), p.y - 6.dp.toPx()),
                        style = TextStyle(fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    )
                }
            }

            // 7. Draw OTDR Uncertainty Band if active
            if (activeOtdrMatch != null) {
                val minPt = geoToScreen(activeOtdrMatch.minPoint, cameraCenter, zoomLevel, width, height)
                val targetPt = geoToScreen(activeOtdrMatch.point, cameraCenter, zoomLevel, width, height)
                val maxPt = geoToScreen(activeOtdrMatch.maxPoint, cameraCenter, zoomLevel, width, height)

                // Highlight band
                drawLine(
                    color = Color(0xFFFF9800).copy(alpha = 0.5f),
                    start = minPt,
                    end = maxPt,
                    strokeWidth = 14.dp.toPx()
                )

                // OTDR Pin Target (draw only if on screen)
                if (targetPt.x in -60f..(width + 60f) && targetPt.y in -60f..(height + 60f)) {
                    drawCircle(color = fiberColors.cut, radius = 10.dp.toPx(), center = targetPt)
                    drawCircle(color = Color.White, radius = 10.dp.toPx(), center = targetPt, style = Stroke(3.dp.toPx()))
                    drawText(
                        textMeasurer = textMeasurer,
                        text = "OTDR TARGET (~${GeometryEngine.formatChainage(activeOtdrMatch.targetMapDistanceM)})",
                        topLeft = Offset(targetPt.x + 14.dp.toPx(), targetPt.y - 10.dp.toPx()),
                        style = TextStyle(
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = fiberColors.cut
                        )
                    )
                }
            }

            // 8. Draw Pins
            for (pin in pins) {
                val pt = geoToScreen(GeoPoint(pin.lat, pin.lon), cameraCenter, zoomLevel, width, height)
                if (pt.x !in -40f..(width + 40f) || pt.y !in -40f..(height + 40f)) continue

                val isSelected = pin.id == selectedPinId
                val pinColor = when {
                    pin.type == PinType.CUT_REPAIR && pin.state == PinState.OPEN -> fiberColors.cut
                    pin.type == PinType.CUT_REPAIR && pin.state == PinState.REPAIRED -> fiberColors.repaired
                    pin.type == PinType.SLACK_COIL -> Color(0xFFF5A623)
                    pin.type == PinType.SPLITTER_NAP -> Color(0xFF00B4D8)
                    else -> fiberColors.jacket
                }

                drawPinGlyph(
                    pt = pt,
                    type = pin.type,
                    state = pin.state,
                    color = pinColor,
                    isSelected = isSelected
                )

                // Pin label
                if (zoomLevel >= 13.0f || isSelected) {
                    drawText(
                        textMeasurer = textMeasurer,
                        text = pin.label.take(24),
                        topLeft = Offset(pt.x + 12.dp.toPx(), pt.y - 8.dp.toPx()),
                        style = TextStyle(
                            fontSize = 10.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = onSurfaceColor
                        )
                    )
                }
            }

            // 8.5 Draw Technician Live GPS Location if active and within visible screen bounds
            if (userGpsLocation != null) {
                val userPt = geoToScreen(userGpsLocation, cameraCenter, zoomLevel, width, height)
                // Critical safeguard: Only render when within or near visible canvas area
                // Coordinates far off-screen (e.g. emulator location in US vs Agusan del Sur)
                // produce enormous offset coordinates that exceed Compose Constraints limits.
                if (userPt.x in -120f..(width + 120f) && userPt.y in -120f..(height + 120f)) {
                    val accM = userGpsAccuracyM ?: 10f
                    val cosLat = cos(Math.toRadians(userGpsLocation.lat)).coerceAtLeast(0.1)
                    val metersPerPixel = (156543.03392 * cosLat) / (2.0.pow(zoomLevel.toDouble()))
                    val accPx = (accM / metersPerPixel).toFloat().coerceIn(12.dp.toPx(), 120.dp.toPx())

                    // Accuracy circle
                    drawCircle(
                        color = Color(0xFF1E88E5).copy(alpha = 0.15f),
                        radius = accPx,
                        center = userPt
                    )
                    drawCircle(
                        color = Color(0xFF1E88E5).copy(alpha = 0.4f),
                        radius = accPx,
                        center = userPt,
                        style = Stroke(1.5.dp.toPx())
                    )

                    // White ring
                    drawCircle(
                        color = Color.White,
                        radius = 9.dp.toPx(),
                        center = userPt
                    )
                    // Blue core dot
                    drawCircle(
                        color = Color(0xFF1E88E5),
                        radius = 6.5.dp.toPx(),
                        center = userPt
                    )
                    drawText(
                        textMeasurer = textMeasurer,
                        text = "MY LOCATION (±%.0fm)".format(accM),
                        topLeft = Offset(userPt.x + 12.dp.toPx(), userPt.y - 8.dp.toPx()),
                        style = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1565C0))
                    )
                }
            }

            // 9. Draw Center Reticle Crosshair
            val centerScreen = Offset(width / 2f, height / 2f)
            val reticleSize = 18.dp.toPx()
            drawLine(
                color = fiberColors.jacket,
                start = Offset(centerScreen.x - reticleSize, centerScreen.y),
                end = Offset(centerScreen.x + reticleSize, centerScreen.y),
                strokeWidth = 2.dp.toPx()
            )
            drawLine(
                color = fiberColors.jacket,
                start = Offset(centerScreen.x, centerScreen.y - reticleSize),
                end = Offset(centerScreen.x, centerScreen.y + reticleSize),
                strokeWidth = 2.dp.toPx()
            )
            drawCircle(
                color = fiberColors.jacket,
                radius = 6.dp.toPx(),
                center = centerScreen,
                style = Stroke(2.dp.toPx())
            )
        }

        // Map HUD Controls: Zoom +/- and Center on Agusan del Sur Hub
        Column(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FloatingActionButton(
                onClick = { zoomLevel = (zoomLevel + 1.0f).coerceAtMost(18.0f) },
                modifier = Modifier
                    .size(44.dp)
                    .testTag("zoom_in_button"),
                shape = RoundedCornerShape(12.dp),
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface
            ) {
                Icon(Icons.Default.Add, contentDescription = "Zoom In")
            }

            FloatingActionButton(
                onClick = { zoomLevel = (zoomLevel - 1.0f).coerceAtLeast(9.0f) },
                modifier = Modifier
                    .size(44.dp)
                    .testTag("zoom_out_button"),
                shape = RoundedCornerShape(12.dp),
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface
            ) {
                Icon(Icons.Default.Remove, contentDescription = "Zoom Out")
            }

            FloatingActionButton(
                onClick = {
                    cameraCenter = AgusanDelSurData.DEFAULT_CENTER
                    zoomLevel = AgusanDelSurData.DEFAULT_ZOOM
                },
                modifier = Modifier
                    .size(44.dp)
                    .testTag("recenter_button"),
                shape = RoundedCornerShape(12.dp),
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = fiberColors.jacket
            ) {
                Icon(Icons.Default.MyLocation, contentDescription = "Recenter on San Francisco")
            }
        }

        // Live Reticle Coordinates & Zoom Badge (Bottom-Left)
        Surface(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp, bottom = 16.dp)
                .testTag("reticle_coords_badge"),
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f),
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .background(fiberColors.jacket, CircleShape)
                )
                Text(
                    text = "%.5f°N, %.5f°E • z%.1f".format(cameraCenter.lat, cameraCenter.lon, zoomLevel),
                    style = MaterialTheme.typography.labelSmall,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

private fun DrawScope.drawGrid(
    center: GeoPoint,
    zoom: Float,
    width: Float,
    height: Float,
    gridColor: Color
) {
    val step = 60.dp.toPx()
    var x = (width / 2f) % step
    while (x < width) {
        drawLine(color = gridColor, start = Offset(x, 0f), end = Offset(x, height), strokeWidth = 1f)
        x += step
    }
    var y = (height / 2f) % step
    while (y < height) {
        drawLine(color = gridColor, start = Offset(0f, y), end = Offset(width, y), strokeWidth = 1f)
        y += step
    }
}

private fun DrawScope.drawFiberLine(
    points: List<GeoPoint>,
    center: GeoPoint,
    zoom: Float,
    strokeColor: Color,
    strokeWidth: Float,
    isDashed: Boolean
) {
    if (points.size < 2) return
    val path = Path()
    val first = geoToScreen(points.first(), center, zoom, size.width, size.height)
    path.moveTo(first.x, first.y)
    for (i in 1 until points.size) {
        val pt = geoToScreen(points[i], center, zoom, size.width, size.height)
        path.lineTo(pt.x, pt.y)
    }

    val pathEffect = if (isDashed) PathEffect.dashPathEffect(floatArrayOf(16f, 12f), 0f) else null
    drawPath(path = path, color = strokeColor, style = Stroke(width = strokeWidth, pathEffect = pathEffect))
}

private fun DrawScope.drawPolyline(
    points: List<GeoPoint>,
    center: GeoPoint,
    zoom: Float,
    strokeColor: Color,
    strokeWidth: Float
) {
    if (points.size < 2) return
    val path = Path()
    val first = geoToScreen(points.first(), center, zoom, size.width, size.height)
    path.moveTo(first.x, first.y)
    for (i in 1 until points.size) {
        val pt = geoToScreen(points[i], center, zoom, size.width, size.height)
        path.lineTo(pt.x, pt.y)
    }
    drawPath(path = path, color = strokeColor, style = Stroke(width = strokeWidth))
}

private fun DrawScope.drawPinGlyph(
    pt: Offset,
    type: PinType,
    state: PinState,
    color: Color,
    isSelected: Boolean
) {
    val radius = if (isSelected) 10.dp.toPx() else 7.dp.toPx()

    when (type) {
        PinType.CUT_REPAIR -> {
            // Diamond glyph for Cut & Repair
            val path = Path().apply {
                moveTo(pt.x, pt.y - radius * 1.3f)
                lineTo(pt.x + radius * 1.3f, pt.y)
                lineTo(pt.x, pt.y + radius * 1.3f)
                lineTo(pt.x - radius * 1.3f, pt.y)
                close()
            }
            drawPath(path, color = color)
            drawPath(path, color = Color.White, style = Stroke(width = 2.dp.toPx()))
        }
        PinType.SLACK_COIL -> {
            // Concentric loops
            drawCircle(color = color, radius = radius, center = pt, style = Stroke(width = 2.5.dp.toPx()))
            drawCircle(color = color, radius = radius * 0.5f, center = pt, style = Stroke(width = 2.dp.toPx()))
            drawCircle(color = Color.White, radius = radius, center = pt, style = Stroke(width = 1.dp.toPx()))
        }
        PinType.SPLITTER_NAP -> {
            // Square NAP Box
            val side = radius * 1.8f
            drawRect(
                color = color,
                topLeft = Offset(pt.x - side / 2f, pt.y - side / 2f),
                size = androidx.compose.ui.geometry.Size(side, side)
            )
            drawRect(
                color = Color.White,
                topLeft = Offset(pt.x - side / 2f, pt.y - side / 2f),
                size = androidx.compose.ui.geometry.Size(side, side),
                style = Stroke(width = 2.dp.toPx())
            )
        }
        else -> {
            // Standard circle node
            drawCircle(color = color, radius = radius, center = pt)
            drawCircle(color = Color.White, radius = radius, center = pt, style = Stroke(width = 2.dp.toPx()))
        }
    }
}

fun geoToScreen(
    geo: GeoPoint,
    center: GeoPoint,
    zoom: Float,
    width: Float,
    height: Float
): Offset {
    val scale = 256.0 * 2.0.pow(zoom.toDouble())
    val cosLat = cos(Math.toRadians(center.lat)).coerceAtLeast(0.1)

    val dLon = geo.lon - center.lon
    val dLat = geo.lat - center.lat

    val x = width / 2.0 + (dLon * scale / 360.0) * cosLat
    val y = height / 2.0 - (dLat * scale / 360.0)

    return Offset(x.toFloat(), y.toFloat())
}

fun screenToGeo(
    screen: Offset,
    center: GeoPoint,
    zoom: Float,
    width: Float,
    height: Float
): GeoPoint {
    val scale = 256.0 * 2.0.pow(zoom.toDouble())
    val cosLat = cos(Math.toRadians(center.lat)).coerceAtLeast(0.1)

    val dX = screen.x - width / 2.0
    val dY = height / 2.0 - screen.y

    val dLon = (dX / cosLat) * 360.0 / scale
    val dLat = dY * 360.0 / scale

    return GeoPoint(center.lat + dLat, center.lon + dLon)
}

private fun distanceToSegment(p: Offset, a: Offset, b: Offset): Float {
    val dx = b.x - a.x
    val dy = b.y - a.y
    val lenSq = dx * dx + dy * dy
    if (lenSq < 1e-4) return hypot(p.x - a.x, p.y - a.y)
    val t = (((p.x - a.x) * dx) + ((p.y - a.y) * dy)) / lenSq
    val clampedT = t.coerceIn(0f, 1f)
    val projX = a.x + clampedT * dx
    val projY = a.y + clampedT * dy
    return hypot(p.x - projX, p.y - projY)
}
