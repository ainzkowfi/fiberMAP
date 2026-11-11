package com.example.core.pmtiles

import java.io.File
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

data class PmTilesHeader(
    val version: Int,
    val rootDirOffset: Long,
    val rootDirLength: Long,
    val jsonMetadataOffset: Long,
    val jsonMetadataLength: Long,
    val leafDirsOffset: Long,
    val leafDirsLength: Long,
    val tileDataOffset: Long,
    val tileDataLength: Long,
    val numAddressedTiles: Long,
    val numTileEntries: Long,
    val numTileContents: Long,
    val isClustered: Boolean,
    val internalCompression: Int,
    val tileCompression: Int,
    val tileType: TileType,
    val minZoom: Int,
    val maxZoom: Int,
    val minLon: Double,
    val minLat: Double,
    val maxLon: Double,
    val maxLat: Double,
    val centerZoom: Int,
    val centerLon: Double,
    val centerLat: Double
) {
    val boundsString: String
        get() = "%.4f,%.4f,%.4f,%.4f".format(minLat, minLon, maxLat, maxLon)
}

enum class TileType(val code: Int, val description: String) {
    UNKNOWN(0, "Unknown"),
    MVT(1, "Mapbox Vector Tile (MVT)"),
    PNG(2, "Raster PNG"),
    JPEG(3, "Raster JPEG"),
    WEBP(4, "Raster WEBP"),
    AVIF(5, "Raster AVIF");

    companion object {
        fun fromCode(code: Int): TileType = values().find { it.code == code } ?: UNKNOWN
    }
}

object PmTilesReader {
    private val PMTILES_MAGIC = byteArrayOf(0x50, 0x4D, 0x54, 0x69, 0x6C, 0x65, 0x73) // "PMTiles"
    const val HEADER_SIZE_BYTES = 127

    /**
     * Reads and parses a PMTiles v3 header from a given file.
     * Throws IllegalArgumentException if the file is invalid or not PMTiles v3.
     */
    fun readHeader(file: File): PmTilesHeader {
        require(file.exists() && file.length() >= HEADER_SIZE_BYTES) {
            "File does not exist or is too small to be a PMTiles archive: ${file.name}"
        }
        file.inputStream().use { stream ->
            return readHeader(stream)
        }
    }

