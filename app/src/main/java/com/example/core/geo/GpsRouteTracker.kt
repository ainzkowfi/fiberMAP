package com.example.core.geo

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class GpsFix(
    val point: GeoPoint,
    val accuracyM: Float,
    val speedKmh: Float,
    val timestamp: Long
)

class GpsRouteTracker(private val context: Context) {

    private val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

    private val _currentFix = MutableStateFlow<GpsFix?>(null)
    val currentFix: StateFlow<GpsFix?> = _currentFix.asStateFlow()

    private val _isTracking = MutableStateFlow(false)
    val isTracking: StateFlow<Boolean> = _isTracking.asStateFlow()

    private val _isPaused = MutableStateFlow(false)
    val isPaused: StateFlow<Boolean> = _isPaused.asStateFlow()

    private val _recordedVertices = MutableStateFlow<List<GeoPoint>>(emptyList())
    val recordedVertices: StateFlow<List<GeoPoint>> = _recordedVertices.asStateFlow()

    private val _distanceFromStartM = MutableStateFlow(0.0)
    val distanceFromStartM: StateFlow<Double> = _distanceFromStartM.asStateFlow()

    private var hasLocationListener = false

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            val point = GeoPoint(location.latitude, location.longitude)
            val accuracy = location.accuracy
            val speed = if (location.hasSpeed()) location.speed * 3.6f else 0.0f
            val fix = GpsFix(
                point = point,
                accuracyM = accuracy,
                speedKmh = speed,
                timestamp = location.time
            )
            _currentFix.value = fix

            // If actively tracking and not paused, record points automatically with jitter filter
            if (_isTracking.value && !_isPaused.value && accuracy <= 35f) {
                appendPointIfSignificant(point)
            }
        }

        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    private fun appendPointIfSignificant(point: GeoPoint) {
        val currentList = _recordedVertices.value
        if (currentList.isEmpty()) {
            _recordedVertices.value = listOf(point)
            _distanceFromStartM.value = 0.0
            return
        }

        val lastPoint = currentList.last()
        val distFromLast = GeometryEngine.haversineDistance(lastPoint, point)
        // Auto-record if moved at least 8 meters from last recorded vertex
        if (distFromLast >= 8.0) {
            val updated = currentList + point
            _recordedVertices.value = updated
            val cumDistances = GeometryEngine.computeCumulativeDistances(updated)
            _distanceFromStartM.value = cumDistances.lastOrNull() ?: 0.0
        }
    }

    @SuppressLint("MissingPermission")
    fun startListening() {
        if (hasLocationListener || locationManager == null) return
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    1000L,
                    2.0f,
                    locationListener,
                    Looper.getMainLooper()
                )
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    1000L,
                    5.0f,
                    locationListener,
                    Looper.getMainLooper()
                )
            }
            // Seed last known location if available
            val lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            if (lastGps != null) {
                _currentFix.value = GpsFix(
                    point = GeoPoint(lastGps.latitude, lastGps.longitude),
                    accuracyM = lastGps.accuracy,
                    speedKmh = if (lastGps.hasSpeed()) lastGps.speed * 3.6f else 0f,
                    timestamp = lastGps.time
                )
            }
            hasLocationListener = true
        } catch (_: SecurityException) {
            // Permission will be requested by Compose UI
        }
    }

    fun stopListening() {
        if (!hasLocationListener || locationManager == null) return
        try {
            locationManager.removeUpdates(locationListener)
            hasLocationListener = false
        } catch (_: Exception) {}
    }

    fun startRouteRecording() {
        _isTracking.value = true
        _isPaused.value = false
        _recordedVertices.value = emptyList()
        _distanceFromStartM.value = 0.0
        _currentFix.value?.let { fix ->
            if (fix.accuracyM <= 35f) {
                appendPointIfSignificant(fix.point)
            }
        }
    }

    fun pauseRouteRecording() {
        _isPaused.value = true
    }

    fun resumeRouteRecording() {
        _isPaused.value = false
        _currentFix.value?.let { fix ->
            if (fix.accuracyM <= 35f) {
                appendPointIfSignificant(fix.point)
            }
        }
    }

    fun logManualPointAtCurrentFix(): Boolean {
        val fix = _currentFix.value ?: return false
        val currentList = _recordedVertices.value
        val updated = currentList + fix.point
        _recordedVertices.value = updated
        val cum = GeometryEngine.computeCumulativeDistances(updated)
        _distanceFromStartM.value = cum.lastOrNull() ?: 0.0
        return true
    }

    fun undoLastRecordedPoint() {
        val currentList = _recordedVertices.value
        if (currentList.isNotEmpty()) {
            val updated = currentList.dropLast(1)
            _recordedVertices.value = updated
            val cum = GeometryEngine.computeCumulativeDistances(updated)
            _distanceFromStartM.value = cum.lastOrNull() ?: 0.0
        }
    }

    fun resetTracker() {
        _isTracking.value = false
        _isPaused.value = false
        _recordedVertices.value = emptyList()
        _distanceFromStartM.value = 0.0
    }
}
