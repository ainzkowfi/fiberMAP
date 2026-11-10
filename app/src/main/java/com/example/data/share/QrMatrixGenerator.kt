package com.example.data.share

import java.util.zip.CRC32
import kotlin.math.max

object QrMatrixGenerator {

    data class QrFrame(
        val index: Int,
        val totalCount: Int,
        val transferId: String,
        val payload: String,
        val crc32: Long
    )

    fun chunkPayload(fullText: String, chunkSize: Int = 180): List<QrFrame> {
        val transferId = Integer.toHexString(fullText.hashCode()).takeLast(6).uppercase()
        val chunks = fullText.chunked(chunkSize)
        val total = max(1, chunks.size)

        return chunks.mapIndexed { idx, chunk ->
            val crc = CRC32()
            crc.update(chunk.toByteArray())
            QrFrame(
                index = idx + 1,
                totalCount = total,
                transferId = transferId,
                payload = chunk,
                crc32 = crc.value
            )
        }
    }

    /**
     * Generates a deterministic high-contrast visual matrix for the QR frame payload
     * with standard corner finder patterns (7x7 position detection patterns).
     */
    fun generateMatrix(content: String, size: Int = 29): Array<BooleanArray> {
        val matrix = Array(size) { BooleanArray(size) { false } }

        // 1. Finder patterns at Top-Left, Top-Right, Bottom-Left
        drawFinderPattern(matrix, 0, 0)
        drawFinderPattern(matrix, size - 7, 0)
        drawFinderPattern(matrix, 0, size - 7)

        // 2. Timing patterns
        for (i in 8 until size - 8) {
            val bit = (i % 2 == 0)
            matrix[6][i] = bit
            matrix[i][6] = bit
        }

        // 3. Payload encoding into data cells
        val bytes = content.toByteArray()
        var bitIndex = 0

        for (r in 0 until size) {
            for (c in 0 until size) {
                // Skip finder patterns & timing patterns
                if (isReserved(r, c, size)) continue

                val bytePos = (bitIndex / 8) % bytes.size
                val bitPos = 7 - (bitIndex % 8)
                val bitValue = ((bytes[bytePos].toInt() shr bitPos) and 1) == 1

                // XOR with checkerboard mask to balance black/white modules
                val mask = (r + c) % 2 == 0
                matrix[r][c] = bitValue xor mask
                bitIndex++
            }
        }

        return matrix
    }

    private fun drawFinderPattern(matrix: Array<BooleanArray>, startR: Int, startC: Int) {
        for (r in 0 until 7) {
            for (c in 0 until 7) {
                val isOuter = r == 0 || r == 6 || c == 0 || c == 6
                val isCenter = r in 2..4 && c in 2..4
                matrix[startR + r][startC + c] = isOuter || isCenter
            }
        }
    }

    private fun isReserved(r: Int, c: Int, size: Int): Boolean {
        // Top-left
        if (r < 8 && c < 8) return true
        // Top-right
        if (r < 8 && c >= size - 8) return true
        // Bottom-left
        if (r >= size - 8 && c < 8) return true
        // Timing
        if (r == 6 || c == 6) return true
        return false
    }
}