    /**
     * Reads and parses a PMTiles v3 header from an InputStream.
     */
    fun readHeader(stream: InputStream): PmTilesHeader {
        val buffer = ByteArray(HEADER_SIZE_BYTES)
        var bytesRead = 0
        while (bytesRead < HEADER_SIZE_BYTES) {
            val count = stream.read(buffer, bytesRead, HEADER_SIZE_BYTES - bytesRead)
            if (count == -1) break
            bytesRead += count
        }
        require(bytesRead == HEADER_SIZE_BYTES) {
            "Failed to read 127 bytes PMTiles header (only read $bytesRead bytes)"
        }

        // Validate Magic
        for (i in PMTILES_MAGIC.indices) {
            if (buffer[i] != PMTILES_MAGIC[i]) {
                throw IllegalArgumentException("Invalid PMTiles magic bytes. File is not a PMTiles archive.")
            }
        }

        val version = buffer[7].toInt() and 0xFF
        require(version == 3) {
            "Unsupported PMTiles version $version. Only PMTiles v3 is supported."
        }

        val byteBuffer = ByteBuffer.wrap(buffer).order(ByteOrder.LITTLE_ENDIAN)
        byteBuffer.position(8)

        val rootDirOffset = byteBuffer.long
        val rootDirLength = byteBuffer.long
        val jsonMetadataOffset = byteBuffer.long
        val jsonMetadataLength = byteBuffer.long
        val leafDirsOffset = byteBuffer.long
        val leafDirsLength = byteBuffer.long
        val tileDataOffset = byteBuffer.long
        val tileDataLength = byteBuffer.long
        val numAddressedTiles = byteBuffer.long
        val numTileEntries = byteBuffer.long
        val numTileContents = byteBuffer.long

        val isClustered = byteBuffer.get().toInt() != 0
        val internalCompression = byteBuffer.get().toInt() and 0xFF
        val tileCompression = byteBuffer.get().toInt() and 0xFF
        val tileTypeCode = byteBuffer.get().toInt() and 0xFF
        val minZoom = byteBuffer.get().toInt() and 0xFF
        val maxZoom = byteBuffer.get().toInt() and 0xFF

        val minLon = byteBuffer.int.toDouble() / 10_000_000.0
        val minLat = byteBuffer.int.toDouble() / 10_000_000.0
        val maxLon = byteBuffer.int.toDouble() / 10_000_000.0
        val maxLat = byteBuffer.int.toDouble() / 10_000_000.0

        val centerZoom = byteBuffer.get().toInt() and 0xFF
        val centerLon = byteBuffer.int.toDouble() / 10_000_000.0
        val centerLat = byteBuffer.int.toDouble() / 10_000_000.0

        return PmTilesHeader(
            version = version,
            rootDirOffset = rootDirOffset,
            rootDirLength = rootDirLength,
            jsonMetadataOffset = jsonMetadataOffset,
            jsonMetadataLength = jsonMetadataLength,
            leafDirsOffset = leafDirsOffset,
            leafDirsLength = leafDirsLength,
            tileDataOffset = tileDataOffset,
            tileDataLength = tileDataLength,
            numAddressedTiles = numAddressedTiles,
            numTileEntries = numTileEntries,
            numTileContents = numTileContents,
            isClustered = isClustered,
            internalCompression = internalCompression,
            tileCompression = tileCompression,
            tileType = TileType.fromCode(tileTypeCode),
            minZoom = minZoom,
            maxZoom = maxZoom,
            minLon = minLon,
            minLat = minLat,
            maxLon = maxLon,
            maxLat = maxLat,
            centerZoom = centerZoom,
            centerLon = centerLon,
            centerLat = centerLat
        )
    }

    /**
     * Synthesizes or creates a valid PMTiles v3 test header bytes array for built-in offline basemaps
     */
    fun createSyntheticHeaderBytes(
        minZoom: Int = 8,
        maxZoom: Int = 18,
        minLat: Double = 7.5000,
        minLon: Double = 125.0000,
        maxLat: Double = 9.2000,
        maxLon: Double = 126.8000,
        tileType: TileType = TileType.MVT
    ): ByteArray {
        val buffer = ByteBuffer.allocate(HEADER_SIZE_BYTES).order(ByteOrder.LITTLE_ENDIAN)
        buffer.put(PMTILES_MAGIC)
        buffer.put(3.toByte()) // v3
        buffer.putLong(127L) // rootDirOffset
        buffer.putLong(1024L) // rootDirLength
        buffer.putLong(2048L) // jsonOffset
        buffer.putLong(512L) // jsonLength
        buffer.putLong(0L) // leafDirsOffset
        buffer.putLong(0L) // leafDirsLength
        buffer.putLong(4096L) // tileDataOffset
        buffer.putLong(10_000_000L) // tileDataLength
        buffer.putLong(1250L) // numAddressedTiles
        buffer.putLong(1250L) // numTileEntries
        buffer.putLong(1250L) // numTileContents
        buffer.put(1.toByte()) // isClustered
        buffer.put(2.toByte()) // gzip
        buffer.put(2.toByte()) // gzip
        buffer.put(tileType.code.toByte())
        buffer.put(minZoom.toByte())
        buffer.put(maxZoom.toByte())
        buffer.putInt((minLon * 10_000_000.0).toInt())
        buffer.putInt((minLat * 10_000_000.0).toInt())
        buffer.putInt((maxLon * 10_000_000.0).toInt())
        buffer.putInt((maxLat * 10_000_000.0).toInt())
        buffer.put(13.toByte()) // centerZoom
        buffer.putInt((125.9772 * 10_000_000.0).toInt()) // centerLon
        buffer.putInt((8.5085 * 10_000_000.0).toInt()) // centerLat
        return buffer.array()
    }
}
